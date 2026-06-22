import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Icon } from "@/components/Icon";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeImage, analyzeText, AnalysisError } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { UsageWarningBanner } from "@/components/UsageWarningBanner";

export default function CameraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isAnalyzing, setIsAnalyzing } = useAnalysis();
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [possibleFoods, setPossibleFoods] = useState<string[]>([]);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async (source: "camera" | "library") => {
    if (isAnalyzing) return;

    let imageResult;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("الإذن مرفوض", "يجب منح إذن الكاميرا لتصوير الطعام", [
          { text: "حسناً" },
        ]);
        return;
      }
      imageResult = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.7,
        base64: true,
      });
    } else {
      imageResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.7,
        base64: true,
      });
    }

    if (!imageResult.canceled && imageResult.assets[0]) {
      const asset = imageResult.assets[0];
      // Reset previous result immediately
      setResult(null);
      setPossibleFoods([]);
      setPickedImage(asset.uri);

      let base64 = asset.base64 ?? null;
      if (base64?.startsWith("data:")) {
        base64 = base64.split(",")[1] ?? base64;
      }

      if (base64) {
        await runAnalysis(base64, asset.mimeType || "image/jpeg");
      }
    }
  };

  const runAnalysis = async (base64: string, mimeType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    try {
      const report = await analyzeImage(base64, mimeType, "food");
      if (
        report.possibleFoods?.length &&
        !report.allowed?.length &&
        !report.forbidden?.length
      ) {
        setPossibleFoods(report.possibleFoods);
        setResult(null);
      } else {
        setResult(report);
        setPossibleFoods([]);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof AnalysisError && err.limitReached) {
        Alert.alert("انتهى الحد المجاني", err.message, [
          { text: "لاحقاً", style: "cancel" },
          { text: "الترقية", onPress: () => router.push("/pricing") },
        ]);
      } else {
        Alert.alert("خطأ", "فشل تحليل الصورة. حاول مجدداً.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectPossible = async (food: string) => {
    if (isAnalyzing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPossibleFoods([]);
    setIsAnalyzing(true);
    try {
      const report = await analyzeText(food);
      setResult(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof AnalysisError && err.limitReached) {
        Alert.alert("انتهى الحد المجاني", (err as AnalysisError).message, [
          { text: "لاحقاً", style: "cancel" },
          { text: "الترقية", onPress: () => router.push("/pricing") },
        ]);
      } else {
        Alert.alert("خطأ", "فشل التحليل. حاول مجدداً.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    setPickedImage(null);
    setResult(null);
    setPossibleFoods([]);
  };

  const hasResult = !!result || possibleFoods.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay message="جاري تحليل الصورة..." />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: topPadding + 12,
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>
            تحليل بالصورة
          </Text>
        </View>

        <View style={styles.content}>
          {/* Low-usage proactive warning (80%+ used, non-premium) */}
          <UsageWarningBanner type="image" />

          {/* Camera tip */}
          {!pickedImage && (
            <View style={[styles.tipCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
              <Text style={[styles.tipText, { color: colors.primary }]}>
                💡 للحصول على أفضل نتيجة، شغّل فلاش الكاميرا وتأكد من وضوح الصورة وقرب الملصق
              </Text>
            </View>
          )}

          {/* ── Picker / Preview ─────────────────────────── */}
          {!pickedImage ? (
            /* Empty state — pick image */
            <View
              style={[
                styles.pickArea,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Icon
                name="image-outline"
                size={52}
                color={colors.mutedForeground}
              />
              <Text style={[styles.pickTitle, { color: colors.foreground }]}>
                صوّر الطعام أو الوجبة
              </Text>
              <Text style={[styles.pickDesc, { color: colors.mutedForeground }]}>
                سيتم تحديد المكونات وفحصها وفق نظام الطيبات
              </Text>
              <View style={styles.pickBtns}>
                <TouchableOpacity
                  style={[styles.pickBtn, { backgroundColor: colors.primary }]}
                  onPress={() => pickImage("camera")}
                  activeOpacity={0.8}
                >
                  <Icon name="camera" size={20} color="#fff" />
                  <Text style={styles.pickBtnText}>كاميرا</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pickBtn,
                    {
                      backgroundColor: colors.secondary,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => pickImage("library")}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="images"
                    size={20}
                    color={colors.secondaryForeground}
                  />
                  <Text
                    style={[
                      styles.pickBtnText,
                      { color: colors.secondaryForeground },
                    ]}
                  >
                    المعرض
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Image preview */
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: pickedImage }}
                style={[
                  styles.previewImage,
                  { borderColor: colors.border },
                ]}
                resizeMode="cover"
              />
              {/* Show "new image" row only if no result yet (still loading or uncertain) */}
              {!hasResult && (
                <TouchableOpacity
                  style={[
                    styles.retakeBtn,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={resetAll}
                  activeOpacity={0.7}
                >
                  <Icon
                    name="refresh"
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.retakeText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    صورة جديدة
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Possible foods chips ──────────────────────── */}
          {possibleFoods.length > 0 && (
            <View
              style={[
                styles.possibleCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.possibleHeader}>
                <Icon
                  name="help-circle-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text
                  style={[
                    styles.possibleTitle,
                    { color: colors.foreground },
                  ]}
                >
                  لم أتعرف بوضوح على الطعام
                </Text>
              </View>
              <Text
                style={[
                  styles.possibleSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                ماذا يكون؟ اختر من الاحتمالات:
              </Text>
              <View style={styles.possibleChips}>
                {possibleFoods.map((food) => (
                  <TouchableOpacity
                    key={food}
                    style={[
                      styles.possibleChip,
                      {
                        backgroundColor: colors.primary + "18",
                        borderColor: colors.primary + "40",
                      },
                    ]}
                    onPress={() => handleSelectPossible(food)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.possibleChipText,
                        { color: colors.primary },
                      ]}
                    >
                      {food}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Re-shoot row */}
              <View style={styles.possibleActions}>
                <TouchableOpacity
                  style={[
                    styles.possibleActionBtn,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => pickImage("camera")}
                  activeOpacity={0.8}
                >
                  <Icon name="camera" size={16} color="#fff" />
                  <Text style={styles.possibleActionBtnText}>كاميرا</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.possibleActionBtn,
                    {
                      backgroundColor: colors.muted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => pickImage("library")}
                  activeOpacity={0.8}
                >
                  <Icon
                    name="images"
                    size={16}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.possibleActionBtnText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    معرض
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Analysis result ───────────────────────────── */}
          {result && (
            <>
              <AnalysisResultCard report={result} />

              {/* ── Action buttons AFTER result ──────────────
                  Always visible — no need to scroll back up   */}
              <View
                style={[
                  styles.afterResultBar,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.afterResultLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  تحليل صورة أخرى
                </Text>
                <View style={styles.afterResultBtns}>
                  <TouchableOpacity
                    style={[
                      styles.afterBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => pickImage("camera")}
                    activeOpacity={0.8}
                    disabled={isAnalyzing}
                  >
                    <Icon name="camera" size={18} color="#fff" />
                    <Text style={styles.afterBtnText}>كاميرا</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.afterBtn,
                      {
                        backgroundColor: colors.secondary,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => pickImage("library")}
                    activeOpacity={0.8}
                    disabled={isAnalyzing}
                  >
                    <Icon
                      name="images"
                      size={18}
                      color={colors.secondaryForeground}
                    />
                    <Text
                      style={[
                        styles.afterBtnText,
                        { color: colors.secondaryForeground },
                      ]}
                    >
                      المعرض
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.afterBtnClear,
                      { backgroundColor: colors.muted, borderColor: colors.border },
                    ]}
                    onPress={resetAll}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="close"
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  content: {
    padding: 16,
    gap: 16,
  },

  /* Tip card */
  tipCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 20,
  },

  /* Pick area */
  pickArea: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: "dashed",
    gap: 10,
  },
  pickTitle: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
  },
  pickDesc: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  pickBtns: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  pickBtnText: {
    color: "#fff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 14,
  },

  /* Image preview */
  imageContainer: { gap: 10 },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
  },
  retakeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  retakeText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },

  /* Possible foods */
  possibleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  possibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  possibleTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
    flex: 1,
  },
  possibleSubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
  },
  possibleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  possibleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  possibleChipText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  possibleActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  possibleActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  possibleActionBtnText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
  },

  /* After-result action bar */
  afterResultBar: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  afterResultLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
  },
  afterResultBtns: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  afterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  afterBtnText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#fff",
  },
  afterBtnClear: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
