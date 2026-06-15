import { Tabs } from "expo-router";
import React from "react";
import { CustomTabBar } from "@/components/CustomTabBar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* RTL: declared right-to-left so home is rightmost in the bar */}
      <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
      <Tabs.Screen name="search" options={{ title: "بحث" }} />
      <Tabs.Screen name="camera" options={{ title: "كاميرا" }} />
      <Tabs.Screen name="history" options={{ title: "السجل" }} />
      <Tabs.Screen name="profile" options={{ title: "حسابي" }} />
    </Tabs>
  );
}
