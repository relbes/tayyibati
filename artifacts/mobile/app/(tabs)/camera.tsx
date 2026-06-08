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
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeImage } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";

type AnalysisMode = "food" | "label";

export default function CameraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isAnalyzing, setIsAnalyzing } = useAnalysis();
  const [mode, setMode] = useState<AnalysisMode>("food");
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const pickImage = async (source: "camera" | "library") => {
    let imageResult;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("الإذن مرفوض", "يجب منح إذن الكاميرا");
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
      setPickedImage(asset.uri);
      setResult(null);

      // Get base64
      const base64 = asset.base64;

      if (base64) {
        await runAnalysis(base64, asset.mimeType || "image/jpeg");
      }
    }
  };

  const runAnalysis = async (base64: string, mimeType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    try {
      const report = await analyzeImage(base64, mimeType, mode, user?.id);
      setResult(report);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("خطأ", "فشل تحليل الصورة. حاول مجدداً.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay message={mode === "label" ? "جاري قراءة الملصق..." : "جاري تحليل الصورة..."} />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>تحليل بالصورة</Text>

          {/* Mode Toggle */}
          <View style={[styles.modeToggle, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            {([
              { key: "food", label: "صورة طعام", icon: "restaurant" },
              { key: "label", label: "ملصق منتج", icon: "barcode" },
            ] as const).map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.modeBtn,
                  mode === m.key && { backgroundColor: colors.primary },
                ]}
                onPress={() => { setMode(m.key); setResult(null); setPickedImage(null); }}
              >
                <Ionicons name={m.icon} size={16} color={mode === m.key ? "#fff" : colors.mutedForeground} />
                <Text style={[styles.modeBtnText, { color: mode === m.key ? "#fff" : colors.mutedForeground }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {/* Image Picker Area */}
          {!pickedImage ? (
            <View style={[styles.pickArea, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons
                name={mode === "label" ? "barcode-outline" : "image-outline"}
                size={56}
                color={colors.mutedForeground}
              />
              <Text style={[styles.pickTitle, { color: colors.foreground }]}>
                {mode === "label" ? "صوّر ملصق المنتج" : "صوّر الطعام أو الوجبة"}
              </Text>
              <Text style={[styles.pickDesc, { color: colors.mutedForeground }]}>
                {mode === "label"
                  ? "سيتم استخراج قائمة المكونات تلقائياً"
                  : "سيتم تحديد المكونات وفحصها"}
              </Text>
              <View style={styles.pickBtns}>
                <TouchableOpacity
                  style={[styles.pickBtn, { backgroundColor: colors.primary }]}
                  onPress={() => pickImage("camera")}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.pickBtnText}>كاميرا</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickBtn, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
                  onPress={() => pickImage("library")}
                >
                  <Ionicons name="images" size={20} color={colors.secondaryForeground} />
                  <Text style={[styles.pickBtnText, { color: colors.secondaryForeground }]}>المعرض</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.imageContainer}>
              <Image source={{ uri: pickedImage }} style={[styles.previewImage, { borderColor: colors.border }]} resizeMode="cover" />
              <TouchableOpacity
                style={[styles.retakeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => { setPickedImage(null); setResult(null); }}
              >
                <Ionicons name="refresh" size={16} color={colors.mutedForeground} />
                <Text style={[styles.retakeText, { color: colors.mutedForeground }]}>صورة جديدة</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Result */}
          {result && <AnalysisResultCard report={result} />}
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
    fontFamily: "Inter_700Bold",
    textAlign: "right",
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    padding: 16,
    gap: 16,
  },
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
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  pickDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  imageContainer: {
    gap: 10,
  },
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
    fontFamily: "Inter_500Medium",
  },
});
