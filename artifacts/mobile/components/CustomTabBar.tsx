import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { Icon } from "@/components/Icon";
import { isRTL } from "@/lib/i18n";

interface NavRoute { key: string; name: string }
interface NavState { index: number; routes: NavRoute[] }
interface BottomTabBarProps { state: NavState; navigation: any }

interface TabConfig {
  name: string;
  label: string;
  icon: string;
  iconFocused: string;
  isCamera?: boolean;
}

const TABS: TabConfig[] = [
  { name: "index",   label: "الرئيسية", icon: "home-outline",   iconFocused: "home" },
  { name: "search",  label: "بحث",      icon: "search-outline",  iconFocused: "search" },
  { name: "camera",  label: "كاميرا",   icon: "camera-outline",  iconFocused: "camera", isCamera: true },
  { name: "history", label: "السجل",    icon: "time-outline",    iconFocused: "time" },
  { name: "profile", label: "حسابي",    icon: "person-outline",  iconFocused: "person" },
];

const PRIMARY = "#15803D";
const PRIMARY_DARK = "#4DC49A";

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const rtl = isRTL();

  const isDark = scheme === "dark";
  const barBg = isDark ? "#1A2622" : "#FFFFFF";
  const borderColor = isDark ? "#2A3D35" : "#E5EFE9";
  const activeColor = isDark ? PRIMARY_DARK : PRIMARY;
  const inactiveColor = isDark ? "#7A8C85" : "#6B7280";
  const bottomPad = Math.max(insets.bottom + 8, 14);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: barBg,
          borderTopColor: borderColor,
          paddingBottom: bottomPad,
          flexDirection: rtl ? "row-reverse" : "row",
        },
      ]}
    >
      {TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r: NavRoute) => r.name === tab.name);
        const isFocused = state.index === routeIndex;
        const color = isFocused ? activeColor : inactiveColor;

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
            <TouchableOpacity
              key={tab.name}
              style={styles.tabCamera}
              onPress={onPress}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.cameraFab,
                  {
                    backgroundColor: activeColor,
                    shadowColor: activeColor,
                  },
                ]}
              >
                <Icon
                  name={isFocused ? "camera" : "camera-outline"}
                  size={30}
                  color="#ffffff"
                  strokeWidth={2}
                />
              </View>
              <Text
                style={[
                  styles.cameraLabel,
                  {
                    color: isFocused ? activeColor : inactiveColor,
                    fontFamily: isFocused ? "Tajawal_700Bold" : "Tajawal_500Medium",
                  },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <Icon
              name={isFocused ? tab.iconFocused : tab.icon}
              size={25}
              color={color}
              strokeWidth={isFocused ? 2.2 : 1.5}
            />
            <Text
              style={[
                styles.label,
                {
                  color,
                  fontFamily: isFocused ? "Tajawal_700Bold" : "Tajawal_500Medium",
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
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    alignItems: "flex-end",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 6,
    gap: 3,
    minHeight: 66,
  },
  tabCamera: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 6,
    minHeight: 66,
  },
  cameraFab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    marginBottom: 3,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  cameraLabel: {
    fontSize: 14.5,
    textAlign: "center",
  },
  label: {
    fontSize: 14.5,
    textAlign: "center",
  },
});
