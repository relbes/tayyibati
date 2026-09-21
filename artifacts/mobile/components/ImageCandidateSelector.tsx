import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { AnalysisReport } from "@/context/AnalysisContext";
import { isRTL } from "@/lib/i18n";

interface Props {
  report: AnalysisReport;
  onSelectCandidate: (candidateName: string) => void;
  onManualEntry: (text: string) => void;
  onRetry?: () => void;
}

function getFoodEmoji(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("تمر") || n.includes("بلح")) return "🌴";
  if (n.includes("طماطم") || n.includes("بندورة")) return "🍅";
  if (n.includes("تفاح")) return "🍎";
  if (n.includes("موز")) return "🍌";
  if (n.includes("برتقال") || n.includes("حمضيات")) return "🍊";
  if (n.includes("لحم") || n.includes("كباب") || n.includes("ستيك") || n.includes("شواء")) return "🥩";
  if (n.includes("دجاج") || n.includes("فراخ") || n.includes("شاورما")) return "🍗";
  if (n.includes("سمك") || n.includes("تونة") || n.includes("جمبري") || n.includes("سوشي")) return "🐟";
  if (n.includes("خبز") || n.includes("توست") || n.includes("معجنات") || n.includes("بيتزا")) return "🍞";
  if (n.includes("أرز") || n.includes("كبسة") || n.includes("برياني")) return "🍚";
  if (n.includes("سلطة") || n.includes("خضار") || n.includes("فتوش")) return "🥗";
  if (n.includes("حليب") || n.includes("جبن") || n.includes("زبادي")) return "🧀";
  if (n.includes("شاي") || n.includes("قهوة")) return "☕";
  if (n.includes("شوكولاته") || n.includes("حلوى") || n.includes("بسكويت")) return "🍫";
  return "🍲";
}

