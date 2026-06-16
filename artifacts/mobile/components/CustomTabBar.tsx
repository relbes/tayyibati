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

// RTL order: leftmost in array = rightmost on screen (flex row reversed by RTL)
const TABS: TabConfig[] = [
  { name: "index",   label: "الرئيسية", icon: "home-outline",   iconFocused: "home" },
  { name: "search",  label: "بحث",      icon: "search-outline",  iconFocused: "search" },
  { name: "camera",  label: "كاميرا",   icon: "camera-outline",  iconFocused: "camera", isCamera: true },
  { name: "history", label: "السجل",    icon: "time-outline",    iconFocused: "time" },
  { name: "profile", label: "حسابي",    icon: "person-outline",  iconFocused: "person" },
];

// Height of regular tab content area
const TAB_HEIGHT = 56;
// Extra space above the bar for the camera FAB to "float" into
const CAM_LIFT = 18;

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 4 : 0);

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: bottomPad,
          backgroundColor: "transparent",
          pointerEvents: "box-none" as any,
        },
      ]}
    >
      {/* The actual tab bar background — starts CAM_LIFT px below top of wrapper */}
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
          },
        ]}
      />

      {/* Tabs row — overlays the bar */}
      <View style={[styles.row, { pointerEvents: "box-none" as any }]}>
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
                  android_ripple={{ color: "rgba(255,255,255,0.25)", borderless: false }}
                >
                  <Ionicons
                    name={isFocused ? "camera" : "camera-outline"}
                    size={26}
                    color="#fff"
                  />
                </Pressable>
                <Text
                  style={[
                    styles.camLabel,
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
              {/* active indicator dot above icon */}
              <View
                style={[
                  styles.dot,
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
                    fontFamily: isFocused
                      ? "Tajawal_700Bold"
                      : "Tajawal_400Regular",
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
    // Total height = bar height + lift for FAB
    height: TAB_HEIGHT + CAM_LIFT,
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_HEIGHT,
    top: CAM_LIFT,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  row: {
    flexDirection: "row",
    height: TAB_HEIGHT + CAM_LIFT,
    alignItems: "flex-end",
    paddingBottom: 6,
  },
  tabCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
    gap: 2,
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    textAlign: "center",
  },
  camCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 2,
    gap: 4,
  },
  camBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#1B7A5E",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    marginBottom: 2,
  },
  camBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.94 }],
  },
  camLabel: {
    fontSize: 10,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
  },
});
