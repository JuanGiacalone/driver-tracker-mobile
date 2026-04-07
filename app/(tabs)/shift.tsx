import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  AppState,
  AppStateStatus,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { LocationService, LocationData, DeliveryData } from "@/lib/location-service";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";
import {
  startShiftTimer,
  stopShiftTimer,
  resetIdleTimer,
  checkForActiveShift,
  notifyNewDelivery,
  SHIFT_DURATION_MS,
} from "@/lib/shift-manager";

// Change this to your backend URL
// For local development: http://192.168.1.100:3000 (replace with your machine IP)
// For production: https://your-backend-domain.com
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:3000";

/** Format elapsed seconds as  HH:MM:SS */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Format remaining milliseconds as  HH:MM:SS */
function formatRemaining(ms: number): string {
  return formatDuration(Math.max(0, Math.round(ms / 1000)));
}

export default function ShiftScreen() {
  const router = useRouter();
  const { state, logout, setStoreId } = useAuth();
  const colors = useColors();

  const [shiftActive, setShiftActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [locationService, setLocationService] = useState<LocationService | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [activeDelivery, setActiveDelivery] = useState<DeliveryData | null>(null);

  // Timer state
  const [remainingMs, setRemainingMs] = useState<number>(SHIFT_DURATION_MS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shiftEndTsRef = useRef<number | null>(null);

  // ─── Timer helpers ──────────────────────────────────────────────────────────

  const startTimer = useCallback((endTs: number) => {
    shiftEndTsRef.current = endTs;
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const left = shiftEndTsRef.current! - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        clearInterval(timerRef.current!);
        timerRef.current = null;
      } else {
        setRemainingMs(left);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    shiftEndTsRef.current = null;
    setRemainingMs(SHIFT_DURATION_MS);
  }, []);

  // ─── Initialize location service ────────────────────────────────────────────

  useEffect(() => {
    if (!state.userToken || !state.riderId) {
      router.replace("/login");
      return;
    }

    const service = new LocationService({
      apiUrl: API_URL,
      token: state.userToken,
      riderId: state.riderId,
      storeId: state.storeId || undefined,
      onLocationUpdate: (location) => {
        setCurrentLocation(location);
        const time = new Date(location.ts).toLocaleTimeString("es-ES");
        setLastUpdate(time);
      },
      onConnectionChange: (connected) => {
        setConnectionStatus(connected ? "connected" : "disconnected");
      },
      onError: (error) => {
        Alert.alert("Error", error);
      },
      onNewDelivery: async (delivery) => {
        console.log("[ShiftScreen] New delivery:", delivery);
        setActiveDelivery(delivery);
        await notifyNewDelivery(delivery);
      },
    });

    setLocationService(service);

    return () => {
      service.cleanup();
    };
  }, [state.userToken, state.riderId, state.storeId]);

  // ─── Re-attach to an existing shift on mount ────────────────────────────────

  useEffect(() => {
    (async () => {
      const active = await checkForActiveShift();
      if (active) {
        console.log("[ShiftScreen] Re-attaching to active shift");
        setShiftActive(true);
        startTimer(active.endTs);
        // Reset the idle notification since the driver just opened the app
        await resetIdleTimer();
      }
    })();
  }, [startTimer]);

  // ─── AppState — reset idle timer when driver brings app to foreground ───────

  useEffect(() => {
    const handleAppState = async (nextState: AppStateStatus) => {
      if (nextState === "active" && shiftActive) {
        await resetIdleTimer();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppState);
    return () => subscription.remove();
  }, [shiftActive]);

  // ─── Clean up timer on unmount ──────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleStartShift = async () => {
    if (!state.storeId) {
      setShowStoreSelector(true);
      return;
    }

    if (!locationService) return;

    try {
      setLoading(true);
      setConnectionStatus("connecting");
      await locationService.startShift();

      const endTs = Date.now() + SHIFT_DURATION_MS;
      await startShiftTimer(() => {
        // In-process auto-end callback (fires if app stays alive for 4h)
        handleAutoEnd();
      });
      startTimer(endTs);
      setShiftActive(true);
      Alert.alert("Éxito", "Turno iniciado — Rastreo de ubicación activo");
    } catch (error) {
      Alert.alert("Error", "No se pudo iniciar el turno");
      setConnectionStatus("disconnected");
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!locationService) return;

    Alert.alert(
      "Confirmar",
      "¿Deseas finalizar tu turno?",
      [
        { text: "Cancelar", onPress: () => { } },
        {
          text: "Finalizar",
          onPress: async () => {
            try {
              setLoading(true);
              await locationService.endShift();
              await stopShiftTimer();
              stopTimer();
              setShiftActive(false);
              setCurrentLocation(null);
              setLastUpdate("");
              Alert.alert("Éxito", "Turno finalizado");
            } catch (error) {
              Alert.alert("Error", "Error al finalizar turno");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /** Called by the in-process auto-end callback when the app stays alive. */
  const handleAutoEnd = async () => {
    if (!locationService) return;
    try {
      await locationService.endShift();
    } catch { /* background task already stopped it */ }
    stopTimer();
    setShiftActive(false);
    setCurrentLocation(null);
    setLastUpdate("");
  };

  const handleLogout = async () => {
    if (shiftActive) {
      Alert.alert("Advertencia", "Por favor finaliza tu turno antes de cerrar sesión");
      return;
    }

    try {
      await logout();
      router.replace("/login");
    } catch (error) {
      Alert.alert("Error", "Error al cerrar sesión");
    }
  };

  // ─── Derived display values ─────────────────────────────────────────────────

  const remainingLabel = formatRemaining(remainingMs);
  const elapsedMs = SHIFT_DURATION_MS - remainingMs;
  const elapsedLabel = formatDuration(Math.round(elapsedMs / 1000));
  const progressPct = Math.min(1, elapsedMs / SHIFT_DURATION_MS);

  return (
    <ScreenContainer className="bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 justify-between px-6 py-8">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-gray-900 mb-1">
              RiderTracker
            </Text>
            <Text className="text-sm text-gray-600 mb-1">
              Bienvenido, {state.username}
            </Text>
            <View className="flex-row justify-between items-center mt-2">
              <Text className="text-sm font-semibold text-blue-600">
                {state.tenantName}
              </Text>
            </View>
          </View>

          {/* Main Content */}
          <View className="items-center gap-6">
            {/* Status Card */}
            <View className="w-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
              <View className="w-full items-center mb-4">
                <View
                  className={cn(
                    "w-16 h-16 rounded-full items-center justify-center mb-3",
                    shiftActive ? "bg-green-500" : "bg-gray-400"
                  )}
                >
                  <Text className="text-2xl">{shiftActive ? "✓" : "○"}</Text>
                </View>
                <Text className="text-2xl font-bold text-gray-900 mb-2">
                  {shiftActive ? "Turno Activo" : "Turno Inactivo"}
                </Text>
                <Text className="w-full text-sm text-gray-600 text-center">
                  {shiftActive ? "Compartiendo ubicación..." : "Inicia tu turno"}
                </Text>
              </View>

              {/* Shift timer — only shown when active */}
              {shiftActive && (
                <View className="w-full mt-3 mb-1 items-center">
                  {/* Progress bar */}
                  <View className="w-full h-2 bg-blue-200 rounded-full mb-3 overflow-hidden">
                    <View
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${progressPct * 100}%` }}
                    />
                  </View>

                  <View className="flex-row justify-between w-full px-1">
                    <View className="items-center">
                      <Text className="text-xs text-gray-500 mb-0.5">Tiempo activo</Text>
                      <Text className="text-base font-bold text-gray-800 font-mono">
                        {elapsedLabel}
                      </Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-xs text-gray-500 mb-0.5">Tiempo restante</Text>
                      <Text
                        className={cn(
                          "text-base font-bold font-mono",
                          remainingMs < 30 * 60 * 1000 ? "text-orange-500" : "text-gray-800"
                        )}
                      >
                        {remainingLabel}
                      </Text>
                    </View>
                  </View>

                  <Text className="text-xs text-gray-400 mt-2 text-center">
                    El turno finaliza automáticamente a las 4 horas
                  </Text>
                </View>
              )}

              {/* Connection Status */}
              <View className="flex-row items-center justify-center gap-2 pt-4 border-t border-blue-200 mt-3">
                <View
                  className={cn(
                    "w-3 h-3 rounded-full",
                    connectionStatus === "connected"
                      ? "bg-green-500"
                      : connectionStatus === "connecting"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  )}
                />
                <Text className="text-xs font-semibold text-gray-700">
                  {connectionStatus === "connected"
                    ? "Conectado"
                    : connectionStatus === "connecting"
                      ? "Conectando..."
                      : "Desconectado"}
                </Text>
              </View>
            </View>

            {/* Location Info */}
            {currentLocation && (
              <View className="w-full bg-gray-50 rounded-lg p-4 border border-gray-200">
                <Text className="text-xs font-semibold text-gray-600 mb-2">
                  Ubicación actual
                </Text>
                <Text className="text-sm font-mono text-gray-900 mb-1">
                  Lat: {currentLocation.lat.toFixed(4)}
                </Text>
                <Text className="text-sm font-mono text-gray-900 mb-2">
                  Lng: {currentLocation.lng.toFixed(4)}
                </Text>
                {lastUpdate && (
                  <Text className="text-xs text-gray-600 mb-2">
                    Última actualización: {lastUpdate}
                  </Text>
                )}
              </View>
            )}

            {/* Store Selection */}
            {!shiftActive && (
              <TouchableOpacity
                onPress={() => setShowStoreSelector(true)}
                className="w-full bg-blue-50 border border-blue-200 p-4 rounded-xl flex-row justify-between items-center"
              >
                <View>
                  <Text className="text-xs text-blue-600 font-semibold mb-1">Sucursal</Text>
                  <Text className="text-base text-gray-900 font-medium">
                    {state.storeId
                      ? state.stores.find((s: any) => s.id.toString() === state.storeId)?.name || "Desconocida"
                      : "Toca para seleccionar sucursal"
                    }
                  </Text>
                </View>
                <Text className="text-blue-600 font-bold text-xl">›</Text>
              </TouchableOpacity>
            )}

            {shiftActive && state.storeId && (
              <View className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl flex-row items-center">
                <View>
                  <Text className="text-xs text-gray-500 font-semibold mb-1">Sucursal</Text>
                  <Text className="text-base text-gray-700 font-medium">
                    {state.stores.find((s: any) => s.id.toString() === state.storeId)?.name || "Desconocida"}
                  </Text>
                </View>
              </View>
            )}

            {/* Active Delivery Card */}
            {activeDelivery && shiftActive && (
              <View className="w-full bg-amber-50 rounded-2xl p-5 border border-amber-200">
                <View className="flex-row items-center mb-3">
                  <Text className="text-lg mr-2">📦</Text>
                  <Text className="text-base font-bold text-gray-900">Entrega Activa</Text>
                </View>

                {activeDelivery.recipientName && (
                  <View className="flex-row items-center mb-2">
                    <Text className="text-sm mr-2">👤</Text>
                    <Text className="text-sm text-gray-800 font-semibold">{activeDelivery.recipientName}</Text>
                  </View>
                )}

                <View className="flex-row gap-4 mb-2">
                  {activeDelivery.amount != null && (
                    <View className="flex-row items-center">
                      <Text className="text-sm mr-1">💰</Text>
                      <Text className="text-sm font-bold text-green-700">${activeDelivery.amount.toFixed(2)}</Text>
                    </View>
                  )}
                  {activeDelivery.paymentMethod && (
                    <View className="flex-row items-center">
                      <Text className="text-sm mr-1">💳</Text>
                      <Text className="text-sm text-gray-700">{activeDelivery.paymentMethod}</Text>
                    </View>
                  )}
                </View>

                {activeDelivery.customerAddress && (
                  <View className="flex-row items-center pt-2 border-t border-amber-200">
                    <Text className="text-sm mr-1">📍</Text>
                    <Text className="text-sm text-gray-600">{activeDelivery.customerAddress}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Main Action Button */}
            <TouchableOpacity
              onPress={shiftActive ? handleEndShift : handleStartShift}
              disabled={loading}
              className={cn(
                "w-full py-4 rounded-xl flex-row items-center justify-center",
                shiftActive
                  ? "bg-red-600"
                  : "bg-green-600",
                loading && "opacity-70"
              )}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-bold text-lg">
                  {shiftActive ? "Finalizar Turno" : "Iniciar Turno"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="gap-3">
            <TouchableOpacity
              onPress={handleLogout}
              className="py-3 rounded-lg border border-gray-300 bg-white"
            >
              <Text className="text-center font-semibold text-gray-700">
                Cerrar Sesión
              </Text>
            </TouchableOpacity>
            <Text className="text-xs text-gray-500 text-center">
              v1.0.0 • RiderTracker
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Store Selection Modal */}
      <Modal
        visible={showStoreSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStoreSelector(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6 min-h-[50%]">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-900">Seleccionar Tienda</Text>
              <TouchableOpacity onPress={() => setShowStoreSelector(false)} className="p-2">
                <Text className="text-gray-500 font-bold text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              {state.stores.length === 0 ? (
                <Text className="text-center text-gray-500 mt-4">No hay sucursales disponibles para tu organización.</Text>
              ) : (
                state.stores.map((store: any) => (
                  <TouchableOpacity
                    key={store.id}
                    onPress={() => {
                      setStoreId(store.id.toString());
                      setShowStoreSelector(false);
                    }}
                    className={cn(
                      "p-4 rounded-xl mb-3 border",
                      state.storeId === store.id.toString()
                        ? "bg-blue-50 border-blue-500"
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <Text className={cn(
                      "font-semibold text-base",
                      state.storeId === store.id.toString() ? "text-blue-700" : "text-gray-900"
                    )}>
                      {store.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
