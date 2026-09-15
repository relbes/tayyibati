import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  isCenter?: boolean;
}

const TABS: TabConfig[] = [
  { name: "index",   label: "الرئيسية", icon: "home-outline",   iconFocused: "home" },
  { name: "search",  label: "البحث",    icon: "search-outline", iconFocused: "search" },
  { name: "camera",  label: "",         icon: "camera",         iconFocused: "camera", isCenter: true },
  { name: "history", label: "السجل",    icon: "time-outline",   iconFocused: "time" },
  { name: "profile", label: "الملف الشخصي", icon: "person-outline", iconFocused: "person" },
];

const PRIMARY = "#008C5A";
const INACTIVE = "#475569";

export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const rtl = isRTL();

  const bottomPad = Math.max(insets.bottom, 8);

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
        const routeIndex = state.routes.findIndex((r: NavRoute) => r.name === tab.name);
        const isFocused = state.index === routeIndex;
        const color = isFocused ? PRIMARY : INACTIVE;

        const onPress = () => {
          if (routeIndex === -1) {
            navigation.navigate(tab.name);
            return;
          }
          const event = navigation.emit({
            type: "tabPress",
            target: state.routes[routeIndex]?.key ?? "",
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        // Render Centered Popped Camera Button
        if (tab.isCenter) {
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.centerTab}
              onPress={onPress}
              activeOpacity={0.85}
            >
              <View style={styles.centerButtonWrapper}>
                {/* Decorative top accent rays */}
                <View style={styles.centerRays}>
                  <View style={styles.rayLeft} />
                  <View style={styles.rayCenter} />
                  <View style={styles.rayRight} />
                </View>

                {/* Outer glowing ring */}
                <View style={styles.centerButtonOuter}>
                  {/* Inner green floating button */}
                  <View style={styles.centerButtonInner}>
                    <Icon
                      name="camera"
                      size={26}
                      color="#FFFFFF"
                      strokeWidth={2}
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        // Render Standard Tab
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.75}
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
                    fontSize: tab.name === "profile" ? 10.5 : 12,
                    letterSpacing: tab.name === "profile" ? -0.3 : 0,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={tab.name === "profile"}
                minimumFontScale={0.8}
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
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
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
    minHeight: 56,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingVertical: 2,
    gap: 2,
    minWidth: 46,
  },
  label: {
    fontSize: 12,
    textAlign: "center",
  },
  activeDot: {
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: PRIMARY,
    marginTop: 2,
  },
  dotPlaceholder: {
    width: 4.5,
    height: 4.5,
    marginTop: 2,
  },
  centerTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
    zIndex: 10,
  },
  centerButtonWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    position: "relative",
  },
  centerRays: {
    position: "absolute",
    top: -9,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 6,
    zIndex: 12,
  },
  rayCenter: {
    width: 3,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: PRIMARY,
  },
  rayLeft: {
    width: 3,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: PRIMARY,
    transform: [{ rotate: "-28deg" }],
  },
  rayRight: {
    width: 3,
    height: 6,
    borderRadius: 1.5,
    backgroundColor: PRIMARY,
    transform: [{ rotate: "28deg" }],
  },
  centerButtonOuter: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#E6F6F0",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#A3E2CB",
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
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
});

