import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createTRPCClient as buildClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/lib/trpc";
import { API_BASE_URL, SESSION_TOKEN_KEY } from "@/constants/config";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BLUE = "#1E88E5";
const AS_TOKEN_KEY = "@rider_session_token";
const VEHICLE_TYPES = [
  { id: "motorcycle", label: "มอเตอร์ไซค์", icon: "bicycle" as const },
  { id: "bicycle", label: "จักรยาน", icon: "bicycle-outline" as const },
  { id: "car", label: "รถยนต์", icon: "car-outline" as const },
];

function getDirectClient() {
  return buildClient<AppRouter>({
    links: [httpBatchLink({ url: `${API_BASE_URL}/api/trpc`, transformer: superjson })],
  });
}

async function saveToken(token: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") localStorage.setItem(SESSION_TOKEN_KEY, token);
    return;
  }
  try { await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token); } catch { /* ok */ }
  await AsyncStorage.setItem(AS_TOKEN_KEY, token);
}

export default function RiderRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    vehicleType: "motorcycle",
    vehiclePlate: "",
  });

  const set = (key: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleRegister = async () => {
    if (!form.name.trim()) return Alert.alert("กรุณากรอกชื่อ");
    if (!form.email.trim()) return Alert.alert("กรุณากรอกอีเมล");
    if (!form.phone.trim()) return Alert.alert("กรุณากรอกเบอร์โทร");
    if (form.password.length < 6) return Alert.alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (!form.vehiclePlate.trim()) return Alert.alert("กรุณากรอกทะเบียนรถ");

    setLoading(true);
    try {
      const client = getDirectClient();
      const result = await client.register.rider.mutate({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        password: form.password,
        vehicleType: form.vehicleType,
        vehiclePlate: form.vehiclePlate.trim().toUpperCase(),
      });
      await saveToken(result.token);
      Alert.alert(
        "สมัครสำเร็จ!",
        "บัญชีไรเดอร์ของคุณอยู่ระหว่างรอการอนุมัติจาก FoodSpark\nเราจะแจ้งให้ทราบเมื่ออนุมัติแล้ว",
        [{ text: "ตกลง", onPress: () => router.replace("/login") }]
      );
    } catch (e: any) {
      Alert.alert("สมัครไม่สำเร็จ", e?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={BLUE} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoBox}>
            <Ionicons name="bicycle" size={32} color={BLUE} />
          </View>
          <Text style={styles.appName}>สมัครเป็นไรเดอร์</Text>
          <Text style={styles.appSub}>ส่งอาหารกับ FoodSpark</Text>
        </View>

        {/* Personal Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ข้อมูลส่วนตัว</Text>
          <Field label="ชื่อ-นามสกุล *" value={form.name} onChangeText={set("name")} placeholder="กรอกชื่อ-นามสกุล" />
          <Field label="อีเมล *" value={form.email} onChangeText={set("email")} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="เบอร์โทรศัพท์ *" value={form.phone} onChangeText={set("phone")} placeholder="08x-xxx-xxxx" keyboardType="phone-pad" />
          <View style={styles.field}>
            <Text style={styles.label}>รหัสผ่าน *</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={form.password}
                onChangeText={set("password")}
                placeholder="อย่างน้อย 6 ตัวอักษร"
                placeholderTextColor="#AAAAAA"
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
                <Text style={styles.eyeText}>{showPass ? "ซ่อน" : "แสดง"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Vehicle Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ข้อมูลยานพาหนะ</Text>

          <View style={styles.field}>
            <Text style={styles.label}>ประเภทยานพาหนะ *</Text>
            <View style={styles.vehicleRow}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vehicleBtn, form.vehicleType === v.id && styles.vehicleBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, vehicleType: v.id }))}
                  activeOpacity={0.8}
                >
                  <Ionicons name={v.icon} size={20} color={form.vehicleType === v.id ? "#FFFFFF" : "#8A8A8A"} />
                  <Text style={[styles.vehicleBtnText, form.vehicleType === v.id && styles.vehicleBtnTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Field
            label="ทะเบียนรถ *"
            value={form.vehiclePlate}
            onChangeText={set("vehiclePlate")}
            placeholder="เช่น กข 1234 กรุงเทพ"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={BLUE} />
          <Text style={styles.noteText}>หลังสมัครแล้ว ทีมงาน FoodSpark จะตรวจสอบและอนุมัติภายใน 1-2 วันทำการ</Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.submitBtnText}>{loading ? "กำลังสมัคร..." : "สมัครเป็นไรเดอร์"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
          <Text style={styles.loginLinkText}>มีบัญชีอยู่แล้ว? เข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#AAAAAA" {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { paddingHorizontal: 20 },
  backBtn: { alignSelf: "flex-start", padding: 4, marginBottom: 16 },
  logoArea: { alignItems: "center", marginBottom: 24 },
  logoBox: {
    width: 68, height: 68, borderRadius: 20,
    backgroundColor: "#E3F2FD", alignItems: "center", justifyContent: "center",
    marginBottom: 10,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  appName: { fontSize: 22, fontWeight: "bold", color: BLUE },
  appSub: { fontSize: 13, color: "#8A8A8A", marginTop: 3 },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
    borderWidth: 1, borderColor: "#E3F2FD",
  },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#1A1A1A", marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: "#555555", marginBottom: 7 },
  input: {
    backgroundColor: "#F0F7FF", borderRadius: 11, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 14, color: "#1A1A1A",
    borderWidth: 1.5, borderColor: "#E3F2FD",
  },
  passRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: { paddingHorizontal: 6, paddingVertical: 12 },
  eyeText: { fontSize: 13, color: BLUE, fontWeight: "600" },
  vehicleRow: { flexDirection: "row", gap: 8 },
  vehicleBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, gap: 4,
    backgroundColor: "#F0F7FF", borderWidth: 1.5, borderColor: "#E3F2FD",
  },
  vehicleBtnActive: { backgroundColor: BLUE, borderColor: BLUE },
  vehicleBtnText: { fontSize: 12, fontWeight: "600", color: "#8A8A8A" },
  vehicleBtnTextActive: { color: "#FFFFFF" },
  noteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 12, padding: 12, marginBottom: 20,
  },
  noteText: { flex: 1, fontSize: 13, color: "#1E40AF", lineHeight: 18 },
  submitBtn: {
    backgroundColor: BLUE, borderRadius: 100, paddingVertical: 16,
    alignItems: "center", marginBottom: 16,
    shadowColor: BLUE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  loginLink: { alignItems: "center", paddingVertical: 8 },
  loginLinkText: { fontSize: 14, color: "#8A8A8A" },
});
