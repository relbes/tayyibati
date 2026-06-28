import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { forgotPassword, resetPasswordWithCode } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const handleSendCode = async () => {
    setError("");
    setInfo("");
    const emailTrimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      setError("البريد الإلكتروني غير صحيح");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await forgotPassword(emailTrimmed);
      setStep("reset");
      setInfo("إذا كان البريد مسجّلاً، فقد أرسلنا رمز تحقق إليه. تحقق من بريدك.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError("");
    if (!code.trim() || code.trim().length < 6) {
      setError("أدخل رمز التحقق المكوّن من 6 أرقام");
      return;
    }
    if (newPassword.length < 4) {
      setError("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await resetPasswordWithCode(email.trim(), code.trim(), newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/auth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.primary, colors.primary + "99"]}
        style={[styles.topBar, { paddingTop: topPadding + 8 }]}
      >
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>استعادة كلمة المرور</Text>
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
          <Text style={[styles.welcomeText, { color: colors.foreground }]}>
            {step === "email" ? "نسيت كلمة المرور؟" : "أدخل الرمز"}
          </Text>
          <Text style={[styles.subText, { color: colors.mutedForeground }]}>
            {step === "email"
              ? "أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق لإعادة تعيين كلمة المرور."
              : "أدخل رمز التحقق المرسل إلى بريدك وكلمة المرور الجديدة."}
          </Text>

          {info ? (
            <View style={[styles.infoBox, { backgroundColor: colors.primary + "14", borderColor: colors.primary + "33" }]}>
              <Icon name="mail-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>{info}</Text>
            </View>
          ) : null}

          {step === "email" ? (
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
                  onSubmitEditing={handleSendCode}
                />
                <Icon name="mail-outline" size={18} color={colors.mutedForeground} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>رمز التحقق</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground, letterSpacing: 6 }]}
                    placeholder="000000"
                    placeholderTextColor={colors.mutedForeground}
                    value={code}
                    onChangeText={setCode}
                    textAlign="center"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <Icon name="keypad-outline" size={18} color={colors.mutedForeground} />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.foreground }]}>كلمة المرور الجديدة</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                    <Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="••••••••"
                    placeholderTextColor={colors.mutedForeground}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    textAlign="right"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    onSubmitEditing={handleReset}
                  />
                  <Icon name="lock-closed-outline" size={18} color={colors.mutedForeground} />
                </View>
              </View>
            </>
          )}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "18", borderColor: colors.error + "40" }]}>
              <Icon name="alert-circle-outline" size={16} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={step === "email" ? handleSendCode : handleReset}
            disabled={loading}
          >
            <Text style={styles.submitText}>
              {loading ? "جاري..." : step === "email" ? "إرسال الرمز" : "تعيين كلمة المرور"}
            </Text>
          </TouchableOpacity>

          {step === "reset" ? (
            <TouchableOpacity onPress={handleSendCode} disabled={loading}>
              <Text style={[styles.resendText, { color: colors.primary }]}>إعادة إرسال الرمز</Text>
            </TouchableOpacity>
          ) : null}
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
  topTitle: { fontSize: 18, fontFamily: "Tajawal_700Bold", color: "#fff" },
  form: { padding: 24, gap: 16 },
  welcomeText: {
    fontSize: 24,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    marginTop: 8,
  },
  subText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 22,
  },
  fieldGroup: { gap: 6 },
  label: { fontSize: 14, fontFamily: "Tajawal_500Medium", textAlign: "right" },
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
    fontFamily: "Tajawal_400Regular",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    flex: 1,
    textAlign: "right",
    lineHeight: 20,
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
    textAlign: "right",
  },
  submitBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontFamily: "Tajawal_700Bold", fontSize: 16 },
  resendText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textAlign: "center",
    marginTop: 4,
  },
});
