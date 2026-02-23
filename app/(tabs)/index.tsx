import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (state.isLoading) return;

    if (state.userToken) {
      router.replace("/shift");
    } else {
      router.replace("/login");
    }
  }, [state.isLoading, state.userToken]);

  return null;
}
