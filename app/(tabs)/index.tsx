import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";

const BLUE = "#1E88E5";

export default function AvailableOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: orders = [], isLoading, refetch } = trpc.rider.listAvailable.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const acceptOrder = trpc.rider.acceptOrder.useMutation({
    onSuccess: () => {
      utils.rider.listAvailable.invalidate();
      utils.rider.stats.invalidate();
      utils.rider.myOrders.invalidate();
    },
    onError: (e) => Alert.alert("ไม่สำเร็จ", e.message),
  });

  const onRefresh = useCallback(async () => {
    await utils.rider.listAvailable.invalidate();
  }, [utils]);

  const handleAccept = (orderId: string, restaurantName: string) => {
    Alert.alert("รับออเดอร์", `รับงานส่งจาก ${restaurantName}?`, [
      { text: "ยกเลิก", style: "cancel" },
      { text: "รับงาน", onPress: () => acceptOrder.mutate(orderId) },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>ออเดอร์พร้อมส่ง</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{orders.length} รายการ</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BLUE} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bicycle-outline" size={64} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>ไม่มีออเดอร์ใหม่</Text>
          <Text style={styles.emptyText}>ร้านค้ายังไม่มีออเดอร์พร้อมส่ง{"\n"}ลองรีเฟรชใหม่อีกครั้ง</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={BLUE} />}
          renderItem={({ item: order }) => (
            <View style={styles.card}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={styles.restaurantIcon}>
                  <Ionicons name="restaurant" size={18} color={BLUE} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.restaurantName}>{order.restaurantName}</Text>
                  <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
                </View>
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>พร้อมส่ง</Text>
                </View>
              </View>

              {/* Items */}
              <View style={styles.items}>
                {order.items.slice(0, 3).map((item) => (
                  <Text key={item.id} style={styles.itemText}>
                    • {item.name} × {item.quantity}
                  </Text>
                ))}
                {order.items.length > 3 && (
                  <Text style={styles.itemMore}>และอีก {order.items.length - 3} รายการ</Text>
                )}
              </View>

              {/* Delivery info */}
              <View style={styles.deliveryBox}>
                <Ionicons name="location-outline" size={14} color="#666" />
                <Text style={styles.deliveryAddr} numberOfLines={2}>{order.deliveryAddress}</Text>
              </View>
              {order.deliveryNote ? (
                <View style={styles.noteBox}>
                  <Ionicons name="chatbubble-outline" size={13} color="#999" />
                  <Text style={styles.noteText}>{order.deliveryNote}</Text>
                </View>
              ) : null}

              {/* Footer */}
              <View style={styles.cardFooter}>
                <View>
                  <Text style={styles.totalLabel}>ยอดรวม</Text>
                  <Text style={styles.totalAmount}>฿{order.totalAmount.toLocaleString()}</Text>
                </View>
                <View>
                  <Text style={styles.earningLabel}>รายได้คาดการณ์</Text>
                  <Text style={styles.earningAmount}>฿{Math.round(order.totalAmount * 0.1).toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.acceptBtn, acceptOrder.isPending && styles.btnDisabled]}
                  onPress={() => handleAccept(order.id, order.restaurantName)}
                  disabled={acceptOrder.isPending}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.acceptBtnText}>รับงาน</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F9FF" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#E3F2FD",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A", flex: 1 },
  badge: { backgroundColor: BLUE, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#999" },
  emptyText: { fontSize: 14, color: "#BBBB", textAlign: "center", lineHeight: 22 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: "#E3F2FD",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  restaurantIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center",
  },
  cardHeaderText: { flex: 1 },
  restaurantName: { fontSize: 15, fontWeight: "bold", color: "#1A1A1A" },
  orderId: { fontSize: 12, color: "#999", marginTop: 2 },
  readyBadge: { backgroundColor: "#D1FAE5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  readyBadgeText: { color: "#059669", fontSize: 12, fontWeight: "bold" },
  items: { marginBottom: 10, gap: 3 },
  itemText: { fontSize: 13, color: "#555" },
  itemMore: { fontSize: 12, color: "#999", fontStyle: "italic" },
  deliveryBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 4 },
  deliveryAddr: { flex: 1, fontSize: 13, color: "#444", lineHeight: 18 },
  noteBox: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  noteText: { fontSize: 12, color: "#888", fontStyle: "italic", flex: 1 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  totalLabel: { fontSize: 11, color: "#999" },
  totalAmount: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  earningLabel: { fontSize: 11, color: "#999" },
  earningAmount: { fontSize: 16, fontWeight: "bold", color: "#059669" },
  acceptBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: BLUE, borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  btnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
});
