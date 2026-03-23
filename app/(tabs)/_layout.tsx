import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import * as Notifications from "expo-notifications";

const BLUE = "#1E88E5";

function usePushTokenRegistration() {
  const { isAuthenticated } = useAuth();
  const registerToken = trpc.auth.registerPushToken.useMutation();
  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web") return;
    (async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;
        const token = await Notifications.getExpoPushTokenAsync();
        registerToken.mutate({ token: token.data });
      } catch { /* non-critical */ }
    })();
  }, [isAuthenticated]);
}

function TabIcon({ name, color, badge }: { name: React.ComponentProps<typeof Ionicons>["name"]; color: string; badge?: number }) {
  return (
    <View style={styles.tabIcon}>
      <Ionicons name={name} size={22} color={color} />
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </View>
  );
}

function ActiveOrderIcon({ color }: { color: string }) {
  const { isAuthenticated } = useAuth();
  const { data: stats } = trpc.rider.stats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  const badge = stats?.activeOrder ? 1 : 0;
  return <TabIcon name="navigate-outline" color={color} badge={badge} />;
}

function ProfileIcon({ color }: { color: string }) {
  const { isAuthenticated } = useAuth();
  const { data: stats } = trpc.rider.stats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  return (
    <View style={styles.tabIcon}>
      <Ionicons name="person-outline" size={22} color={color} />
      {stats?.isOnline && (
        <View style={styles.onlineDot} />
      )}
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  usePushTokenRegistration();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: "#8A8A8A",
        tabBarStyle: {
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, 8),
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E3F2FD",
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "หาออเดอร์",
          tabBarIcon: ({ color }) => <TabIcon name="search-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: "กำลังส่ง",
          tabBarIcon: ({ color }) => <ActiveOrderIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "ประวัติ",
          tabBarIcon: ({ color }) => <TabIcon name="time-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "โปรไฟล์",
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIcon: { position: "relative", width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", top: -4, right: -10,
    backgroundColor: "#EF4444", borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FFFFFF",
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  onlineDot: {
    position: "absolute", bottom: 0, right: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#059669", borderWidth: 1.5, borderColor: "#FFFFFF",
  },
});
