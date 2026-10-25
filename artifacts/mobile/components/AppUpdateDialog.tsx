import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";

export interface AppUpdateDialogProps {
  visible: boolean;
  latestVersion: string;
  installedVersion: string;
  releaseNotes?: string;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function AppUpdateDialog({
  visible,
  latestVersion,
  installedVersion,
  releaseNotes,
  onUpdate,
  onDismiss,
}: AppUpdateDialogProps) {
  const colors = useColors();
  const rtl = isRTL();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header Icon Badge */}
          <View style={[styles.iconContainer, { backgroundColor: "#E8F5E9" }]}>
            <Icon name="arrow-up-circle" size={36} color="#15803D" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            تحديث جديد متوفر
          </Text>

          {/* Version Pills */}
          <View style={[styles.versionRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <View style={[styles.versionBadge, { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" }]}>
              <Text style={[styles.versionBadgeText, { color: "#15803D" }]}>
                الإصدار الجديد: {latestVersion}
              </Text>
            </View>
            <View style={[styles.versionBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.versionBadgeText, { color: colors.mutedForeground }]}>
                الحالي: {installedVersion}
              </Text>
            </View>
          </View>

          {/* Message */}
          <Text style={[styles.message, { color: colors.mutedForeground }]}>
            يتوفر إصدار جديد من تطبيق طيباتي. حدّث التطبيق للحصول على أحدث التحسينات.
          </Text>

          {/* Release Notes if provided */}
          {Boolean(releaseNotes) && (
            <View style={[styles.notesBox, { backgroundColor: "#F8FEF9", borderColor: "#E2E8F0" }]}>
              <Text style={[styles.notesText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
                {releaseNotes}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonStack}>
            {/* Primary Action Button: "تحديث الآن" */}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: "#15803D", flexDirection: rtl ? "row-reverse" : "row" }]}
              onPress={onUpdate}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="تحديث الآن"
            >
              <Icon name="download-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>تحديث الآن</Text>
            </TouchableOpacity>

            {/* Secondary Action Button: "لاحقًا" */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onDismiss}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="لاحقًا"
            >
              <Text style={[styles.secondaryBtnText, { color: colors.mutedForeground }]}>
                لاحقًا
              </Text>
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
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  versionRow: {
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  versionBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
  message: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  notesBox: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notesText: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 18,
  },
  buttonStack: {
    width: "100%",
    gap: 10,
    marginTop: 6,
  },
  primaryBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  secondaryBtn: {
    width: "100%",
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
  },
});
