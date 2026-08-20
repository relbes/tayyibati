import { I18nManager } from "react-native";
import { isRTL } from "@/lib/i18n";
import { TayyibatiTheme } from "@/constants/tayyibatiTheme";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import { BackButton } from "@/components/BackButton";
import { HeaderNatureBackground } from "@/components/HeaderNatureBackground";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { AuthError } from "@/lib/api";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const domain =
  process.env.EXPO_PUBLIC_DOMAIN?.trim() || "api.tayyibati.xyz";

const BASE_URL =
  domain.startsWith("http://") || domain.startsWith("https://")
    ? domain
    : `https://${domain}`;

async function fetchGoogleLoginEnabled(): Promise<boolean> {
  try {
   const res = await fetch(`${BASE_URL}/api/config/public`);
    if (!res.ok) return false;
    const config = await res.json();
    return config.google_login_enabled === "true";
  } catch {
    return false;
  }
}

function getGoogleClientId(): string {
  if (Platform.OS === "ios" && GOOGLE_IOS_CLIENT_ID) return GOOGLE_IOS_CLIENT_ID;
  if (Platform.OS === "android" && GOOGLE_ANDROID_CLIENT_ID) return GOOGLE_ANDROID_CLIENT_ID;
  return GOOGLE_WEB_CLIENT_ID || "not-configured";
}

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, registerWithPassword, loginWithPassword } = useAuth();
  const { tab: paramTab } = useLocalSearchParams<{ tab?: "login" | "register" }>();
  const [tab, setTab] = useState<"login" | "register">(paramTab === "register" ? "register" : "login");

  useEffect(() => {
    if (paramTab === "login" || paramTab === "register") {
      setTab(paramTab);
    }
  }, [paramTab]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedSecondsLeft, setLockedSecondsLeft] = useState<number | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const redirectUri = AuthSession.makeRedirectUri({ scheme: "tayyibati", path: "auth" });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: getGoogleClientId(),
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Token,
    },
    GOOGLE_DISCOVERY,
  );

  useEffect(() => {
    fetchGoogleLoginEnabled().then(setGoogleEnabled);
  }, []);

  useEffect(() => {
    if (lockedSecondsLeft === null || lockedSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setLockedSecondsLeft((s) => {
        if (s === null || s <= 1) { clearInterval(timer); return null; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedSecondsLeft !== null]);

  useEffect(() => {
    if (response?.type === "success") {
      const accessToken = (response.params as Record<string, string>).access_token ?? "";
      handleGoogleSuccess(accessToken);
    } else if (response?.type === "error") {
      setGoogleLoading(false);
      setError("فشل تسجيل الدخول بـ Google. حاول مجدداً.");
    }
  }, [response]);

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
      setError("Google Sign-In is not configured.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoogleLoading(true);
    setError("");
    await promptAsync();
  };

  const handleSubmit = async () => {
    setError("");
    setRemainingAttempts(null);
    setLockedSecondsLeft(null);
    const emailTrimmed = email.trim();
    const nameTrimmed = name.trim();
    if (!emailTrimmed) { setError("البريد الإلكتروني مطلوب"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) { setError("البريد الإلكتروني غير صحيح"); return; }
    if (tab === "register" && !nameTrimmed) { setError("الاسم مطلوب"); return; }
    if (!password) { setError("كلمة المرور مطلوبة"); return; }
    if (password.length < 4) { setError("كلمة المرور يجب أن تكون 4 أحرف على الأقل"); return; }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (tab === "register") {
        await registerWithPassword(emailTrimmed, nameTrimmed || emailTrimmed.split("@")[0], password);
      } else {
        await loginWithPassword(emailTrimmed, password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (tab === "register") {
        setError("هذا البريد الإلكتروني مسجل مسبقاً.\n\nيمكنك تسجيل الدخول أو استخدام \"نسيت كلمة المرور\".");
      } else if (e instanceof AuthError) {
        if (e.status === 423) {
          setError("تم تعطيل تسجيل الدخول مؤقتاً، حاول مرة أخرى لاحقاً.");
        } else {
          if (typeof e.remainingAttempts === "number") {
            setRemainingAttempts(e.remainingAttempts);
          }
          setError("كلمة المرور غير صحيحة");
        }
      } else {
        setError(e instanceof Error ? e.message : "حدث خطأ. حاول مجدداً.");
      }
    } finally {
      setLoading(false);
    }
  };

  const showGoogleBtn = googleEnabled && !!GOOGLE_WEB_CLIENT_ID;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.topBar, { paddingTop: topPadding + 10, backgroundColor: "#11674e", borderBottomColor: "#0D523E", borderBottomWidth: 1 }]}
      >
        <HeaderNatureBackground />
        <View style={{ width: 40 }} />
        <Text style={[styles.topTitle, { color: "#f3f6f4" }]}>طيباتي</Text>
        <BackButton />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
       <ScrollView
           contentContainerStyle={[
               styles.form,
               {
                   paddingBottom: insets.bottom + 40,
                   alignItems: "stretch",
               },
           ]}
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

          <Text
            style={[
              styles.welcomeText,
              {
                color: colors.foreground,
              },
            ]}
          >
            {tab === "login" ? "أهلاً بعودتك" : "انضم إلى طيباتي"}
          </Text>
         <Text
           style={[
             styles.subText,
             {
               color: colors.mutedForeground,
             },
           ]}
         >
            {tab === "login"
  ? "سجّل دخولك لبدء البحث"
  : "أنشئ حساباً لبدء البحث وحفظ تحليلاتك"}
</Text>

          {showGoogleBtn && (
            <>
              <TouchableOpacity
                style={[styles.googleBtn, {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: googleLoading ? 0.6 : 1,
                }]}
                onPress={handleGooglePress}
                disabled={googleLoading || loading || !request}
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
                <Icon name="person-outline" size={18} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="اسمك الكريم"
                  placeholderTextColor={colors.mutedForeground}
                  value={name}
                  onChangeText={setName}
                  textAlign={isRTL() ? "right" : "left"}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>البريد الإلكتروني</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="mail-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="example@email.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                textAlign={isRTL() ? "right" : "left"}
                keyboardType="email-address"

                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.foreground }]}>كلمة المرور</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Icon name="lock-closed-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                textAlign={isRTL() ? "right" : "left"}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {tab === "login" ? (
            <TouchableOpacity onPress={() => router.push("/forgot-password")}>
              <Text style={[styles.forgotText, { color: colors.primary }]}>نسيت كلمة المرور؟</Text>
            </TouchableOpacity>
          ) : null}



          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "18", borderColor: colors.error + "40" }]}>
              <Icon name="alert-circle-outline" size={16} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                {remainingAttempts !== null && remainingAttempts > 0 ? (
                  <Text style={[styles.attemptsText, { color: colors.error + "cc" }]}>
                    {`تبقّى ${remainingAttempts} ${remainingAttempts === 1 ? "محاولة" : "محاولات"} قبل إغلاق حسابك مؤقتاً`}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <TouchableOpacity
              style={[
                  styles.submitBtn,
                  {
                      backgroundColor: colors.primary,
                      opacity: loading ? 0.6 : 1,
                  },
              ]}
              onPress={handleSubmit}
              disabled={loading || googleLoading}
          >
            <Text style={styles.submitText}>
              {loading ? "جاري..." : tab === "login" ? "دخول" : "إنشاء الحساب"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchTabBtn}
            onPress={() => {
              setTab(tab === "login" ? "register" : "login");
              setError("");
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.switchTabText, { color: colors.primary }]}>
              {tab === "login" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب بالفعل؟ تسجيل الدخول"}
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
  topTitle: { fontSize: 26, fontFamily: "Tajawal_700Bold", color: "#fff" },
  form: {
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 40,
      gap: 22,
  },
  tabToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  tabText: { fontSize: 14, fontFamily: "Tajawal_700Bold" },
  welcomeText: {
      width: "100%",
      textAlign: isRTL() ? "right" : "left",
      fontSize: 32,
      fontFamily: "Tajawal_700Bold",
  },
  subText: {
      width: "100%",
      textAlign: isRTL() ? "right" : "left",
      fontSize: 16,
      lineHeight: 24,
      fontFamily: "Tajawal_400Regular",
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
  googleG: { fontSize: 14, fontFamily: "Tajawal_700Bold", color: "#4285F4" },
  googleText: { fontSize: 15, fontFamily: "Tajawal_700Bold" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Tajawal_400Regular" },
  fieldGroup: {
       gap: 8,
       marginTop: 4,
   },
  label: { fontSize: 14, fontFamily: "Tajawal_500Medium", textAlign: isRTL() ? "right" : "left", width: "100%" },
  inputWrap: {
      flexDirection: isRTL() ? "row-reverse" : "row",
      alignItems: "center",

      width: "100%",

      borderRadius: 12,
      borderWidth: 1,

      paddingHorizontal: 16,
      paddingVertical: 2,

      gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Tajawal_400Regular",
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
    fontFamily: "Tajawal_400Regular",
    flex: 1,
    textAlign: isRTL() ? "right" : "left",
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontFamily: "Tajawal_700Bold", fontSize: 16 },
  lockoutBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  lockoutTextCol: { flex: 1, gap: 4 },
  lockoutTitle: { fontSize: 14, fontFamily: "Tajawal_700Bold", textAlign: isRTL() ? "right" : "left" },
  lockoutBody: { fontSize: 13, fontFamily: "Tajawal_400Regular", textAlign: isRTL() ? "right" : "left", lineHeight: 20 },
  attemptsText: { fontSize: 12, fontFamily: "Tajawal_400Regular", textAlign: isRTL() ? "right" : "left", marginTop: 3 },
  forgotText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textAlign: isRTL() ? "right" : "left",
    marginTop: -4,
  },
  privacyNote: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  switchTabBtn: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTabText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textAlign: "center",
  },
});
