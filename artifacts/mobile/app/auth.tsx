import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

const domain = process.env.EXPO_PUBLIC_DOMAIN;

async function fetchGoogleLoginEnabled(): Promise<boolean> {
  try {
    const base = domain ? `https://${domain}` : "";
    const res = await fetch(`${base}/api/config/public`);
    if (!res.ok) return false;
    const config = await res.json();
    return config.google_login_enabled === "true";
  } catch {
    return false;
  }
}

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const [, googleResponse, googlePrompt] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID || "not-configured",
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

  useEffect(() => {
    fetchGoogleLoginEnabled().then(setGoogleEnabled);
  }, []);

  useEffect(() => {
    if (googleResponse?.type === "success") {
      handleGoogleSuccess(googleResponse.authentication?.accessToken ?? "");
    } else if (googleResponse?.type === "error") {
      setGoogleLoading(false);
      setError("فشل تسجيل الدخول بـ Google. حاول مجدداً.");
    }
  }, [googleResponse]);

  const handleGoogleSuccess = async (accessToken: string) => {
    if (!accessToken) { setGoogleLoading(false); return; }
    try {
      const userRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error("Failed to fetch Google profile");
      const profile = await userRes.json();
      await signIn(profile.email, profile.name ?? profile.email.split("@")[0], {
        provider: "google",
        avatar: profile.picture,
        id: "google_" + profile.id,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("حدث خطأ أثناء تسجيل الدخول بـ Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGooglePress = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      setError("Google Sign-In is not configured. Please contact the app administrator.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoogleLoading(true);
    setError("");
    await googlePrompt();
  };

  const handleSubmit = async () => {
    setError("");
    const emailTrimmed = email.trim();
    const nameTrimmed = name.trim();
    if (!emailTrimmed) { setError("البريد الإلكتروني مطلوب"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) { setError("البريد الإلكتروني غير صحيح"); return; }
    if (tab === "register" && !nameTrimmed) { setError("الاسم مطلوب"); return; }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await signIn(emailTrimmed, nameTrimmed || emailTrimmed.split("@")[0]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError("حدث خطأ. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  const showGoogleBtn = googleEnabled && !!GOOGLE_WEB_CLIENT_ID;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, colors.primary + "99"]}
        style={[styles.topBar, { paddingTop: topPadding + 8 }]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>طيباتي</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.tabToggle, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {(["login", "register"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && { backgroundColor: colors.primary }]}
                onPress={() => { setTab(t); setError(""); }}
              >
                <Text style={[styles.tabText, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
                  {t === "login" ? "تسجيل الدخول" : "إنشاء حساب"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.welcomeText, { color: colors.foreground }]}>
            {tab === "login" ? "أهلاً بعودتك" : "انضم إلى طيباتي"}
          </Text>
          <Text style={[styles.subText, { color: colors.mutedForeground }]}>
            {tab === "login"
              ? "سجّل دخولك للوصول لتحليلاتك المحفوظة"
              : "أنشئ حساباً لحفظ تحليلاتك"}
          </Text>

          {/* Google Sign-In */}
          {showGoogleBtn && (
            <>
              <TouchableOpacity
                style={[styles.googleBtn, {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: googleLoading ? 0.6 : 1,
                }]}
                onPress={handleGooglePress}
                disabled={googleLoading || loading}
                activeOpacity={0.75}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={[styles.googleText, { color: colors.foreground }]}>
                  {googleLoading ? "جاري التحقق..." : "تسجيل الدخول بـ Google"}
                </Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>أو</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
            </>
          )}

          {tab === "register" && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>الاسم</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="اسمك الكريم"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  textAlign="right"
                  autoCapitalize="words"
                />
                <Ionicons name="person-outline" size={18} color={colors.mutedForeground} />
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>البريد الإلكتروني</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="example@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                textAlign="right"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
              <Ionicons name="mail-outline" size={18} color={colors.mutedForeground} />
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "18", borderColor: colors.error + "40" }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={loading || googleLoading}
          >
            <Text style={styles.submitText}>
              {loading ? "جاري..." : tab === "login" ? "دخول" : "إنشاء الحساب"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
            بالاستمرار، توافق على{" "}
            <Text style={{ color: colors.primary }}>سياسة الخصوصية</Text>
            {" "}و{" "}
            <Text style={{ color: colors.primary }}>شروط الاستخدام</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  form: { padding: 24, gap: 16 },
  tabToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  welcomeText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
    marginTop: 8,
  },
  subText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    lineHeight: 22,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  googleIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  googleG: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#4285F4",
  },
  googleText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "right" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  privacyNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