export function ImageCandidateSelector({
  report,
  onSelectCandidate,
  onManualEntry,
  onRetry,
}: Props) {
  const colors = useColors();
  const [isManual, setIsManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const rtl = isRTL();

  const ir = report.imageRecognition;
  if (!ir) return null;

  const hasCandidates = !!(ir.candidates && ir.candidates.length > 0);
  const isPackaged = ir.imageType === "PACKAGED_PRODUCT";

  const mainTitle = hasCandidates
    ? "ربما تقصد أحد هذه الخيارات؟"
    : isPackaged
    ? "لم نتمكن من تحديد المنتج بدقة"
    : "لم نتمكن من تحديد الطعام بدقة";

  const subtitle = hasCandidates
    ? "اختر أقرب خيار لتحصل على تحليل أدق"
    : "حاول التقاط صورة أوضح للمنتج أو العبوة، ويفضل إظهار الاسم والمكونات.";

  const handleSelect = (name: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    onSelectCandidate(name);
  };

  const handleManualSubmit = () => {
    const trimmed = manualText.trim();
    if (!trimmed) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
    onManualEntry(trimmed);
  };

  return (
    <View style={styles.container}>
      {/* 1. Header: Prominent Icon, Title, and Subtitle */}
      <View style={styles.headerSection}>
        <View style={[styles.headerTitleRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
          <View style={styles.warningIconBadge}>
            <Icon
              name={hasCandidates ? "bulb" : "alert-circle"}
              size={22}
              color="#D97706"
            />
          </View>
          <Text style={styles.title}>{mainTitle}</Text>
        </View>
        <Text style={[styles.subtitle, { textAlign: rtl ? "right" : "left" }]}>
          {subtitle}
        </Text>
      </View>

      {/* 2. Suggestion Options List */}
      {hasCandidates && !isManual && (
        <View style={styles.candidatesList}>
          {ir.candidates!.map((c, idx) => {
            const candidateName = c.resolution?.canonicalNameAr || c.nameAr;
            const emoji = getFoodEmoji(candidateName);

            return (
              <TouchableOpacity
                key={`${candidateName}_${idx}`}
                style={[
                  styles.candidateCard,
                  { flexDirection: rtl ? "row-reverse" : "row" },
                ]}
                onPress={() => handleSelect(candidateName)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`اختيار ${candidateName}`}
              >
                {/* Food Emoji + Food Name */}
                <View
                  style={[
                    styles.candidateRightGroup,
                    { flexDirection: rtl ? "row-reverse" : "row" },
                  ]}
                >
                  <Text style={styles.candidateEmoji}>{emoji}</Text>
                  <Text
                    style={[
                      styles.candidateText,
                      { textAlign: rtl ? "right" : "left" },
                    ]}
                    numberOfLines={1}
                  >
                    {candidateName}
                  </Text>
                </View>

                {/* Chevron Box */}
                <View style={styles.chevronBox}>
                  <Icon
                    name={rtl ? "chevron-back" : "chevron-forward"}
                    size={18}
                    color="#D97706"
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 3. Manual Search Action & Actions Footer */}
      {!isManual ? (
        <View style={styles.actionsFooter}>
          <TouchableOpacity
            style={[
              styles.manualEntryBtn,
              { flexDirection: rtl ? "row-reverse" : "row" },
            ]}
            onPress={() => setIsManual(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="ليس أيًا منها؟ اكتب اسم الطعام"
          >
            <Icon name="create-outline" size={18} color="#008C5A" />
            <Text style={styles.manualEntryBtnText}>
              ليس أيًا منها؟ اكتب اسم الطعام
            </Text>
          </TouchableOpacity>

          {onRetry && (
            <TouchableOpacity
              style={[
                styles.retryBtn,
                { flexDirection: rtl ? "row-reverse" : "row" },
              ]}
              onPress={onRetry}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="إعادة التقاط الصورة"
            >
              <Icon name="camera-outline" size={16} color="#78716C" />
              <Text style={styles.retryBtnText}>إعادة التقاط الصورة</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        /* Manual Input Mode */
        <View style={styles.manualInputContainer}>
          <Text style={[styles.manualLabel, { textAlign: rtl ? "right" : "left" }]}>
            أدخل اسم الطعام يدويًا:
          </Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[
                styles.input,
                { textAlign: rtl ? "right" : "left" },
              ]}
              placeholder="مثال: تمر سكري، دجاج مشوي..."
              placeholderTextColor="#94A3B8"
              value={manualText}
              onChangeText={setManualText}
              onSubmitEditing={handleManualSubmit}
              returnKeyType="search"
              autoFocus
            />
          </View>

          <View
            style={[
              styles.manualButtonsRow,
              { flexDirection: rtl ? "row-reverse" : "row" },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.submitBtn,
                !manualText.trim() && styles.submitBtnDisabled,
              ]}
              onPress={handleManualSubmit}
              disabled={!manualText.trim()}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>تحليل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setIsManual(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFDF5",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    padding: 18,
    marginVertical: 10,
    width: "100%",
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  headerSection: {
    gap: 4,
  },
  headerTitleRow: {
    alignItems: "center",
    gap: 10,
  },
  warningIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17.5,
    fontFamily: "Tajawal_700Bold",
    color: "#92400E",
    flex: 1,
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: "Tajawal_500Medium",
    color: "#B45309",
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  candidatesList: {
    gap: 8,
  },
  candidateCard: {
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FDE68A",
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: "#D97706",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 52,
  },
  candidateRightGroup: {
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  candidateEmoji: {
    fontSize: 22,
  },
  candidateText: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
    flex: 1,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  actionsFooter: {
    gap: 10,
    paddingTop: 2,
    width: "100%",
  },
  manualEntryBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#008C5A",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
  },
  manualEntryBtnText: {
    fontSize: 14.5,
    fontFamily: "Tajawal_700Bold",
    color: "#008C5A",
  },
  retryBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
  },
  retryBtnText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#78716C",
  },
  manualInputContainer: {
    gap: 10,
    paddingTop: 4,
  },
  manualLabel: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#92400E",
  },
  inputWrapper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
    color: "#0F172A",
  },
  manualButtonsRow: {
    gap: 10,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: "#008C5A",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#92400E",
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
  },
});
