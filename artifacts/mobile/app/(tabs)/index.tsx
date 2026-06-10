import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  Animated,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeText, analyzeImage, getFoodStats } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";

interface FoodStats {
  total: number;
  allowed: number;
  forbidden: number;
  conditional: number;
  categories: number;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isAnalyzing, setIsAnalyzing } = useAnalysis();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState<FoodStats | null>(null);
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<TextInput>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;

  const topPadding = Platform.OS === "web" ? 20 : insets.top;

  useEffect(() => {
    getFoodStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (result) {
      Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    } else {
      cardAnim.setValue(0);
    }
  }, [result]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    setResult(null);
    try {
      const report = await analyzeText(query.trim(), user?.id);
      setResult(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [query, user?.id]);

  const handleCameraScan = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const lib = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7, base64: true });
      if (!lib.canceled && lib.assets[0]?.base64) {
        runImageAnalysis(lib.assets[0].base64, lib.assets[0].mimeType || "image/jpeg");
      }
      return;
    }
    const cam = await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.7, base64: true });
    if (!cam.canceled && cam.assets[0]?.base64) {
      let b64 = cam.assets[0].base64;
      if (b64?.startsWith("data:")) b64 = b64.split(",")[1] ?? b64;
      runImageAnalysis(b64, cam.assets[0].mimeType || "image/jpeg");
    }
  };

  const runImageAnalysis = async (base64: string, mimeType: string) => {
    setIsAnalyzing(true);
    setResult(null);
    try {
      const report = await analyzeImage(base64, mimeType, "food", user?.id);
      setResult(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay message="جاري التحليل..." />}

      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.primary + "E0"]}
        style={[styles.header, { paddingTop: topPadding + 12 }]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.profileBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Ionicons name={user ? "person" : "person-outline"} size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitle}>
            <Text style={styles.appName}>طيباتي</Text>
            <Text style={styles.appSub}>تحقق من توافق أي طعام</Text>
          </View>
        </View>

        {/* Hero Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: "#fff" }]}>
          <TouchableOpacity
            style={[styles.cameraBtn, { backgroundColor: colors.primary + "18" }]}
            onPress={handleCameraScan}
          >
            <Ionicons name="camera" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="ابحث أو أدخل اسم طعام أو مكوّن..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            textAlign="right"
            writingDirection="rtl"
          />
          <TouchableOpacity
            style={[styles.searchBtn, { backgroundColor: colors.primary, opacity: query.trim() ? 1 : 0.5 }]}
            onPress={handleSearch}
            disabled={!query.trim() || isAnalyzing}
          >
            <Ionicons name="search" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Quick tips row */}
        <View style={styles.tipsRow}>
          {["بيتزا", "E471", "جيلاتين", "هوت دوج"].map((tip) => (
            <Pressable
              key={tip}
              style={[styles.tipChip, { backgroundColor: "rgba(255,255,255,0.18)" }]}
              onPress={() => { setQuery(tip); setResult(null); }}
            >
              <Text style={styles.tipText}>{tip}</Text>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.content}>
        {result ? (
          <Animated.ScrollView
            style={{ transform: [{ scale: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }], opacity: cardAnim }}
            contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.resultHeader}>
              <TouchableOpacity onPress={() => { setResult(null); setQuery(""); }} style={[styles.clearBtn, { backgroundColor: colors.muted }]}>
                <Ionicons name="close" size={14} color={colors.mutedForeground} />
                <Text style={[styles.clearText, { color: colors.mutedForeground }]}>مسح النتيجة</Text>
              </TouchableOpacity>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>نتيجة التحليل</Text>
            </View>
            <AnalysisResultCard
              report={result}
              onRetry={() => { setResult(null); setQuery(""); }}
            />
          </Animated.ScrollView>
        ) : (
          <View style={styles.emptyState}>
            {/* Action Cards */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleCameraScan}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[colors.primary + "20", colors.primary + "08"]}
                  style={styles.actionGrad}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + "20" }]}>
                    <Ionicons name="camera" size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.foreground }]}>تحليل صورة</Text>
                  <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>صوّر الطعام أو الملصق</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push("/(tabs)/camera")}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[colors.accent + "20", colors.accent + "08"]}
                  style={styles.actionGrad}
                >
                  <View style={[styles.actionIconWrap, { backgroundColor: colors.accent + "20" }]}>
                    <Ionicons name="barcode" size={28} color={colors.accent} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.foreground }]}>قراءة ملصق</Text>
                  <Text style={[styles.actionDesc, { color: colors.mutedForeground }]}>مسح ملصق المنتج</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Stats strip */}
            {stats && (
              <View style={[styles.statsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: colors.primary }]}>{stats.total}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>مكون</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: colors.allowed }]}>{stats.allowed}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>مسموح</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: colors.forbidden }]}>{stats.forbidden}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>محظور</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Text style={[styles.statNum, { color: colors.conditional }]}>{stats.conditional}</Text>
                  <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>مشروط</Text>
                </View>
              </View>
            )}

            {/* History shortcut */}
            <TouchableOpacity
              style={[styles.historyLink, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(tabs)/history")}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={colors.mutedForeground} />
              <Text style={[styles.historyLinkText, { color: colors.foreground }]}>عرض سجل التحليلات</Text>
              <Ionicons name="time-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 14,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { alignItems: "flex-end", gap: 2 },
  appName: {
    fontSize: 26,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
    textAlign: "right",
  },
  appSub: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "right",
  },
  profileBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Tajawal_400Regular",
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 40,
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tipsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  tipChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tipText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
    color: "#fff",
  },
  content: { flex: 1 },
  emptyState: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  actionGrad: {
    padding: 18,
    gap: 10,
    alignItems: "center",
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  actionDesc: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
  },
  statsStrip: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontFamily: "Tajawal_700Bold" },
  statLbl: { fontSize: 11, fontFamily: "Tajawal_400Regular" },
  statDivider: { width: 1, height: 32 },
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  historyLinkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  clearText: {
    fontSize: 12,
    fontFamily: "Tajawal_500Medium",
  },
});
