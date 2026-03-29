import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const BLUE = "#1E88E5";
const GREEN = "#059669";

const editStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  body: { gap: 12, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "700", color: "#666", textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    backgroundColor: "#F5F9FF", borderRadius: 12, borderWidth: 1.5, borderColor: "#E3F2FD",
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#1A1A1A",
  },
  inputDisabled: { backgroundColor: "#F5F5F5", borderColor: "#EEE", color: "#AAA" },
  saveBtn: { backgroundColor: BLUE, borderRadius: 100, paddingVertical: 14, alignItems: "center" },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 16 },
});

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editPhone, setEditPhone] = useState(user?.phone ?? "");

  const utils2 = trpc.useUtils();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      await utils2.auth.me.invalidate();
      setShowEdit(false);
      Alert.alert("บันทึกสำเร็จ", "อัปเดตโปรไฟล์แล้ว");
    },
    onError: (e) => Alert.alert("เกิดข้อผิดพลาด", e.message),
  });

  const { data: stats } = trpc.rider.stats.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });
  const { data: history = [] } = trpc.rider.myOrders.useQuery({ filter: "history" }, { enabled: isAuthenticated });

  const setOnline = trpc.rider.setOnline.useMutation({
    onSuccess: () => utils.rider.stats.invalidate(),
  });

  const totalDelivered = history.filter(o => o.status === "delivered").length;
  const totalEarned = history
    .filter(o => o.status === "delivered")
    .reduce((s, o) => s + Math.round(o.totalAmount * 0.1), 0);

  const isOnline = stats?.isOnline ?? false;

  const handleToggleOnline = (value: boolean) => {
    setOnline.mutate(value);
  };

  const handleLogout = () => {
    Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ออกจากระบบ", style: "destructive", onPress: logout },
    ]);
  };

  return (
    <ScrollView style={[styles.root, { paddingTop: insets.top }]} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>โปรไฟล์</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, isOnline && styles.avatarOnline]}>
          <Ionicons name="bicycle" size={42} color={BLUE} />
          {isOnline && (
            <View style={styles.onlineDot} />
          )}
        </View>
        <View style={styles.nameRow}>
          <Text style={styles.userName}>{user?.name ?? "ไรเดอร์"}</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => { setEditName(user?.name ?? ""); setEditPhone(user?.phone ?? ""); setShowEdit(true); }}
          >
            <Ionicons name="pencil" size={14} color={BLUE} />
          </TouchableOpacity>
        </View>
        <Text style={styles.userEmail}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Ionicons name="shield-checkmark" size={12} color={BLUE} />
          <Text style={styles.roleText}>ไรเดอร์ที่ได้รับการยืนยัน</Text>
        </View>
      </View>

      {/* Online Toggle */}
      <View style={[styles.onlineCard, isOnline ? styles.onlineCardActive : styles.onlineCardInactive]}>
        <View style={styles.onlineInfo}>
          <View style={[styles.onlineStatusDot, { backgroundColor: isOnline ? GREEN : "#CCC" }]} />
          <View>
            <Text style={[styles.onlineTitle, { color: isOnline ? GREEN : "#666" }]}>
              {isOnline ? "พร้อมรับงาน" : "ออฟไลน์"}
            </Text>
            <Text style={styles.onlineSub}>
              {isOnline ? "คุณมองเห็นและรับออเดอร์ได้" : "เปิดสวิตช์เพื่อเริ่มรับงาน"}
            </Text>
          </View>
        </View>
        <Switch
          value={isOnline}
          onValueChange={handleToggleOnline}
          trackColor={{ false: "#D1D5DB", true: "#BBF7D0" }}
          thumbColor={isOnline ? GREEN : "#9CA3AF"}
          disabled={setOnline.isPending}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{stats?.todayDelivered ?? 0}</Text>
          <Text style={styles.statLabel}>ส่งวันนี้</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: GREEN }]}>฿{(stats?.todayEarnings ?? 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>รายได้วันนี้</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{totalDelivered}</Text>
          <Text style={styles.statLabel}>ทั้งหมด</Text>
        </View>
      </View>

      {/* Total earning */}
      <View style={styles.earningBanner}>
        <Ionicons name="wallet-outline" size={24} color={GREEN} />
        <View>
          <Text style={styles.earningBannerLabel}>รายได้สะสมทั้งหมด</Text>
          <Text style={styles.earningBannerNum}>฿{totalEarned.toLocaleString()}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ข้อมูลการทำงาน</Text>
        <View style={styles.infoRow}>
          <Ionicons name="star-outline" size={16} color="#F59E0B" />
          <Text style={styles.infoText}>คะแนนเฉลี่ย: 4.9 / 5.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={GREEN} />
          <Text style={styles.infoText}>อัตราส่งสำเร็จ: 99%</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={BLUE} />
          <Text style={styles.infoText}>เวลาส่งเฉลี่ย: 28 นาที</Text>
        </View>
      </View>

      {/* Delivery history */}
      {history.filter(o => o.status === "delivered").length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ประวัติการจัดส่ง</Text>
          {history.filter(o => o.status === "delivered").slice(0, 10).map((o) => (
            <View key={o.id} style={styles.historyRow}>
              <View style={styles.historyLeft}>
                <Text style={styles.historyName} numberOfLines={1}>{o.restaurantName}</Text>
                <Text style={styles.historyDate}>
                  {new Date(o.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                </Text>
              </View>
              <Text style={styles.historyEarning}>+฿{Math.round(o.totalAmount * 0.1).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Help */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ความช่วยเหลือ</Text>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="help-circle-outline" size={20} color="#555" />
          <Text style={styles.menuItemText}>ศูนย์ช่วยเหลือ</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Ionicons name="document-text-outline" size={20} color="#555" />
          <Text style={styles.menuItemText}>นโยบายและข้อกำหนด</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCC" style={{ marginLeft: "auto" }} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>ออกจากระบบ</Text>
      </TouchableOpacity>

      {/* Edit Profile Modal */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <KeyboardAvoidingView style={editStyles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={editStyles.sheet}>
            <View style={editStyles.header}>
              <Text style={editStyles.title}>แก้ไขโปรไฟล์</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)}>
                <Ionicons name="close" size={24} color="#555" />
              </TouchableOpacity>
            </View>
            <View style={editStyles.body}>
              <Text style={editStyles.label}>ชื่อ-นามสกุล</Text>
              <TextInput
                style={editStyles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="ชื่อของคุณ"
                placeholderTextColor="#AAA"
                autoCapitalize="words"
              />
              <Text style={editStyles.label}>เบอร์โทรศัพท์</Text>
              <TextInput
                style={editStyles.input}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="0812345678"
                placeholderTextColor="#AAA"
                keyboardType="phone-pad"
              />
              <Text style={editStyles.label}>อีเมล</Text>
              <TextInput
                style={[editStyles.input, editStyles.inputDisabled]}
                value={user?.email ?? ""}
                editable={false}
              />
            </View>
            <TouchableOpacity
              style={[editStyles.saveBtn, updateProfile.isPending && editStyles.saveBtnDisabled]}
              onPress={() => {
                if (!editName.trim()) { Alert.alert("กรุณากรอกชื่อ"); return; }
                updateProfile.mutate({ name: editName.trim(), phone: editPhone.trim() || undefined });
              }}
              disabled={updateProfile.isPending}
              activeOpacity={0.85}
            >
              {updateProfile.isPending
                ? <ActivityIndicator color="#FFF" />
                : <Text style={editStyles.saveBtnText}>บันทึกการเปลี่ยนแปลง</Text>
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F9FF" },
  scroll: { paddingBottom: 40 },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E3F2FD",
  },
  title: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A" },
  avatarSection: { alignItems: "center", backgroundColor: "#FFFFFF", paddingVertical: 28, paddingHorizontal: 20, marginBottom: 12 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  avatarOnline: {
    borderWidth: 3, borderColor: "#059669",
  },
  onlineDot: {
    position: "absolute", bottom: 2, right: 2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#059669", borderWidth: 2, borderColor: "#FFFFFF",
  },
  userName: { fontSize: 22, fontWeight: "bold", color: "#1A1A1A" },
  userEmail: { fontSize: 14, color: "#888", marginTop: 4 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, backgroundColor: "#E3F2FD", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  roleText: { fontSize: 12, color: BLUE, fontWeight: "600" },
  onlineCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16,
    borderWidth: 1.5,
  },
  onlineCardActive: { backgroundColor: "#F0FFF4", borderColor: "#BBF7D0" },
  onlineCardInactive: { backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" },
  onlineInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  onlineStatusDot: { width: 12, height: 12, borderRadius: 6 },
  onlineTitle: { fontSize: 15, fontWeight: "700" },
  onlineSub: { fontSize: 12, color: "#888", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    borderWidth: 1, borderColor: "#E3F2FD",
  },
  statNum: { fontSize: 20, fontWeight: "bold", color: BLUE },
  statLabel: { fontSize: 11, color: "#888", marginTop: 4, textAlign: "center" },
  earningBanner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: "#F0FFF4", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  earningBannerLabel: { fontSize: 13, color: GREEN },
  earningBannerNum: { fontSize: 22, fontWeight: "bold", color: GREEN },
  section: { backgroundColor: "#FFFFFF", marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: "#999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  infoText: { fontSize: 14, color: "#444" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  menuItemText: { fontSize: 14, color: "#333", flex: 1 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginTop: 4, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA",
  },
  logoutText: { fontSize: 15, fontWeight: "600", color: "#EF4444" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  historyLeft: { flex: 1 },
  historyName: { fontSize: 14, color: "#333", fontWeight: "500" },
  historyDate: { fontSize: 11, color: "#AAA", marginTop: 2 },
  historyEarning: { fontSize: 15, fontWeight: "700", color: GREEN },
});
