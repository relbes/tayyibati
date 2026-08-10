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
import { useRouter, useLocalSearchParams } from "expo-router";
import { Icon } from "@/components/Icon";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeImage, analyzeText, AnalysisError, NetworkError } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";
import { UsageWarningBanner } from "@/components/UsageWarningBanner";
import { AuthRequiredDialog } from "@/components/AuthRequiredDialog";
import { ImageCandidateSelector } from "@/components/ImageCandidateSelector";
import { ImageQualityNotice } from "@/components/ImageQualityNotice";
import { EditableIngredientList } from "@/components/EditableIngredientList";
import { CameraQualityTips } from "@/components/CameraQualityTips";
import { isRTL } from "@/lib/i18n";

export default function CameraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isAnalyzing, setIsAnalyzing } = useAnalysis();
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [pickedImageData, setPickedImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const { action } = useLocalSearchParams<{ action?: string }>();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const rtl = isRTL();

  React.useEffect(() => {
    // Only auto-launch if we haven't picked an image yet, and an action is requested
    if (action && !pickedImage && !isAnalyzing) {
      setTimeout(() => {
        if (action === "camera") pickImage("camera");
        if (action === "gallery") pickImage("library");
      }, 300);
    }
  }, [action]);

  const pickImage = async (source: "camera" | "library") => {
    if (isAnalyzing) return;
    if (!user) {
      setAuthModalVisible(true);
      return;
    }

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

    if (!imageResult.canceled && imageResult.assets && imageResult.assets[0]) {
      const asset = imageResult.assets[0];
      setResult(null);
      setPickedImage(asset.uri);

      let base64 = asset.base64 ?? null;
      if (base64?.startsWith("data:")) {
        base64 = base64.split(",")[1] ?? base64;
      }

      if (base64) {
        setPickedImageData({ base64, mimeType: asset.mimeType || "image/jpeg" });
      }
    }
  };

  const handleAnalyzeConfirm = async () => {
    if (!pickedImageData) return;
    await runAnalysis(pickedImageData.base64, pickedImageData.mimeType);
  };

  const runAnalysis = async (base64: string, mimeType: string) => {
    if (!user) {
      setAuthModalVisible(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    try {
      const report = await analyzeImage(base64, mimeType, "food");
      setResult(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.error("[Camera Image Analysis Error]", err);
      }
      if (err instanceof NetworkError || (err as any)?.isNetworkError) {
        Alert.alert("خطأ في الاتصال", (err as Error).message);
      } else if (err instanceof AnalysisError && err.limitReached) {
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

  const handleManualEntry = async (food: string) => {
    if (isAnalyzing) return;
    if (!user) {
      setAuthModalVisible(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    try {
      const report = await analyzeText(food);
      setResult(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (typeof __DEV__ !== "undefined" && __DEV__) {
        console.error("[Camera Manual Analysis Error]", err);
      }
      if (err instanceof NetworkError || (err as any)?.isNetworkError) {
        Alert.alert("خطأ في الاتصال", (err as Error).message);
      } else if (err instanceof AnalysisError && err.limitReached) {
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
    setPickedImageData(null);
    setResult(null);
  };

  const hasResult = !!result;
  const showConfirmationUI = pickedImageData && !hasResult && !isAnalyzing;

  const ir = result?.imageRecognition;
  const isAmbiguous = ir && (ir.status === "AMBIGUOUS" || ir.status === "UNKNOWN" || ir.status === "INSUFFICIENT_IMAGE");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay message="جاري تحليل الصورة..." />}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
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
          <Text style={[styles.title, { color: colors.foreground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
            تحليل بالصورة
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
            صوّر الطعام لتحصل على تحليل فوري ودقيق
          </Text>
        </View>

        <View style={styles.content}>
          {/* Proactive usage warning */}
          <UsageWarningBanner type="image" />

          {/* Information Banner */}
          {!pickedImage && (
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: colors.primary + "12",
                  borderColor: colors.primary + "30",
                  flexDirection: rtl ? "row-reverse" : "row",
                },
              ]}
            >
              <View style={[styles.infoIconBox, { backgroundColor: colors.primary + "20" }]}>
                <Icon name="bulb" size={18} color={colors.primary} />
              </View>
              <Text
                style={[
                  styles.infoCardText,
                  { color: colors.primary, textAlign: rtl ? "right" : "left", flex: 1 },
                ]}
              >
                للحصول على أفضل نتيجة، نظّف عدسة الكاميرا وتأكد من وضوح الصورة وقرب الملصق
              </Text>
            </View>
          )}

          {/* ── Main Image Action Card / Preview ── */}
          {!pickedImage ? (
            <View
              style={[
                styles.mainActionCard,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <View style={[styles.mainIconContainer, { backgroundColor: colors.primary + "15" }]}>
                <Icon name="camera" size={34} color={colors.primary} />
              </View>

              <View style={styles.textStack}>
                <Text style={[styles.cardTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
                  صوّر الطعام أو الوجبة
                </Text>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
                  سنستخرج المكونات، ونفحصها وفق قاعدة الطيبات
                </Text>
              </View>

              <View style={styles.actionButtonsStack}>
                {/* Primary Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryActionBtn,
                    { backgroundColor: colors.primary, flexDirection: rtl ? "row-reverse" : "row" },
                  ]}
                  onPress={() => pickImage("camera")}
                  activeOpacity={0.85}
                >
                  <Icon name="camera" size={20} color="#ffffff" />
                  <Text style={styles.primaryActionBtnText}>التقاط صورة</Text>
                </TouchableOpacity>

                {/* Secondary Button */}
                <TouchableOpacity
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: colors.primary + "12",
                      borderColor: colors.primary + "30",
                      flexDirection: rtl ? "row-reverse" : "row",
                    },
                  ]}
                  onPress={() => pickImage("library")}
                  activeOpacity={0.85}
                >
                  <Icon name="images" size={20} color={colors.primary} />
                  <Text style={[styles.secondaryActionBtnText, { color: colors.primary }]}>
                    اختيار صورة من الجهاز
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Image Preview Card */
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: pickedImage }}
                style={[
                  styles.previewImage,
                  { borderColor: colors.border },
                ]}
                resizeMode="cover"
              />
              {hasResult && !isAnalyzing && (
                <TouchableOpacity
                  style={[
                    styles.retakeBtn,
                    {
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      flexDirection: rtl ? "row-reverse" : "row",
                    },
                  ]}
                  onPress={resetAll}
                  activeOpacity={0.7}
                >
                  <Icon name="refresh" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.retakeText, { color: colors.mutedForeground }]}>
                    صورة جديدة
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Image Quality Tips (only when no image picked) */}
          {!pickedImage && <CameraQualityTips />}

          {/* Confirmation State UI */}
          {showConfirmationUI && (
            <View style={styles.confirmationStack}>
              <TouchableOpacity
                style={[
                  styles.primaryActionBtn,
                  { backgroundColor: colors.primary, flexDirection: rtl ? "row-reverse" : "row" },
                ]}
                onPress={handleAnalyzeConfirm}
                activeOpacity={0.85}
              >
                <Icon name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.primaryActionBtnText}>تحليل الصورة</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    flexDirection: rtl ? "row-reverse" : "row",
                  },
                ]}
                onPress={resetAll}
                activeOpacity={0.85}
              >
                <Icon name="refresh" size={20} color={colors.mutedForeground} />
                <Text style={[styles.secondaryActionBtnText, { color: colors.mutedForeground }]}>
                  تغيير الصورة
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ambiguous / Quality Notices */}
          {isAmbiguous && ir.status === "INSUFFICIENT_IMAGE" && (
            <ImageQualityNotice
              report={result}
              onRetry={resetAll}
              onSelectCandidate={handleManualEntry}
              onManualEntry={handleManualEntry}
            />
          )}

          {isAmbiguous && ir.status !== "INSUFFICIENT_IMAGE" && (
            <ImageCandidateSelector
              report={result}
              onSelectCandidate={handleManualEntry}
              onManualEntry={handleManualEntry}
            />
          )}

          {/* Analysis Result */}
          {result && !isAmbiguous && (
            <>
              {result.resultMode === "COMPOSITE_FOOD" && ir?.likelyIngredients && ir.likelyIngredients.length > 0 && !ir.confirmedIngredients?.length && (
                <EditableIngredientList
                  initialIngredients={ir.likelyIngredients}
                  onReanalyze={handleManualEntry}
                />
              )}

              <AnalysisResultCard report={result} />

              {result.relevantVariants && result.relevantVariants.length > 0 && (
                <View style={{ marginTop: 16, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16 }}>
                  <Text style={{ fontFamily: "Tajawal_700Bold", color: colors.foreground, fontSize: 14, marginBottom: 8, textAlign: rtl ? "right" : "left", width: "100%" }}>
                    هل تقصد أحد هذه الأطباق؟ اختر للتأكيد:
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: rtl ? "flex-end" : "flex-start" }}>
                    {result.relevantVariants.map((variant: any, idx: number) => (
                      <TouchableOpacity
                        key={idx}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 20,
                          backgroundColor: colors.primary + "12",
                          borderWidth: 1,
                          borderColor: colors.primary + "30",
                        }}
                        onPress={() => handleManualEntry(variant.nameAr)}
                      >
                        <Text style={{ fontFamily: "Tajawal_500Medium", color: colors.primary, fontSize: 13 }}>
                          {variant.nameAr}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Action Bar after result */}
              <View style={[styles.afterResultBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.afterResultLabel, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left", width: "100%" }]}>
                  تحليل صورة أخرى
                </Text>
                <View style={[styles.afterResultBtns, { flexDirection: rtl ? "row-reverse" : "row" }]}>
                  <TouchableOpacity
                    style={[styles.afterBtn, { backgroundColor: colors.primary, flexDirection: rtl ? "row-reverse" : "row" }]}
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
                        flexDirection: rtl ? "row-reverse" : "row",
                      },
                    ]}
                    onPress={() => pickImage("library")}
                    activeOpacity={0.8}
                    disabled={isAnalyzing}
                  >
                    <Icon name="images" size={18} color={colors.secondaryForeground} />
                    <Text style={[styles.afterBtnText, { color: colors.secondaryForeground }]}>
                      المعرض
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.afterBtnClear, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={resetAll}
                    activeOpacity={0.7}
                  >
                    <Icon name="close" size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
      <AuthRequiredDialog visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    lineHeight: 20,
  },
  mainActionCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    gap: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  mainIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  textStack: {
    gap: 6,
    width: "100%",
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Tajawal_700Bold",
    width: "100%",
  },
  cardDesc: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 22,
    width: "100%",
  },
  actionButtonsStack: {
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  primaryActionBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionBtnText: {
    color: "#ffffff",
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
  secondaryActionBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionBtnText: {
    fontFamily: "Tajawal_700Bold",
    fontSize: 15,
  },
  imageContainer: { gap: 10 },
  previewImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
  },
  retakeBtn: {
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
  confirmationStack: {
    marginTop: 8,
    gap: 12,
    width: "100%",
  },
  afterResultBar: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  afterResultLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
  },
  afterResultBtns: {
    gap: 10,
    alignItems: "center",
  },
  afterBtn: {
    flex: 1,
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
