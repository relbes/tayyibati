import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { AnalysisReport } from "@/context/AnalysisContext";
import { ImageCandidateSelector } from "./ImageCandidateSelector";
import { isRTL } from "@/lib/i18n";

interface Props {
  report: AnalysisReport;
  onRetry: () => void;
  onSelectCandidate: (candidateName: string) => void;
  onManualEntry: (text: string) => void;
}

export function ImageQualityNotice({
  report,
  onRetry,
  onSelectCandidate,
  onManualEntry,
}: Props) {
  const colors = useColors();
  const ir = report.imageRecognition;
  const rtl = isRTL();

  if (!ir) return null;

  // If there are suggestions/candidates, render the prominent candidate selector directly with onRetry
  if (ir.candidates && ir.candidates.length > 0) {
    return (
      <ImageCandidateSelector
        report={report}
        onSelectCandidate={onSelectCandidate}
        onManualEntry={onManualEntry}
        onRetry={onRetry}
      />
    );
  }

  const isPackaged = ir.imageType === "PACKAGED_PRODUCT";
  const title = isPackaged
    ? "لم نتمكن من تحديد المنتج بدقة"
    : "لم نتمكن من تحديد الطعام بدقة";
  const subtitle =
    "حاول التقاط صورة أوضح للمنتج أو العبوة، ويفضل إظهار الاسم والمكونات.";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.warningIconBadge}>
          <Icon name="alert-triangle" size={22} color="#DC2626" />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <TouchableOpacity
        style={styles.retryBtn}
        onPress={onRetry}
        activeOpacity={0.85}
      >
        <Icon name="camera" size={20} color="#FFFFFF" />
        <Text style={styles.retryBtnText}>إعادة التقاط الصورة</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    marginVertical: 10,
    width: "100%",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
  },
  warningIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    color: "#0F172A",
    textAlign: "right",
    flex: 1,
  },
  subtitle: {
    fontSize: 13.5,
    fontFamily: "Tajawal_400Regular",
    color: "#64748B",
    lineHeight: 20,
    textAlign: "right",
  },
  retryBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#008C5A",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 6,
    shadowColor: "#008C5A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 15.5,
    fontFamily: "Tajawal_700Bold",
  },
});
