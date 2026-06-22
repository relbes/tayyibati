import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { getUserUsage } from "@/lib/api";
import { Icon } from "@/components/Icon";

interface UsageInfo {
  monthlyTextCount: number;
  monthlyImageCount: number;
  textLimit: number;
  imageLimit: number;
  isPremium: boolean;
}

interface Props {
  type: "text" | "image";
}

const WARN_THRESHOLD = 0.8;

export function UsageWarningBanner({ type }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDismissed(false);
    getUserUsage()
      .then((u) => setUsage(u))
      .catch(() => {});
  }, [user]);

  if (!user || dismissed || !usage) return null;
  if (usage.isPremium) return null;

  const count = type === "text" ? usage.monthlyTextCount : usage.monthlyImageCount;
  const limit = type === "text" ? usage.textLimit : usage.imageLimit;

  if (limit <= 0) return null;

  const ratio = count / limit;
  if (ratio < WARN_THRESHOLD) return null;

  const remaining = Math.max(limit - count, 0);
  const isExhausted = remaining === 0;

  const label = type === "text" ? "النصية" : "الصورية";
  const warningColor = isExhausted ? colors.error : "#d97706";

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: warningColor + "15",
          borderColor: warningColor + "45",
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: warningColor }]}>
            {isExhausted
              ? `انتهت عمليات البحث ${label} لهذا الشهر`
              : `تبقّى لك ${remaining} من ${limit} عمليات بحث ${label}`}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {isExhausted
              ? "تجدّد في أول الشهر القادم — أو اشترك للوصول غير المحدود"
              : "اشترك في بريميوم للحصول على وصول غير محدود"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="close" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.upgradeBtn, { backgroundColor: warningColor }]}
        onPress={() => router.push("/pricing")}
        activeOpacity={0.8}
      >
        <Text style={styles.upgradeBtnText}>اشترك الآن</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  textBlock: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  sub: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 18,
  },
  closeBtn: {
    paddingTop: 2,
  },
  upgradeBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  upgradeBtnText: {
    color: "#fff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 13,
  },
});
