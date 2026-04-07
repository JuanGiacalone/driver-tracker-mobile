import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { io, Socket } from "socket.io-client";
import { SHIFT_END_TS_KEY, notifyAutoEnd, stopShiftTimer } from "./shift-manager";

const LOCATION_TASK_NAME = "background-location-task";

export interface LocationData {
  lat: number;
  lng: number;
  ts: number;
}

// Module-level cache for background task credentials
let cachedCredentials: {
  token: string | null;
  apiUrl: string | null;
  riderId: string | null;
  storeId: string | null;
} = {
  token: null,
  apiUrl: null,
  riderId: null,
  storeId: null,
};

// Persistent key for background task deduplication
const LAST_LOCATION_SENT_TS = "lastLocationSentTs";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("[Background Location] Task error:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const location = locations[locations.length - 1];
      console.log(`[Background Location] New iteration: ${new Date(location.timestamp).toLocaleTimeString()}`);

      try {
        // ── Auto-end guard: stop tracking once the 4-hour shift expires ──
        const shiftEndTsStr = await AsyncStorage.getItem(SHIFT_END_TS_KEY);
        if (shiftEndTsStr && Date.now() >= parseInt(shiftEndTsStr, 10)) {
          console.log("[Background Location] Shift expired — stopping location updates");
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          await stopShiftTimer();
          await notifyAutoEnd();
          return;
        }

        const lastSentTsStr = await AsyncStorage.getItem(LAST_LOCATION_SENT_TS);
        const lastSentTs = lastSentTsStr ? parseInt(lastSentTsStr, 10) : 0;

        if (location.timestamp <= lastSentTs || (location.timestamp - lastSentTs < 10000)) {
          console.log("[Background Location] Skipping duplicate/frequent update");
          return;
        }

        // Try to use cached credentials first to avoid SecureStore overhead/Keystore locking
        let { token, apiUrl, riderId, storeId } = cachedCredentials;

        if (!token || !apiUrl || !riderId) {
          console.log("[Background Location] Cache miss, reading from SecureStore...");
          token = await SecureStore.getItemAsync("userToken");
          apiUrl = await SecureStore.getItemAsync("apiUrl");
          riderId = await SecureStore.getItemAsync("riderId");
          storeId = await SecureStore.getItemAsync("storeId");

          // Update cache if successful
          if (token && apiUrl && riderId) {
            cachedCredentials = { token, apiUrl, riderId, storeId };
          }
        }

        if (!token || !apiUrl || !riderId) {
          console.error("[Background Location] Missing credentials after SecureStore check");
          return;
        }

        const payload = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          ts: location.timestamp,
          storeId: storeId || undefined,
        };

        console.log(`[Background Location] Posting to ${apiUrl}/api/location...`);
        await axios.post(`${apiUrl}/api/location`, payload, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

        await AsyncStorage.setItem(LAST_LOCATION_SENT_TS, location.timestamp.toString());
        console.log(
          "[Background Location] Sent successfully:",
          payload.lat.toFixed(4),
          payload.lng.toFixed(4),
        );
      } catch (err) {
        console.error("[Background Location] Failed in iteration:", err instanceof Error ? err.message : String(err));
      }
    }
  }
});

export interface DeliveryData {
  deliveryId: number;
  storeId: number;
  storeName: string | null;
  customerAddress: string | null;
  amount: number | null;
  paymentMethod: string | null;
  recipientName: string | null;
}

export interface LocationServiceConfig {
  apiUrl: string;
  token: string;
  riderId: string;
  storeId?: string;
  onLocationUpdate?: (location: LocationData) => void;
  onConnectionChange?: (connected: boolean) => void;
  onNewDelivery?: (delivery: DeliveryData) => void;
  onError?: (error: string) => void;
}

export class LocationService {
  private socket: Socket | null = null;
  private config: LocationServiceConfig;
  private isShiftActive = false;
  private maxReconnectAttempts = 5;

