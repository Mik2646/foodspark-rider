import {
  View, Text, FlatList, StyleSheet, RefreshControl, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";

const BLUE = "#1E88E5";
const GREEN = "#059669";

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(date: Date | string) {
  return new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: orders = [], isLoading } = trpc.rider.myOrders.useQuery(
    { filter: "history" },
    { enabled: isAuthenticated }
  );

  const onRefresh = useCallback(async () => {
    await utils.rider.myOrders.invalidate();
  }, [utils]);

  const delivered = orders.filter(o => o.status === "delivered");

  const { todayEarnings, weekEarnings, totalEarned, todayCount, weekCount } = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const todayOrders = delivered.filter(o => isSameDay(new Date(o.createdAt), now));
    const weekOrders = delivered.filter(o => new Date(o.createdAt) >= weekAgo);
    return {
      todayCount: todayOrders.length,
      weekCount: weekOrders.length,
      todayEarnings: todayOrders.reduce((s, o) => s + Math.round(o.totalAmount * 0.1), 0),
      weekEarnings: weekOrders.reduce((s, o) => s + Math.round(o.totalAmount * 0.1), 0),
      totalEarned: delivered.reduce((s, o) => s + Math.round(o.totalAmount * 0.1), 0),
    };
  }, [delivered]);

  // Group delivered orders by day
  const dailyGroups = useMemo(() => {
    const map = new Map<string, { date: string; count: number; earnings: number }>();
    for (const o of delivered) {
      const d = formatDateShort(o.createdAt);
      const existing = map.get(d) ?? { date: d, count: 0, earnings: 0 };
      existing.count += 1;
      existing.earnings += Math.round(o.totalAmount * 0.1);
      map.set(d, existing);
    }
    return Array.from(map.values()).slice(0, 7);
  }, [delivered]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>ประวัติการส่ง</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="time-outline" size={64} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>ยังไม่มีประวัติ</Text>
          <Text style={styles.emptyText}>เริ่มรับงานได้ที่แท็บ "หาออเดอร์"</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={BLUE} />}
          ListHeaderComponent={
            <View>
              {/* Earnings Summary */}
              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryNum}>{todayCount}</Text>
                  <Text style={[styles.summaryEarning, { color: GREEN }]}>฿{todayEarnings.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>วันนี้</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryNum}>{weekCount}</Text>
                  <Text style={[styles.summaryEarning, { color: GREEN }]}>฿{weekEarnings.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>7 วันล่าสุด</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryNum}>{delivered.length}</Text>
                  <Text style={[styles.summaryEarning, { color: GREEN }]}>฿{totalEarned.toLocaleString()}</Text>
                  <Text style={styles.summaryLabel}>ทั้งหมด</Text>
                </View>
              </View>

              {/* Daily breakdown */}
              {dailyGroups.length > 0 && (
                <View style={styles.dailySection}>
                  <Text style={styles.sectionTitle}>รายได้รายวัน (7 วันล่าสุด)</Text>
                  {dailyGroups.map((g) => (
                    <View key={g.date} style={styles.dailyRow}>
                      <View style={styles.dailyDot} />
                      <Text style={styles.dailyDate}>{g.date}</Text>
                      <Text style={styles.dailyCount}>{g.count} งาน</Text>
                      <Text style={styles.dailyEarning}>+฿{g.earnings.toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.sectionTitle}>รายการทั้งหมด</Text>
            </View>
          }
          renderItem={({ item: order }) => {
            const isDelivered = order.status === "delivered";
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.iconBox}>
                    <Ionicons
                      name={isDelivered ? "checkmark-circle" : "close-circle"}
                      size={28}
                      color={isDelivered ? GREEN : "#EF4444"}
                    />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.restaurantName}>{order.restaurantName}</Text>
                    <Text style={styles.dateText}>{formatDate(order.createdAt)}</Text>
                    <Text style={styles.addrText} numberOfLines={1}>{order.deliveryAddress}</Text>
                  </View>
                  <View style={styles.rightCol}>
                    <Text style={styles.orderAmount}>฿{order.totalAmount.toLocaleString()}</Text>
                    {isDelivered && (
                      <Text style={styles.earningText}>+฿{Math.round(order.totalAmount * 0.1)}</Text>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: isDelivered ? "#D1FAE5" : "#FEE2E2" }]}>
                      <Text style={[styles.statusText, { color: isDelivered ? GREEN : "#EF4444" }]}>
                        {isDelivered ? "ส่งแล้ว" : "ยกเลิก"}
                      </Text>
                    </View>
                  </View>
                </View>
                {order.items.length > 0 && (
                  <Text style={styles.itemsText} numberOfLines={1}>
                    {order.items.map(i => `${i.name} ×${i.quantity}`).join(", ")}
                  </Text>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F9FF" },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E3F2FD",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#999" },
  emptyText: { fontSize: 14, color: "#BBBBBB", textAlign: "center" },
  list: { padding: 16, gap: 10 },
  summaryGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: "#E3F2FD",
  },
  summaryNum: { fontSize: 20, fontWeight: "bold", color: BLUE },
  summaryEarning: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  summaryLabel: { fontSize: 11, color: "#888", marginTop: 3, textAlign: "center" },
  dailySection: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "#E3F2FD",
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  dailyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  dailyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginRight: 10 },
  dailyDate: { flex: 1, fontSize: 13, color: "#555" },
  dailyCount: { fontSize: 13, color: "#888", marginRight: 12 },
  dailyEarning: { fontSize: 14, fontWeight: "700", color: GREEN },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconBox: { width: 36, alignItems: "center", paddingTop: 2 },
  cardInfo: { flex: 1, gap: 2 },
  restaurantName: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A" },
  dateText: { fontSize: 12, color: "#999" },
  addrText: { fontSize: 12, color: "#777" },
  rightCol: { alignItems: "flex-end", gap: 4 },
  orderAmount: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A" },
  earningText: { fontSize: 13, fontWeight: "600", color: GREEN },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "bold" },
  itemsText: { fontSize: 12, color: "#AAAAAA", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
});
