import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { LocationService, LocationData } from "@/lib/location-service";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

// Change this to your backend URL
// For local development: http://192.168.1.100:3000 (replace with your machine IP)
// For production: https://your-backend-domain.com
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:3000";

export default function ShiftScreen() {
  const router = useRouter();
  const { state, logout } = useAuth();
  const colors = useColors();

  const [shiftActive, setShiftActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationService, setLocationService] = useState<LocationService | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Initialize location service
  useEffect(() => {
    if (!state.userToken || !state.riderId) {
      router.replace("/login");
      return;
    }

    const service = new LocationService({
      apiUrl: API_URL,
      token: state.userToken,
      riderId: state.riderId,
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
    });

    setLocationService(service);

    return () => {
      service.cleanup();
    };
  }, [state.userToken, state.riderId]);

  const handleStartShift = async () => {
    if (!locationService) return;

    try {
      setLoading(true);
      setConnectionStatus("connecting");
      await locationService.startShift();
      setShiftActive(true);
      Alert.alert("Éxito", "Turno iniciado - Rastreo de ubicación activo");
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
        { text: "Cancelar", onPress: () => {} },
        {
          text: "Finalizar",
          onPress: async () => {
            try {
              setLoading(true);
              await locationService.endShift();
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

  return (
    <ScreenContainer className="bg-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 justify-between px-6 py-8">
          {/* Header */}
          <View>
            <Text className="text-3xl font-bold text-gray-900 mb-1">
              DriverTracker
            </Text>
            <Text className="text-sm text-gray-600 mb-1">
              Bienvenido, {state.email}
            </Text>
            <Text className="text-xs text-gray-500">
              ID: {state.riderId?.substring(0, 20)}...
            </Text>
          </View>

          {/* Main Content */}
          <View className="items-center gap-6">
            {/* Status Card */}
            <View className="w-full bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
              <View className="items-center mb-4">
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
                <Text className="text-sm text-gray-600 text-center">
                  {shiftActive
                    ? "Tu ubicación se está compartiendo en tiempo real"
                    : "Inicia un turno para comenzar el rastreo"}
                </Text>
              </View>

              {/* Connection Status */}
              <View className="flex-row items-center justify-center gap-2 pt-4 border-t border-blue-200">
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
                  UBICACIÓN ACTUAL
                </Text>
                <Text className="text-sm font-mono text-gray-900 mb-1">
                  Lat: {currentLocation.lat.toFixed(4)}
                </Text>
                <Text className="text-sm font-mono text-gray-900 mb-2">
                  Lng: {currentLocation.lng.toFixed(4)}
                </Text>
                {lastUpdate && (
                  <Text className="text-xs text-gray-600">
                    Última actualización: {lastUpdate}
                  </Text>
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
              v1.0.0 • DriverTracker
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
