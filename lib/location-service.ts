import * as Location from "expo-location";
import { io, Socket } from "socket.io-client";

export interface LocationData {
  lat: number;
  lng: number;
  ts: number;
}

export interface LocationServiceConfig {
  apiUrl: string;
  token: string;
  riderId: string;
  onLocationUpdate?: (location: LocationData) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

export class LocationService {
  private socket: Socket | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private config: LocationServiceConfig;
  private isShiftActive = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

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
        console.warn("Permiso de ubicación en segundo plano denegado");
      }

      return true;
    } catch (error) {
      this.config.onError?.("Error al solicitar permisos");
      return false;
    }
  }

  async startShift(): Promise<void> {
    try {
      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error("Permisos de ubicación requeridos");
      }

      // Connect to WebSocket
      await this.connectSocket();

      // Start location updates
      this.isShiftActive = true;
      await this.startLocationUpdates();
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

      // Emit end-shift event
      if (this.socket?.connected) {
        this.socket.emit("end-shift", { riderId: this.config.riderId });
      }

      // Stop location updates
      await this.stopLocationUpdates();

      // Disconnect socket
      this.disconnectSocket();
    } catch (error) {
      console.error("Error ending shift:", error);
    }
  }

  private connectSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.apiUrl, {
          auth: {
            token: this.config.token,
          },
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: this.maxReconnectAttempts,
          transports: ["websocket"],
        });

        this.socket.on("connect", () => {
          console.log("[Socket] Conectado");
          this.reconnectAttempts = 0;
          this.config.onConnectionChange?.(true);
          resolve();
        });

        this.socket.on("disconnect", () => {
          console.log("[Socket] Desconectado");
          this.config.onConnectionChange?.(false);
        });

        this.socket.on("error", (error) => {
          console.error("[Socket] Error:", error);
          this.config.onError?.(
            typeof error === "string" ? error : "Error de conexión"
          );
          reject(error);
        });

        this.socket.on("connect_error", (error) => {
          console.error("[Socket] Connect error:", error);
          this.config.onError?.("Error de conexión");
          reject(error);
        });

        // Timeout if connection takes too long
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
      // Stop any existing subscription
      await this.stopLocationUpdates();

      // Start new subscription with 60-second interval
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // 60 seconds
          distanceInterval: 0, // Update on time interval only
        },
        (location) => {
          this.emitLocation(location);
        }
      );
    } catch (error) {
      console.error("Error starting location updates:", error);
      this.config.onError?.("Error al obtener ubicación");
    }
  }

  private async stopLocationUpdates(): Promise<void> {
    if (this.locationSubscription) {
      await this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

  private emitLocation(location: Location.LocationObject): void {
    if (!this.socket?.connected || !this.isShiftActive) {
      return;
    }

    const { latitude, longitude } = location.coords;
    const locationData: LocationData = {
      lat: latitude,
      lng: longitude,
      ts: Date.now(),
    };

    this.socket.emit("location", locationData);
    this.config.onLocationUpdate?.(locationData);

    console.log(
      `[Location] ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    );
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
