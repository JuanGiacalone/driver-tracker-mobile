import React, { createContext, useContext, useReducer, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import axios from "axios";

export interface AuthState {
  isLoading: boolean;
  isSignout: boolean;
  userToken: string | null;
  riderId: string | null;
  email: string | null;
  error: string | null;
}

export interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string, apiUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: "RESTORE_TOKEN"; payload: { token: string; riderId: string; email: string } }
  | { type: "SIGN_IN"; payload: { token: string; riderId: string; email: string } }
  | { type: "SIGN_OUT" }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" };

const initialState: AuthState = {
  isLoading: true,
  isSignout: false,
  userToken: null,
  riderId: null,
  email: null,
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
        email: action.payload.email,
        error: null,
      };
    case "SIGN_IN":
      return {
        isLoading: false,
        isSignout: false,
        userToken: action.payload.token,
        riderId: action.payload.riderId,
        email: action.payload.email,
        error: null,
      };
    case "SIGN_OUT":
      return {
        isLoading: false,
        isSignout: true,
        userToken: null,
        riderId: null,
        email: null,
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
        const email = await SecureStore.getItemAsync("email");

        if (token && riderId && email) {
          dispatch({
            type: "RESTORE_TOKEN",
            payload: { token, riderId, email },
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
    login: async (email: string, password: string, apiUrl: string) => {
      try {
        const response = await axios.post(`${apiUrl}/api/login`, {
          email,
          password,
        });

        const { token, riderId } = response.data;

        // Store securely
        await SecureStore.setItemAsync("userToken", token);
        await SecureStore.setItemAsync("riderId", riderId);
        await SecureStore.setItemAsync("email", email);

        dispatch({
          type: "SIGN_IN",
          payload: { token, riderId, email },
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
        await SecureStore.deleteItemAsync("email");
        dispatch({ type: "SIGN_OUT" });
      } catch (error) {
        console.error("Logout error:", error);
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
