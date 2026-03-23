import { Platform } from "react-native";

export const API_BASE_URL =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000"
    : process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.1.86:3000";

export const USER_INFO_KEY = "rider_user_info";
export const SESSION_TOKEN_KEY = "rider_session_token";
