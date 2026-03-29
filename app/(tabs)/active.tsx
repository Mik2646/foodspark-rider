import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
  ScrollView, Linking, Modal, TextInput, FlatList, KeyboardAvoidingView, Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { useState, useRef, useEffect } from "react";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";

const BLUE = "#1E88E5";
const GREEN = "#059669";

// ─── Open Maps navigation ────────────────────────────────────────────────────
function openMaps(query: string) {
  const encoded = encodeURIComponent(query);
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  Linking.openURL(googleUrl).catch(() => {
    // fallback: Apple Maps on iOS
    Linking.openURL(`maps://maps.apple.com/?daddr=${encoded}`);
  });
}

function openMapsLatLng(lat: number, lng: number, label: string) {
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  Linking.openURL(googleUrl).catch(() => {
    Linking.openURL(`maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`);
  });
}

// ─── Chat Modal ───────────────────────────────────────────────────────────────
function ChatModal({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const flatRef = useRef<FlatList>(null);

  const { data: messages = [] } = trpc.chat.getMessages.useQuery(orderId, {
    refetchInterval: 5000,
  });
  const send = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setText("");
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    send.mutate({ orderId, content: trimmed });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={chat.root}>
          {/* Header */}
          <View style={chat.header}>
            <Text style={chat.title}>แชทกับลูกค้า</Text>
            <TouchableOpacity onPress={onClose} style={chat.closeBtn}>
              <Ionicons name="close" size={22} color="#555" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={chat.list}
            renderItem={({ item: msg }) => {
              const isMe = msg.senderId === user?.id;
              return (
                <View style={[chat.bubble, isMe ? chat.bubbleMe : chat.bubbleThem]}>
                  {!isMe && <Text style={chat.senderName}>{msg.senderName}</Text>}
                  <Text style={[chat.bubbleText, isMe && chat.bubbleTextMe]}>{msg.content}</Text>
                  <Text style={[chat.bubbleTime, isMe && { color: "rgba(255,255,255,0.7)" }]}>
                    {new Date(msg.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={chat.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color="#CCC" />
                <Text style={chat.emptyText}>ยังไม่มีข้อความ{"\n"}ส่งข้อความหาลูกค้าได้เลย</Text>
              </View>
            }
          />

          {/* Input */}
          <View style={chat.inputRow}>
            <TextInput
              style={chat.input}
              value={text}
              onChangeText={setText}
              placeholder="พิมพ์ข้อความ..."
              placeholderTextColor="#AAA"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[chat.sendBtn, (!text.trim() || send.isPending) && chat.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || send.isPending}
            >
              <Ionicons name="send" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ActiveDeliveryScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [showChat, setShowChat] = useState(false);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);

  const { data: stats, isLoading } = trpc.rider.stats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const updateLocation = trpc.rider.updateLocation.useMutation();

  // Send GPS location every 30s while delivering
  useEffect(() => {
    const order = stats?.activeOrder;
    if (!order) return;
    let interval: ReturnType<typeof setInterval>;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const send = async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          updateLocation.mutate({ orderId: order.id, lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch { /* ignore */ }
      };
      send();
      interval = setInterval(send, 30000);
    })();
    return () => clearInterval(interval);
  }, [stats?.activeOrder?.id]);

  const completeOrder = trpc.rider.completeOrder.useMutation({
    onSuccess: () => {
      setProofPhoto(null);
      utils.rider.stats.invalidate();
      utils.rider.myOrders.invalidate();
      Alert.alert("ส่งสำเร็จ!", "ส่งอาหารเรียบร้อยแล้ว 🎉");
    },
    onError: (e) => Alert.alert("ไม่สำเร็จ", e.message),
  });

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("ไม่อนุญาต", "กรุณาอนุญาตการใช้กล้องในการตั้งค่า");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setProofPhoto(result.assets[0].uri);
    }
  };

  const handleComplete = (orderId: string) => {
    if (!proofPhoto) {
      Alert.alert("ต้องถ่ายรูปก่อน", "กรุณาถ่ายรูปยืนยันการส่งอาหาร", [
        { text: "ถ่ายรูป", onPress: handleTakePhoto },
        { text: "ยกเลิก", style: "cancel" },
      ]);
      return;
    }
    Alert.alert("ยืนยันการส่ง", "ส่งอาหารให้ลูกค้าเรียบร้อยแล้วใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ส่งแล้ว ✓", onPress: () => completeOrder.mutate(orderId) },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }, styles.center]}>
        <ActivityIndicator size="large" color={BLUE} />
      </View>
    );
  }

  const order = stats?.activeOrder;

  if (!order) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>กำลังส่ง</Text>
        </View>
        <View style={styles.center}>
          <Ionicons name="navigate-circle-outline" size={72} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>ไม่มีงานส่งอยู่</Text>
          <Text style={styles.emptyText}>ไปรับงานใหม่ได้ที่แท็บ "หาออเดอร์"</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>กำลังส่ง</Text>
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* ── Navigation Buttons ── */}
        <View style={styles.navSection}>
          <Text style={styles.navLabel}>นำทาง</Text>
          <View style={styles.navRow}>
            {/* Go to restaurant */}
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: "#FFF3E8", borderColor: "#FF6B00" }]}
              onPress={() => {
                if (order.restaurantLat && order.restaurantLng) {
                  openMapsLatLng(order.restaurantLat, order.restaurantLng, order.restaurantName);
                } else {
                  openMaps(order.restaurantName);
                }
              }}
              activeOpacity={0.85}
            >
              <View style={[styles.navBtnIcon, { backgroundColor: "#FF6B00" }]}>
                <Ionicons name="restaurant" size={18} color="#FFF" />
              </View>
              <View style={styles.navBtnText}>
                <Text style={styles.navBtnTitle}>ไปรับที่ร้าน</Text>
                <Text style={styles.navBtnSub} numberOfLines={1}>{order.restaurantName}</Text>
              </View>
              <Ionicons name="navigate" size={16} color="#FF6B00" />
            </TouchableOpacity>

            {/* Go to customer */}
            <TouchableOpacity
              style={[styles.navBtn, { backgroundColor: "#EBF5FB", borderColor: BLUE }]}
              onPress={() => openMaps(order.deliveryAddress)}
              activeOpacity={0.85}
            >
              <View style={[styles.navBtnIcon, { backgroundColor: BLUE }]}>
                <Ionicons name="home" size={18} color="#FFF" />
              </View>
              <View style={styles.navBtnText}>
                <Text style={styles.navBtnTitle}>ส่งให้ลูกค้า</Text>
                <Text style={styles.navBtnSub} numberOfLines={1}>{order.deliveryAddress}</Text>
              </View>
              <Ionicons name="navigate" size={16} color={BLUE} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Contact Buttons ── */}
        <View style={styles.contactRow}>
          {order.customerPhone ? (
            <TouchableOpacity
              style={[styles.contactBtn, { backgroundColor: "#F0FFF4", borderColor: GREEN }]}
              onPress={() => Linking.openURL(`tel:${order.customerPhone}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={20} color={GREEN} />
              <Text style={[styles.contactBtnText, { color: GREEN }]}>โทรหาลูกค้า</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.contactBtn, { backgroundColor: "#EBF5FB", borderColor: BLUE }]}
            onPress={() => setShowChat(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-ellipses" size={20} color={BLUE} />
            <Text style={[styles.contactBtnText, { color: BLUE }]}>แชทลูกค้า</Text>
          </TouchableOpacity>
        </View>

        {/* ── Order Card ── */}
        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={styles.restaurantIcon}>
              <Ionicons name="restaurant" size={20} color={BLUE} />
            </View>
            <View style={styles.orderHeaderText}>
              <Text style={styles.restaurantName}>{order.restaurantName}</Text>
              <Text style={styles.orderId}>#{order.id.slice(-8).toUpperCase()}</Text>
            </View>
          </View>

          {/* Customer info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ข้อมูลลูกค้า</Text>
            <View style={styles.infoRow}>
              <Ionicons name="person-outline" size={15} color="#666" />
              <Text style={styles.infoText}>{order.customerName ?? "ลูกค้า"}</Text>
            </View>
            {order.customerPhone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={15} color="#666" />
                <Text style={styles.infoText}>{order.customerPhone}</Text>
              </View>
            )}
          </View>

          {/* Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>รายการอาหาร</Text>
            {order.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>× {item.quantity}</Text>
                <Text style={styles.itemPrice}>฿{(item.price * item.quantity).toLocaleString()}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>ยอดรวม</Text>
              <Text style={styles.totalAmount}>฿{order.totalAmount.toLocaleString()}</Text>
            </View>
          </View>

          {/* Delivery address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ที่อยู่จัดส่ง</Text>
            <TouchableOpacity
              style={styles.addressBox}
              onPress={() => openMaps(order.deliveryAddress)}
              activeOpacity={0.8}
            >
              <Ionicons name="location" size={16} color="#EF4444" />
              <Text style={styles.addressText}>{order.deliveryAddress}</Text>
              <Ionicons name="navigate-outline" size={14} color={BLUE} />
            </TouchableOpacity>
            {order.deliveryNote ? (
              <View style={styles.noteBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="#999" />
                <Text style={styles.noteText}>{order.deliveryNote}</Text>
              </View>
            ) : null}
          </View>

          {/* Progress */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>สถานะ</Text>
            <View style={styles.steps}>
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, styles.stepDotDone]}>
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                </View>
                <Text style={[styles.stepLabel, styles.stepLabelDone]}>รับอาหารจากร้านแล้ว</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={[styles.stepDot, styles.stepDotActive]}>
                  <Ionicons name="bicycle" size={12} color="#FFF" />
                </View>
                <Text style={styles.stepLabel}>กำลังเดินทางไปส่ง</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepDotPending}>
                  <Ionicons name="home-outline" size={12} color="#CCC" />
                </View>
                <Text style={[styles.stepLabel, { color: "#CCC" }]}>ส่งถึงมือลูกค้า</Text>
              </View>
            </View>
          </View>

          {/* Earning */}
          <View style={styles.earningBox}>
            <Text style={styles.earningLabel}>รายได้จากงานนี้</Text>
            <Text style={styles.earningAmount}>+฿{Math.round(order.totalAmount * 0.1).toLocaleString()}</Text>
          </View>
        </View>

        {/* Proof of delivery photo */}
        <View style={styles.proofSection}>
          <Text style={styles.proofLabel}>รูปยืนยันการส่ง</Text>
          {proofPhoto ? (
            <View style={styles.proofPhotoWrap}>
              <Image source={{ uri: proofPhoto }} style={styles.proofPhoto} />
              <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
                <Ionicons name="camera" size={14} color={BLUE} />
                <Text style={styles.retakeBtnText}>ถ่ายใหม่</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
              <Ionicons name="camera" size={24} color={BLUE} />
              <Text style={styles.cameraBtnText}>ถ่ายรูปหน้าบ้านลูกค้า</Text>
              <Text style={styles.cameraBtnSub}>จำเป็นก่อนกดส่งเสร็จสิ้น</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Complete button */}
        <TouchableOpacity
          style={[styles.completeBtn, (!proofPhoto || completeOrder.isPending) && styles.btnDisabled]}
          onPress={() => handleComplete(order.id)}
          disabled={!proofPhoto || completeOrder.isPending}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
          <Text style={styles.completeBtnText}>
            {completeOrder.isPending ? "กำลังบันทึก..." : "ส่งอาหารแล้ว ✓"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {showChat && <ChatModal orderId={order.id} onClose={() => setShowChat(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F9FF" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E3F2FD",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A", flex: 1 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#D1FAE5", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  activeBadgeText: { color: GREEN, fontSize: 12, fontWeight: "bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#999" },
  emptyText: { fontSize: 14, color: "#BBBBBB", textAlign: "center" },
  scroll: { padding: 16, gap: 12 },

  navSection: { backgroundColor: "#FFF", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E3F2FD" },
  navLabel: { fontSize: 12, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  navRow: { gap: 10 },
  navBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1.5,
  },
  navBtnIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  navBtnText: { flex: 1 },
  navBtnTitle: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A" },
  navBtnSub: { fontSize: 12, color: "#777", marginTop: 2 },

  contactRow: { flexDirection: "row", gap: 10 },
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 13, borderRadius: 12, borderWidth: 1.5,
  },
  contactBtnText: { fontSize: 14, fontWeight: "700" },

  orderCard: {
    backgroundColor: "#FFFFFF", borderRadius: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: "#E3F2FD", overflow: "hidden",
  },
  orderHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#F0F7FF" },
  restaurantIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center" },
  orderHeaderText: { flex: 1 },
  restaurantName: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  orderId: { fontSize: 12, color: "#999", marginTop: 2 },

  section: { padding: 14, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  infoText: { fontSize: 14, color: "#333" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  itemName: { flex: 1, fontSize: 14, color: "#333" },
  itemQty: { fontSize: 13, color: "#888" },
  itemPrice: { fontSize: 14, fontWeight: "600", color: "#333" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#555" },
  totalAmount: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  addressBox: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  addressText: { flex: 1, fontSize: 14, color: "#333", lineHeight: 20 },
  noteBox: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  noteText: { fontSize: 13, color: "#888", fontStyle: "italic", flex: 1 },

  steps: { gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepDotDone: { backgroundColor: GREEN },
  stepDotActive: { backgroundColor: BLUE },
  stepDotPending: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F0F0F0" },
  stepLabel: { fontSize: 14, color: "#333" },
  stepLabelDone: { color: GREEN, fontWeight: "600" },

  earningBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", margin: 14, padding: 14, backgroundColor: "#F0FFF4", borderRadius: 12 },
  earningLabel: { fontSize: 14, color: GREEN },
  earningAmount: { fontSize: 20, fontWeight: "bold", color: GREEN },

  proofSection: {
    backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#E3F2FD",
  },
  proofLabel: { fontSize: 11, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  cameraBtn: {
    flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, padding: 20, borderRadius: 12, borderWidth: 1.5,
    borderStyle: "dashed", borderColor: BLUE, backgroundColor: "#EBF5FB",
  },
  cameraBtnText: { fontSize: 15, fontWeight: "700", color: BLUE },
  cameraBtnSub: { fontSize: 12, color: "#888" },
  proofPhotoWrap: { alignItems: "center", gap: 10 },
  proofPhoto: { width: "100%", height: 180, borderRadius: 12, backgroundColor: "#EEE" },
  retakeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  retakeBtnText: { fontSize: 13, color: BLUE, fontWeight: "600" },

  completeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GREEN, borderRadius: 100, paddingVertical: 16,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.5 },
  completeBtnText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
});

const chat = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F9FF" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, paddingTop: 20, backgroundColor: "#FFF",
    borderBottomWidth: 1, borderBottomColor: "#E3F2FD",
  },
  title: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  closeBtn: { padding: 4 },
  list: { padding: 16, gap: 10, flexGrow: 1, justifyContent: "flex-end" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, color: "#BBBBBB", textAlign: "center", lineHeight: 22 },
  bubble: { maxWidth: "75%", padding: 10, borderRadius: 14 },
  bubbleMe: { alignSelf: "flex-end", backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: "flex-start", backgroundColor: "#FFF", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#E3F2FD" },
  senderName: { fontSize: 11, fontWeight: "700", color: "#999", marginBottom: 3 },
  bubbleText: { fontSize: 15, color: "#1A1A1A", lineHeight: 20 },
  bubbleTextMe: { color: "#FFF" },
  bubbleTime: { fontSize: 10, color: "#999", marginTop: 4, textAlign: "right" },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    padding: 12, backgroundColor: "#FFF",
    borderTopWidth: 1, borderTopColor: "#E3F2FD",
  },
  input: {
    flex: 1, backgroundColor: "#F5F9FF", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: "#1A1A1A",
    borderWidth: 1.5, borderColor: "#E3F2FD", maxHeight: 100,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BLUE, alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { opacity: 0.4 },
});
