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
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useAnalysis } from "@/context/AnalysisContext";
import { analyzeImage, AnalysisError } from "@/lib/api";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";

export default function CameraScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { isAnalyzing, setIsAnalyzing } = useAnalysis();
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
      // Strip any data URL prefix (expo-image-picker can include it on some platforms/versions)
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
      const report = await analyzeImage(base64, mimeType, "food", user?.id);
      setResult(report);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {isAnalyzing && <LoadingOverlay message="جاري تحليل الصورة..." />}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>تحليل بالصورة</Text>
        </View>

        <View style={styles.content}>
          {/* Image Picker Area */}
          {!pickedImage ? (
            <View style={[styles.pickArea, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons
                name="image-outline"
                size={56}
                color={colors.mutedForeground}
              />
              <Text style={[styles.pickTitle, { color: colors.foreground }]}>
                صوّر الطعام أو الوجبة
              </Text>
              <Text style={[styles.pickDesc, { color: colors.mutedForeground }]}>
                سيتم تحديد المكونات وفحصها
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
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
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
    fontFamily: "Tajawal_500Medium",
  },
});
