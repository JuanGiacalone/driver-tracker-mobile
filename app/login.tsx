import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/lib/auth-context";
import { useColors } from "@/hooks/use-colors";
import { cn } from "@/lib/utils";

// Change this to your backend URL
// For local development: http://192.168.1.100:3000 (replace with your machine IP)
// For production: https://your-backend-domain.com
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.1.100:3000";

export default function LoginScreen() {
  const router = useRouter();
  const { login, state } = useAuth();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    try {
      setLoading(true);
      await login(email, password, API_URL);
      router.replace("/shift");
    } catch (error) {
      Alert.alert("Error de Autenticación", state.error || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      edges={["top", "left", "right", "bottom"]}
      className="bg-gradient-to-b from-blue-50 to-white"
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1">
        <View className="flex-1 justify-center px-6 py-8">
          {/* Header */}
          <View className="mb-8 items-center">
            <Text className="text-4xl font-bold text-blue-600 mb-2">
              DriverTracker
            </Text>
            <Text className="text-base text-gray-600 text-center">
              Sistema de Seguimiento de Conductores en Tiempo Real
            </Text>
          </View>

          {/* Login Form */}
          <View className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            {/* Email Input */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Correo Electrónico
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                placeholder="correo@ejemplo.com"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                editable={!loading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View className="mb-6">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                placeholder="••••••••"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
                secureTextEntry
              />
            </View>

            {/* Error Message */}
            {state.error && (
              <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <Text className="text-red-700 text-sm">{state.error}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className={cn(
                "py-3 rounded-lg flex-row items-center justify-center",
                loading ? "bg-blue-400" : "bg-blue-600"
              )}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-semibold text-base">
                  Iniciar Sesión
                </Text>
              )}
            </TouchableOpacity>
          </View>

            {/* Demo Credentials Info */}
          <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Text className="text-xs font-semibold text-blue-900 mb-2">
              CREDENCIALES DE DEMOSTRACIÓN
            </Text>
            <Text className="text-xs text-blue-800 mb-1">
              Email: rider1@example.com
            </Text>
            <Text className="text-xs text-blue-800 mb-3">
              Contraseña: password123
            </Text>
            <Text className="text-xs text-blue-700 font-medium">
              Servidor: {API_URL}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
