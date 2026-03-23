import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { View, ActivityIndicator } from "react-native";

export default function RootIndex() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
        <ActivityIndicator size="large" color="#1E88E5" />
      </View>
    );
  }
  return isAuthenticated ? <Redirect href="/(tabs)" /> : <Redirect href="/login" />;
}
