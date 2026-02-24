import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    try {
      setLoading(true);
      await login(username, password, API_URL);
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
            <Image
              source={require("@/assets/images/favicon.png")}
              style={{ width: 80, height: 80, marginBottom: 16 }}
              resizeMode="contain"
            />
            <Text className="text-4xl font-bold text-blue-600 mb-2">
              RiderTracker
            </Text>
            <Text className="text-base text-gray-600 text-center w-full px-4">
              Seguimiento en tiempo real
            </Text>
          </View>

          {/* Login Form */}
          <View className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            {/* Username Input */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Usuario
              </Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                placeholder="Rider"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                editable={!loading}
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
                  Comenzar
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Demo Credentials Info */}
          <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <Text className="text-xs text-blue-700 font-medium">
              Servidor: {API_URL}
            </Text>
          </View>

          {/* Developer Credits */}
          <View className="mt-8 mb-4 items-center">
            <Text className="text-[10px] text-gray-400 font-medium">
              Desarrollado por JP Giacalone |{" "}
              <Text
                className="text-blue-400 font-bold"
                onPress={() => Linking.openURL("https://giacatec.ar")}
              >
                GiacaTec.ar
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