  constructor(config: LocationServiceConfig) {
    this.config = config;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (foreground.status !== "granted") {
        this.config.onError?.("Permiso de ubicación denegado");
        return false;
      }

      const background = await Location.requestBackgroundPermissionsAsync();
      if (background.status !== "granted") {
        this.config.onError?.("Se requiere permiso de ubicación en segundo plano para el seguimiento continuo");
        return false;
      }

      // 3. Request Notification Permissions (Android 13+)
      const notifications = await Notifications.requestPermissionsAsync();
      if (notifications.status !== "granted") {
        this.config.onError?.("Se requiere permiso de notificaciones para mostrar el estado del seguimiento");
        // We continue even if notifications are denied, though the user won't see the sticky notification
      }

      return true;
    } catch (error) {
      this.config.onError?.("Error al solicitar permisos");
      return false;
    }
  }

  async startShift(): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("Permisos de ubicación requeridos");
      }

      await this.connectSocket();

      this.isShiftActive = true;
      await this.startLocationUpdates();

      // Send an immediate location update so the dashboard sees the rider right away
      try {
        const currentPos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const payload = {
          lat: currentPos.coords.latitude,
          lng: currentPos.coords.longitude,
          ts: currentPos.timestamp,
          storeId: this.config.storeId,
        };

        await axios.post(`${this.config.apiUrl}/api/location`, payload, {
          headers: { Authorization: `Bearer ${this.config.token}` },
          timeout: 10000,
        });

        await AsyncStorage.setItem(LAST_LOCATION_SENT_TS, payload.ts.toString());

        // Update the UI immediately
        this.config.onLocationUpdate?.({
          lat: payload.lat,
          lng: payload.lng,
          ts: payload.ts,
        });

        console.log("[LocationService] Initial location sent on shift start");
      } catch (err) {
        console.warn("[LocationService] Failed to send initial location:", err);
      }

      // Pre-populate credentials cache to avoid SecureStore hits in background later
      cachedCredentials = {
        token: this.config.token,
        apiUrl: this.config.apiUrl,
        riderId: this.config.riderId,
        storeId: this.config.storeId || null,
      };
    } catch (error) {
      this.config.onError?.(
        error instanceof Error ? error.message : "Error al iniciar turno"
      );
      throw error;
    }
  }

  async endShift(): Promise<void> {
    try {
      this.isShiftActive = false;

      if (this.socket?.connected) {
        this.socket.emit("end-shift", { riderId: this.config.riderId });
      }

      await this.stopLocationUpdates();
      this.disconnectSocket();
    } catch (error) {
      console.error("Error ending shift:", error);
    }
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.apiUrl, {
          auth: { token: this.config.token },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ["websocket"],
        });

        this.socket.on("connect", () => {
          this.config.onConnectionChange?.(true);
          resolve();
        });

        this.socket.on("disconnect", () => {
          this.config.onConnectionChange?.(false);
        });

        this.socket.on("connect_error", (error) => {
          this.config.onError?.("Error de conexión");
          reject(error);
        });

        // Listen for new delivery assignments
        this.socket.on("new-delivery", (data: DeliveryData) => {
          console.log("[LocationService] New delivery received:", data);
          this.config.onNewDelivery?.(data);
        });

        const timeout = setTimeout(() => {
          if (!this.socket?.connected) {
            reject(new Error("Timeout de conexión"));
          }
        }, 10000);

        this.socket.once("connect", () => clearTimeout(timeout));
      } catch (error) {
        reject(error);
      }
    });
  }

  private disconnectSocket(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private async startLocationUpdates(): Promise<void> {
    try {
      await this.stopLocationUpdates();

      // Single location provider — runs as an Android foreground service
      // with type "location". Works in both foreground and background.
      // Updates fire when the device moves at least 25 meters.
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000,
        distanceInterval: 0,
        foregroundService: {
          notificationTitle: "RiderTracker activo",
          notificationBody: "Tu ubicación está siendo monitoreada",
          notificationColor: "#0F4C81",
        },
        pausesUpdatesAutomatically: false,
      });

      console.log("[LocationService] Location updates started (single provider)");
    } catch (error) {
      console.error("Error starting location updates:", error);
      this.config.onError?.("Error al iniciar seguimiento");
    }
  }

  private async stopLocationUpdates(): Promise<void> {
    try {
      const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (error) {
      console.error("Error stopping location updates:", error);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  isActive(): boolean {
    return this.isShiftActive;
  }

  cleanup(): void {
    this.stopLocationUpdates();
    this.disconnectSocket();
  }
}
