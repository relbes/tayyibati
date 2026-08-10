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

export function ImageQualityNotice({ report, onRetry, onSelectCandidate, onManualEntry }: Props) {
  const colors = useColors();
  const ir = report.imageRecognition;
  const rtl = isRTL();

  if (!ir) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.header, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <Icon name="alert-triangle" size={24} color={colors.destructive} />
        <Text style={[styles.title, { color: colors.foreground }]}>
          الصورة غير واضحة
        </Text>
      </View>
      <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
        لم نتمكن من تحديد الطعام بدقة بسبب عدم وضوح الصورة، أو أن العنصر صغير جداً.
      </Text>

      <TouchableOpacity 
        style={[styles.retryBtn, { backgroundColor: colors.primary, flexDirection: rtl ? "row-reverse" : "row" }]}
        onPress={onRetry}
      >
        <Icon name="camera" size={20} color="#fff" />
        <Text style={styles.retryBtnText}>إعادة التصوير</Text>
      </TouchableOpacity>

      {ir.candidates.length > 0 && (
        <View style={styles.candidatesWrapper}>
          <ImageCandidateSelector 
            report={report} 
            onSelectCandidate={onSelectCandidate}
            onManualEntry={onManualEntry}
          />
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
  header: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    marginBottom: 20,
    lineHeight: 20,
    width: "100%",
  },
  retryBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  candidatesWrapper: {
    marginTop: 16,
  }
});
