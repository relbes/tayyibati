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

const PRIMARY = "#1B7A5E";
const PRIMARY_DARK = "#4DC49A";

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const isDark = scheme === "dark";
  const barBg = isDark ? "#1A2622" : "#FFFFFF";
  const borderColor = isDark ? "#2A3D35" : "#E5EFE9";
  const activeColor = isDark ? PRIMARY_DARK : PRIMARY;
  const inactiveColor = isDark ? "#5A7870" : "#8A9B95";
  const bottomPad = Platform.OS === "android" ? 6 : Math.max(insets.bottom, 4);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: barBg,
          borderTopColor: borderColor,
          paddingBottom: bottomPad,
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
              style={styles.tab}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.cameraCircle,
                  { backgroundColor: isFocused ? activeColor : (isDark ? "#1E2F28" : "#EAF3EF") },
                ]}
              >
                <Icon
                  name={isFocused ? "camera" : "camera-outline"}
                  size={26}
                  color={isFocused ? "#fff" : activeColor}
                  strokeWidth={1.8}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color,
                    fontFamily: isFocused ? "Tajawal_700Bold" : "Tajawal_400Regular",
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
              size={24}
              color={color}
              strokeWidth={isFocused ? 2.5 : 1.5}
            />
            <Text
              style={[
                styles.label,
                {
                  color,
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 4,
    gap: 4,
    minHeight: 62,
  },
  cameraCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -8,
  },
  label: {
    fontSize: 11,
    textAlign: "center",
  },
});
