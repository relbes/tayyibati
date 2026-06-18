import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import type { IngredientResult } from "@/context/AnalysisContext";

interface IngredientChipProps {
  ingredient: IngredientResult;
}

const STATUS_LABELS: Record<string, string> = {
  allowed: "مسموح",
  forbidden: "ممنوع",
  conditional: "مشروط",
  unknown: "غير معروف",
};

export function IngredientChip({ ingredient }: IngredientChipProps) {
  const colors = useColors();
  const [modalVisible, setModalVisible] = useState(false);

  const config = {
    allowed: { bg: colors.allowed + "18", border: colors.allowed + "40", text: colors.allowed, icon: "checkmark-circle" as const },
    forbidden: { bg: colors.forbidden + "18", border: colors.forbidden + "40", text: colors.forbidden, icon: "close-circle" as const },
    conditional: { bg: colors.conditional + "18", border: colors.conditional + "40", text: colors.conditional, icon: "alert-circle" as const },
    unknown: { bg: colors.unknown + "18", border: colors.unknown + "40", text: colors.unknown, icon: "help-circle" as const },
  };

  const c = config[ingredient.status];

  const frequencyLabels: Record<string, string> = {
    basic: "أساسي",
    daily: "يوميًا",
    weekly: "أسبوعيًا",
    occasional: "أحيانًا",
  };
  const freqLabel =
    ingredient.status === "allowed" && ingredient.frequency
      ? frequencyLabels[ingredient.frequency]
      : null;

  const hasDetail = !!(ingredient.reason || ingredient.notes);

  return (
    <>
      <TouchableOpacity
        onPress={() => hasDetail && setModalVisible(true)}
        activeOpacity={hasDetail ? 0.7 : 1}
        style={[styles.chip, { backgroundColor: c.bg, borderColor: c.border }]}
      >
        <Icon name={c.icon} size={14} color={c.text} />
        <Text style={[styles.text, { color: c.text }]}>{ingredient.nameAr || ingredient.name}</Text>
        {freqLabel && (
          <View style={[styles.freqBadge, { backgroundColor: c.text + "22" }]}>
            <Text style={[styles.freqText, { color: c.text }]}>{freqLabel}</Text>
          </View>
        )}
        {hasDetail && (
          <Icon name="information-circle-outline" size={13} color={c.text + "99"} />
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.statusBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
              <Icon name={c.icon} size={16} color={c.text} />
              <Text style={[styles.statusLabel, { color: c.text }]}>
                {STATUS_LABELS[ingredient.status]}
              </Text>
            </View>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {ingredient.nameAr || ingredient.name}
            </Text>
            {ingredient.name && ingredient.name !== ingredient.nameAr && (
              <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                {ingredient.name}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.muted }]}
              onPress={() => setModalVisible(false)}
            >
              <Icon name="close" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {ingredient.reason && (
              <View style={[styles.section, { borderBottomColor: colors.border }]}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>الحكم</Text>
                <Text style={[styles.sectionText, { color: colors.foreground }]}>
                  {ingredient.reason}
                </Text>
              </View>
            )}
            {ingredient.notes && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>تفاصيل وملاحظات</Text>
                <Text style={[styles.sectionText, { color: colors.foreground }]}>
                  {ingredient.notes}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  text: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
  freqBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  freqText: {
    fontSize: 10,
    fontFamily: "Tajawal_700Bold",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetHeader: {
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    alignItems: "flex-end",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    marginTop: 2,
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "right",
  },
  sectionText: {
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 26,
    textAlign: "right",
  },
});
