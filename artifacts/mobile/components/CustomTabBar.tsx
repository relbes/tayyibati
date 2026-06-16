import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  label: string;
  icon: IoniconName;
  iconFocused: IoniconName;
  isCamera?: boolean;
}

const TABS: TabConfig[] = [
  { name: "index",   label: "الرئيسية", icon: "home-outline",   iconFocused: "home" },
  { name: "search",  label: "بحث",      icon: "search-outline",  iconFocused: "search" },
  { name: "camera",  label: "كاميرا",   icon: "camera-outline",  iconFocused: "camera", isCamera: true },
  { name: "history", label: "السجل",    icon: "time-outline",    iconFocused: "time" },
  { name: "profile", label: "حسابي",    icon: "person-outline",  iconFocused: "person" },
];

const TAB_HEIGHT = 60;

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  // Reliable bottom padding: respect safe area but cap it, add fixed Android floor
  const bottomPad = Platform.OS === "android"
    ? 8
    : Math.max(insets.bottom, 4);

  // Use a lighter background in dark mode so the tab bar is visually distinct
  const barBg = scheme === "dark" ? "#1E2D27" : "#FFFFFF";
  const borderColor = scheme === "dark" ? "#2A3D35" : "#E0EBE5";

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: bottomPad,
          backgroundColor: barBg,
          borderTopColor: borderColor,
        },
      ]}
    >
      <View style={styles.row}>
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            if (routeIndex === -1) return;
            const event = navigation.emit({
              type: "tabPress",
              target: state.routes[routeIndex]?.key ?? "",
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          if (tab.isCamera) {
            return (
              <View key={tab.name} style={styles.camCol}>
                <Pressable
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.camBtn,
                    { backgroundColor: colors.primary },
                    pressed && styles.camBtnPressed,
                  ]}
                  android_ripple={{ color: "rgba(255,255,255,0.3)", borderless: false }}
                >
                  <Ionicons
                    name={isFocused ? "camera" : "camera-outline"}
                    size={26}
                    color="#fff"
                  />
                </Pressable>
                <Text
                  style={[
                    styles.label,
                    { color: isFocused ? colors.primary : colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabCol}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.indicator,
                  { backgroundColor: isFocused ? colors.primary : "transparent" },
                ]}
              />
              <Ionicons
                name={isFocused ? tab.iconFocused : tab.icon}
                size={22}
                color={isFocused ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? colors.primary : colors.mutedForeground,
                    fontFamily: isFocused ? "Tajawal_700Bold" : "Tajawal_400Regular",
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  row: {
    flexDirection: "row",
    height: TAB_HEIGHT,
    alignItems: "center",
  },
  tabCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  indicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginBottom: 2,
  },
  label: {
    fontSize: 10,
    textAlign: "center",
  },
  camCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  camBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#1B7A5E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    marginTop: -16,
  },
  camBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.93 }],
  },
});
