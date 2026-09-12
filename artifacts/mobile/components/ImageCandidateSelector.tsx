import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { AnalysisReport } from "@/context/AnalysisContext";
import { isRTL } from "@/lib/i18n";

interface Props {
  report: AnalysisReport;
  onSelectCandidate: (candidateName: string) => void;
  onManualEntry: (text: string) => void;
}

export function ImageCandidateSelector({ report, onSelectCandidate, onManualEntry }: Props) {
  const colors = useColors();
  const [isManual, setIsManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const rtl = isRTL();

  const ir = report.imageRecognition;
  if (!ir) return null;

  const isPackaged = ir.imageType === "PACKAGED_PRODUCT";
  const mainTitle = ir.status === "AMBIGUOUS"
    ? (isPackaged ? "لم نتمكن من تحديد المنتج بدقة" : "لم نتمكن من تحديد الطعام بدقة")
    : (isPackaged ? "لم نتمكن من تحديد المنتج بدقة" : "لم نتمكن من تحديد الطعام بدقة");

  const subtitle = isPackaged
    ? "حاول التقاط صورة أوضح للمنتج أو العبوة، ويفضل إظهار الاسم والمكونات."
    : "حاول التقاط صورة أوضح للمنتج أو العبوة، ويفضل إظهار الاسم والمكونات.";

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
        {mainTitle}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
        {subtitle}
      </Text>
      
      {ir.candidates.length > 0 && !isManual && (
        <>
          <Text style={[styles.candidatesPrompt, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
            ربما تقصد أحد هذه الخيارات:
          </Text>
          <View style={styles.candidates}>
            {ir.candidates.map((c, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.candidateChip, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "40", flexDirection: rtl ? "row-reverse" : "row" }]}
                onPress={() => onSelectCandidate(c.resolution?.canonicalNameAr || c.nameAr)}
              >
                <Text style={[styles.candidateText, { color: colors.primary }]}>
                  {c.resolution?.canonicalNameAr || c.nameAr}
                </Text>
                <Icon name={rtl ? "chevron-back" : "chevron-forward"} size={16} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {!isManual ? (
        <TouchableOpacity style={styles.manualBtn} onPress={() => setIsManual(true)}>
          <Text style={[styles.manualBtnText, { color: colors.mutedForeground }]}>
            ليس أيًا منها؟ اكتب اسم الطعام
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.manualInputContainer}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }]}
            placeholder="اكتب اسم الطعام هنا..."
            placeholderTextColor={colors.mutedForeground}
            value={manualText}
            onChangeText={setManualText}
            autoFocus
          />
          <TouchableOpacity 
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
            onPress={() => onManualEntry(manualText)}
          >
            <Text style={styles.submitBtnText}>تحليل</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsManual(false)}>
            <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 12,
    width: "100%",
  },
  title: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 6,
    width: "100%",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 20,
    marginBottom: 14,
    width: "100%",
  },
  candidatesPrompt: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 10,
    width: "100%",
  },
  candidates: {
    gap: 8,
    marginBottom: 16,
  },
  candidateChip: {
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  candidateText: {
    fontSize: 16,
    fontFamily: "Tajawal_500Medium",
  },
  manualBtn: {
    padding: 12,
    alignItems: "center",
  },
  manualBtnText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textDecorationLine: "underline",
  },
  manualInputContainer: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: "Tajawal_400Regular",
  },
  submitBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  cancelBtn: {
    padding: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
  },
});
