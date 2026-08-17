import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { Icon } from "@/components/Icon";

export interface ResultActionButtonsProps {
  onAnalyzeAnother: () => void;
  onGoHome: () => void;
  onShare?: () => void;
}

export const ResultActionButtons = React.memo(function ResultActionButtons({
  onAnalyzeAnother,
  onGoHome,
  onShare,
}: ResultActionButtonsProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomMargin = Math.max(insets.bottom + 12, 24);

  return (
    <View style={[styles.container, { marginBottom: bottomMargin }]}>
      {/* Primary Action Button */}
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={onAnalyzeAnother}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="تحليل وجبة أخرى"
      >
        <Icon name="refresh-outline" size={22} color={colors.primaryForeground} />
        <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>تحليل وجبة أخرى</Text>
      </TouchableOpacity>

      {/* Secondary Action Button */}
      <TouchableOpacity
        style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onGoHome}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="العودة للرئيسية"
      >
        <Icon name="home-outline" size={22} color={colors.foreground} />
        <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>العودة للرئيسية</Text>
      </TouchableOpacity>

      {/* Share Button (Optional extension) */}
      {onShare ? (
        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={onShare}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="مشاركة النتيجة"
        >
          <Icon name="share-social-outline" size={22} color={colors.foreground} />
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>مشاركة النتيجة</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 14,
    marginTop: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
});
