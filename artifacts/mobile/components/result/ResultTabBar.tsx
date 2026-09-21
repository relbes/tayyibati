import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";

export interface ResultTabBarProps {
  activeTab?: "index" | "search" | "camera" | "history" | "profile";
}

interface TabConfig {
  name: "index" | "search" | "camera" | "history" | "profile";
  label: string;
  icon: string;
  iconFocused: string;
  isCenter?: boolean;
}

const TABS: TabConfig[] = [
  { name: "index", label: "الرئيسية", icon: "home-outline", iconFocused: "home" },
  { name: "search", label: "البحث", icon: "search-outline", iconFocused: "search" },
  { name: "camera", label: "", icon: "camera", iconFocused: "camera", isCenter: true },
  { name: "history", label: "السجل", icon: "time-outline", iconFocused: "time" },
  { name: "profile", label: "حسابي", icon: "person-outline", iconFocused: "person" },
];

const PRIMARY = "#16A34A";
const INACTIVE = "#64748B";

export const ResultTabBar = React.memo(function ResultTabBar({
  activeTab = "index",
}: ResultTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rtl = isRTL();

  const bottomPad = Math.max(insets.bottom, 8);

  const handleTabPress = (name: TabConfig["name"]) => {
    try {
      if (name === "index") {
        router.replace("/(tabs)");
      } else {
        router.replace(`/(tabs)/${name}` as any);
      }
    } catch {
      router.navigate("/(tabs)" as any);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPad,
          flexDirection: rtl ? "row-reverse" : "row",
        },
      ]}
    >
      {TABS.map((tab) => {
        const isFocused = activeTab === tab.name;
        const color = isFocused ? PRIMARY : INACTIVE;

        if (tab.isCenter) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.centerTab}
              onPress={() => handleTabPress(tab.name)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="الكاميرا"
            >
              <View style={styles.centerButtonWrapper}>
                {/* Outer halo ring */}
                <View style={styles.centerButtonOuter}>
                  {/* Inner green floating button */}
                  <View style={styles.centerButtonInner}>
                    <Icon name="camera" size={26} color="#FFFFFF" strokeWidth={2} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handleTabPress(tab.name)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <View style={styles.tabContent}>
              <Icon
                name={isFocused ? (tab.iconFocused as any) : (tab.icon as any)}
                size={23}
                color={color}
                strokeWidth={isFocused ? 2.2 : 1.8}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color,
                    fontFamily: isFocused ? "Tajawal_700Bold" : "Tajawal_500Medium",
                    fontSize: 12,
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {isFocused ? (
                <View style={styles.activeDot} />
              ) : (
                <View style={styles.dotPlaceholder} />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 6,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
    overflow: "visible",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
    minWidth: 46,
  },
  label: {
    fontSize: 12,
    textAlign: "center",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
    marginTop: 2,
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
    marginTop: 2,
  },
  centerTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
    zIndex: 10,
  },
  centerButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    position: "relative",
  },
  centerButtonOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#DCFCE7",
  },
  centerButtonInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
});
