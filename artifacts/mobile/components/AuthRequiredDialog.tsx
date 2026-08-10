import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { Icon } from "@/components/Icon";

interface AuthRequiredDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthRequiredDialog({ visible, onClose }: AuthRequiredDialogProps) {
  const colors = useColors();
  const router = useRouter();

  const handleRegister = () => {
    onClose();
    router.push({ pathname: "/auth", params: { tab: "register" } });
  };

  const handleLogin = () => {
    onClose();
    router.push({ pathname: "/auth", params: { tab: "login" } });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + "18" }]}>
            <Icon name="lock-closed" size={32} color={colors.primary} />
          </View>
          
          <Text style={[styles.title, { color: colors.foreground }]}>أنشئ حساباً مجانياً</Text>
          
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            لحفظ تحليلاتك والحصول على ميزات بحث وصور اكثر
          </Text>

          <View style={styles.btnStack}>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleRegister} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>إنشاء حساب</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]} onPress={handleLogin} activeOpacity={0.8}>
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>تسجيل الدخول</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.dismissBtnText, { color: colors.mutedForeground }]}>لاحقاً</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  box: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
    marginTop: 4,
  },
  message: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  btnStack: {
    width: "100%",
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
  secondaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
  dismissBtn: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissBtnText: {
    fontFamily: "Tajawal_500Medium",
    fontSize: 14,
  },
});
