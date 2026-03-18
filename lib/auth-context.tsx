import React, { createContext, useContext, useReducer, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

export interface Store {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface AuthState {
  isLoading: boolean;
  isSignout: boolean;
  userToken: string | null;
  riderId: string | null;
  username: string | null;
  tenantId: number | null;
  tenantName: string | null;
  storeId: string | null;
  stores: Store[];
  error: string | null;
}

export interface AuthContextType {
  state: AuthState;
  login: (username: string, password: string, apiUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  setStoreId: (storeId: string) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: "RESTORE_TOKEN"; payload: { token: string; riderId: string; username: string; tenantId: number; tenantName: string; storeId: string | null; stores: Store[] } }
  | { type: "SIGN_IN"; payload: { token: string; riderId: string; username: string; tenantId: number; tenantName: string; storeId: string | null; stores: Store[] } }
  | { type: "SET_STORE"; payload: string }
  | { type: "SIGN_OUT" }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

const initialState: AuthState = {
  isLoading: true,
  isSignout: false,
  userToken: null,
  riderId: null,
  username: null,
  tenantId: null,
  tenantName: null,
  storeId: null,
  stores: [],
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "RESTORE_TOKEN":
      return {
        isLoading: false,
        isSignout: false,
        userToken: action.payload.token,
        riderId: action.payload.riderId,
        username: action.payload.username,
        tenantId: action.payload.tenantId,
        tenantName: action.payload.tenantName,
        storeId: action.payload.storeId,
        stores: action.payload.stores || [],
        error: null,
      };
    case "SIGN_IN":
      return {
        isLoading: false,
        isSignout: false,
        userToken: action.payload.token,
        riderId: action.payload.riderId,
        username: action.payload.username,
        tenantId: action.payload.tenantId,
        tenantName: action.payload.tenantName,
        storeId: action.payload.storeId,
        stores: action.payload.stores || [],
        error: null,
      };
    case "SET_STORE":
      return {
        ...state,
        storeId: action.payload,
      };
    case "SIGN_OUT":
      return {
        isLoading: false,
        isSignout: true,
        userToken: null,
        riderId: null,
        username: null,
        tenantId: null,
        tenantName: null,
        storeId: null,
        stores: [],
        error: null,
      };
    case "SET_ERROR":
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore token on app launch
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await SecureStore.getItemAsync("userToken");
        const riderId = await SecureStore.getItemAsync("riderId");
        const username = await SecureStore.getItemAsync("username");
        const tenantIdStr = await SecureStore.getItemAsync("tenantId");
        const tenantName = await SecureStore.getItemAsync("tenantName");
        const storeId = await SecureStore.getItemAsync("storeId");
        const storesStr = await SecureStore.getItemAsync("stores");

        if (token && riderId && username && tenantIdStr && tenantName) {
          const tenantId = parseInt(tenantIdStr, 10);
          const stores = storesStr ? JSON.parse(storesStr) : [];
          dispatch({
            type: "RESTORE_TOKEN",
            payload: { token, riderId, username, tenantId, tenantName, storeId, stores },
          });
        } else {
          dispatch({ type: "SIGN_OUT" });
        }
      } catch (e) {
        dispatch({ type: "SIGN_OUT" });
      }
    };

    bootstrapAsync();
  }, []);

  const authContext: AuthContextType = {
    state,
    login: async (username: string, password: string, apiUrl: string) => {
      try {
        const response = await axios.post(`${apiUrl}/api/login`, {
          username,
          password,
        });

        const { token, riderId, tenantId, tenantName, stores } = response.data;

        // Use an initially empty store array if not returning from backend 
        const safeStores = stores || [];

        // Try to keep previous store choice if possible
        let storeId = await SecureStore.getItemAsync("storeId");
        if (storeId) {
          // ensure the saved storeId is valid for the current tenant's stores
          const isValid = safeStores.some((s: Store) => s.id.toString() === storeId);
          if (!isValid) storeId = null;
        }

        // Store securely
        await SecureStore.setItemAsync("userToken", token);
        await SecureStore.setItemAsync("riderId", riderId);
        await SecureStore.setItemAsync("username", username);
        await SecureStore.setItemAsync("tenantId", tenantId.toString());
        await SecureStore.setItemAsync("tenantName", tenantName);
        await SecureStore.setItemAsync("stores", JSON.stringify(safeStores));
        await SecureStore.setItemAsync("apiUrl", apiUrl);

        if (storeId) {
          await SecureStore.setItemAsync("storeId", storeId);
        } else {
          await SecureStore.deleteItemAsync("storeId");
        }

        dispatch({
          type: "SIGN_IN",
          payload: { token, riderId, username, tenantId, tenantName, storeId, stores: safeStores },
        });
      } catch (error: any) {
        const message = error.response?.data?.error || "Error de autenticación";
        dispatch({ type: "SET_ERROR", payload: message });
        throw error;
      }
    },
    logout: async () => {
      try {
        await SecureStore.deleteItemAsync("userToken");
        await SecureStore.deleteItemAsync("riderId");
        await SecureStore.deleteItemAsync("username");
        await SecureStore.deleteItemAsync("tenantId");
        await SecureStore.deleteItemAsync("tenantName");
        await SecureStore.deleteItemAsync("apiUrl");
        // Keep storeId cached so user doesn't have to re-select it if logging in with same tenant
        await SecureStore.deleteItemAsync("stores");
        dispatch({ type: "SIGN_OUT" });
      } catch (error) {
        console.error("Logout error:", error);
      }
    },
    setStoreId: async (storeId: string) => {
      try {
        await SecureStore.setItemAsync("storeId", storeId);
        dispatch({ type: "SET_STORE", payload: storeId });
      } catch (error) {
        console.error("Error saving store ID:", error);
      }
    },
    clearError: () => {
      dispatch({ type: "CLEAR_ERROR" });
    },
  };

  return (
    <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
