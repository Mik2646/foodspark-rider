import React, { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import { createTRPCClient as buildTrpcClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import * as SecureStore from "expo-secure-store";
import type { AppRouter } from "@/lib/trpc";
import { API_BASE_URL, USER_INFO_KEY, SESSION_TOKEN_KEY } from "@/constants/config";

type RiderUser = {
  id: number;
  name: string | null;
  email: string | null;
  role: string;
};

type AuthCtx = {
  user: RiderUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

function getDirectClient() {
  return buildTrpcClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/api/trpc`,
        transformer: superjson,
        fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
      }),
    ],
  });
}

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") localStorage.setItem(SESSION_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") return localStorage.getItem(SESSION_TOKEN_KEY);
    return null;
  }
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

async function clearToken() {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") localStorage.removeItem(SESSION_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

function saveUserInfo(user: RiderUser) {
  if (typeof window !== "undefined") localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
}
function loadUserInfo(): RiderUser | null {
  try {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(USER_INFO_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch { /* ignore */ }
  return null;
}
function clearUserInfo() {
  if (typeof window !== "undefined") localStorage.removeItem(USER_INFO_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<RiderUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const info = loadUserInfo();
    if (info) {
      loadToken().then((token) => {
        if (token) setUser(info);
        else clearUserInfo();
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const client = getDirectClient();
      const result = await client.auth.login.mutate({ email, password });
      if (result.user?.role !== "rider" && result.user?.role !== "admin") {
        return { ok: false, error: "บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบไรเดอร์" };
      }
      await saveToken(result.token);
      const u: RiderUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      };
      setUser(u);
      saveUserInfo(u);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? "เกิดข้อผิดพลาด" };
    }
  };

  const logout = async () => {
    setUser(null);
    clearUserInfo();
    await clearToken();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
