import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Icon } from "@/components/Icon";
import type { IngredientDecisionVM } from "@/lib/models/IngredientDecisionVM";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ResultIngredientListProps {
  ingredients: IngredientDecisionVM[];
  allAllowed?: boolean;
}

export const ResultIngredientList = React.memo(function ResultIngredientList({
  ingredients,
}: ResultIngredientListProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!ingredients || ingredients.length === 0) return null;

  const handleInfoPress = (item: IngredientDecisionVM, idx: number) => {
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    } catch {
      // Fallback if LayoutAnimation fails
    }
    setExpandedIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <View style={styles.card}>
      {/* 1. Card Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleGroup}>
          <Icon name="list-outline" size={20} color="#0F172A" />
          <Text style={styles.headerTitle}>المكونات المستخدمة</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{ingredients.length}</Text>
        </View>
      </View>

      {/* 2. Clean Ingredients Accordion List */}
      <View style={styles.listContainer}>
        {ingredients.map((item, idx) => {
          const isExpanded = expandedIndex === idx;
          const isAllowed = item.status === "allowed";
          const isConditional = item.status === "conditional";
          const isForbidden = item.status === "forbidden";

          const circleBg = isAllowed
            ? "#16A34A"
            : isConditional
            ? "#F59E0B"
            : isForbidden
            ? "#EF4444"
            : "#6B7280";

          const iconName = isAllowed
            ? "checkmark"
            : isConditional
            ? "remove"
            : isForbidden
            ? "close"
            : "help";

          const pillBg = isAllowed
            ? "#DCFCE7"
            : isConditional
            ? "#FEF3C7"
            : isForbidden
            ? "#FEE2E2"
            : "#F1F5F9";

          const pillTextColor = isAllowed
            ? "#16A34A"
            : isConditional
            ? "#D97706"
            : isForbidden
            ? "#DC2626"
            : "#64748B";

          const pillLabel = isAllowed
            ? "مسموح"
            : isConditional
            ? "مشروط"
            : isForbidden
            ? "غير مسموح"
            : "غير محدد";

          // Explanation background tints & divider
          const expBg = isAllowed
            ? "#F0FDF4"
            : isConditional
            ? "#FFFBEB"
            : isForbidden
            ? "#FEF2F2"
            : "#F8FAFC";

          const expBorder = isAllowed
            ? "#DCFCE7"
            : isConditional
            ? "#FEF3C7"
            : isForbidden
            ? "#FEE2E2"
            : "#E2E8F0";

          const expTextColor = isAllowed
            ? "#166534"
            : isConditional
            ? "#92400E"
            : isForbidden
            ? "#991B1B"
            : "#334155";

          const explanationText =
            item.reason?.trim() || "لا يتوفر شرح إضافي لهذا المكون في البيانات.";

          return (
            <View
              key={`${item.canonicalId || item.input}_${idx}`}
              style={[
                styles.itemWrapper,
                idx > 0 && styles.itemWrapperBorder,
                isExpanded && { backgroundColor: expBg, borderRadius: 14, marginVertical: 4 },
              ]}
            >
              {/* Collapsed / Header Row */}
              <TouchableOpacity
                style={styles.itemRow}
                onPress={() => handleInfoPress(item, idx)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${item.canonicalName || item.input}: ${pillLabel}`}
              >
                {/* Far Right in RTL: Status Circle Icon + Ingredient Name */}
                <View style={styles.rightGroup}>
                  <View style={[styles.statusCircle, { backgroundColor: circleBg }]}>
                    <Icon name={iconName as any} size={11} color="#FFFFFF" strokeWidth={3} />
                  </View>
                  <Text style={styles.ingredientName} numberOfLines={1}>
                    {item.canonicalName || item.input}
                  </Text>
                </View>

                {/* Middle: Status Pill */}
                <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
                  <Text style={[styles.statusPillText, { color: pillTextColor }]}>
                    {pillLabel}
                  </Text>
                </View>

                {/* Far Left in RTL: Accordion Chevron Button */}
                <View style={styles.leftGroup}>
                  <View style={[styles.expandIconBox, isExpanded && styles.expandIconBoxActive]}>
                    <Icon
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={isExpanded ? expTextColor : "#64748B"}
                    />
                  </View>
                </View>
              </TouchableOpacity>

              {/* Accordion Expanded Content: Divider + Data Explanation (Inline, no modal) */}
              {isExpanded && (
                <View style={[styles.accordionBody, { borderTopColor: expBorder }]}>
                  <Text style={[styles.accordionExplanationText, { color: expTextColor }]}>
                    {explanationText}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTitleGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
  },
  countBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
    color: "#64748B",
  },
  listContainer: {
    gap: 0,
  },
  itemWrapper: {
    overflow: "hidden",
  },
  itemWrapperBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  itemRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  rightGroup: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    flex: 1,
    justifyContent: "flex-start",
  },
  statusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientName: {
    fontSize: 14.5,
    fontFamily: "Tajawal_500Medium",
    color: "#0F172A",
    textAlign: "right",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontFamily: "Tajawal_700Bold",
  },
  leftGroup: {
    alignItems: "center",
    justifyContent: "center",
  },
  expandIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  expandIconBoxActive: {
    backgroundColor: "#FFFFFF",
  },
  accordionBody: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  accordionExplanationText: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
    lineHeight: 21,
  },
});
