import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../foodspark/server/routers";
import { API_BASE_URL, SESSION_TOKEN_KEY } from "@/constants/config";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type { AppRouter };
export const trpc = createTRPCReact<AppRouter>();

async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") return localStorage.getItem(SESSION_TOKEN_KEY);
      return null;
    }
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_BASE_URL}/api/trpc`,
        transformer: superjson,
        async headers() {
          const token = await getToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
