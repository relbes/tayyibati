import { Tabs } from "expo-router";
import React from "react";
import { CustomTabBar } from "@/components/CustomTabBar";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FirstRunAcknowledgment } from "@/components/FirstRunAcknowledgment";

export default function TabLayout() {
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("tayyibati_disclaimer_version").then(val => {
      setIsDisclaimerAccepted(val === "1");
    });
  }, []);

  if (isDisclaimerAccepted === null) return null; // loading state

  if (!isDisclaimerAccepted) {
    return <FirstRunAcknowledgment onAccept={() => {
      AsyncStorage.setItem("tayyibati_disclaimer_version", "1");
      setIsDisclaimerAccepted(true);
    }} />;
  }

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
      <Tabs.Screen name="browse" options={{ title: "قائمة المسموح والممنوع", href: null }} />
    </Tabs>
  );
}
