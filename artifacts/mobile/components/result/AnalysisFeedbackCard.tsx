import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Icon } from "@/components/Icon";
import { submitFeedback, type FeedbackReason } from "@/lib/api";

export interface AnalysisFeedbackCardProps {
  analysisHistoryId?: number | null;
}

const REASON_OPTIONS: Array<{ key: FeedbackReason; label: string }> = [
  { key: "INCORRECT_RESULT", label: "النتيجة غير صحيحة" },
  { key: "INCORRECT_INGREDIENTS", label: "المكونات غير صحيحة" },
  { key: "NOT_CLEAR", label: "لم أفهم النتيجة" },
  { key: "WRONG_FOOD", label: "الطعام الذي أبحث عنه مختلف" },
  { key: "OTHER", label: "أخرى" },
];

function isDuplicateFeedbackError(err: any): boolean {
  const msg = typeof err?.message === "string" ? err.message.toLowerCase() : "";
  const code = typeof err?.code === "string" ? err.code.toUpperCase() : "";
  return (
    code === "FEEDBACK_EXISTS" ||
    msg.includes("feedback_exists") ||
    msg.includes("already been submitted") ||
    msg.includes("already submitted") ||
    err?.status === 409
  );
}

export const AnalysisFeedbackCard = React.memo(function AnalysisFeedbackCard({
  analysisHistoryId,
}: AnalysisFeedbackCardProps) {
  // If no analysisHistoryId available (e.g. Guest user), do not render feedback UI at all
  if (!analysisHistoryId) {
    return null;
  }

  const [rating, setRating] = useState<"positive" | "negative" | null>(null);
  const [selectedReason, setSelectedReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handlePositive = async () => {
    if (isSubmitting || isSubmitted) return;
    setRating("positive");
    setIsSubmitting(true);
    setErrorMessage(null);
    setValidationError(null);

    try {
      await submitFeedback({
        analysisHistoryId,
        rating: "positive",
      });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("[Feedback Submission Error]", err);
      if (isDuplicateFeedbackError(err)) {
        setIsSubmitted(true);
      } else {
        const errorMsg =
          typeof err?.message === "string" && err.message.trim().length > 0
            ? err.message
            : "تعذر إرسال التقييم، حاول مرة أخرى.";
        setErrorMessage(errorMsg);
        // Allow retry by resetting rating selection
        setRating(null);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNegativeSelect = () => {
    if (isSubmitting || isSubmitted) return;
    setRating("negative");
    setErrorMessage(null);
    setValidationError(null);
  };

  const handleNegativeSubmit = async () => {
    if (isSubmitting || isSubmitted) return;

    if (!selectedReason) {
      setValidationError("يرجى اختيار سبب المشكلة");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setValidationError(null);

    try {
      await submitFeedback({
        analysisHistoryId,
        rating: "negative",
        reason: selectedReason,
        comment: comment.trim() || null,
      });
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("[Feedback Submission Error]", err);
      if (isDuplicateFeedbackError(err)) {
        setIsSubmitted(true);
      } else {
        const errorMsg =
          typeof err?.message === "string" && err.message.trim().length > 0
            ? err.message
            : "تعذر إرسال التقييم، حاول مرة أخرى.";
        setErrorMessage(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <View style={styles.card}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Icon name="checkmark-circle" size={26} color="#16A34A" />
          </View>
          <Text style={styles.successTitle}>
            ✓ شكرًا! تقييمك يساعدنا على تحسين طيباتي ❤️
          </Text>
          <Text style={styles.successSub}>تم إرسال تقييمك</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* 1. Header Prompt */}
      <Text style={styles.headerTitle}>هل كانت هذه النتيجة مفيدة؟</Text>

      {/* 2. Thumbs Buttons Row */}
      <View style={styles.thumbsRow}>
        {/* Thumb Up */}
        <TouchableOpacity
          style={[
            styles.thumbButton,
            styles.thumbPositive,
            rating === "positive" && styles.thumbPositiveActive,
            isSubmitting && styles.thumbDisabled,
          ]}
          onPress={handlePositive}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting && rating === "positive" ? (
            <ActivityIndicator size="small" color="#16A34A" />
          ) : (
            <Text
              style={[
                styles.thumbButtonText,
                styles.thumbPositiveText,
                rating === "positive" && styles.thumbPositiveActiveText,
              ]}
            >
              👍 نعم
            </Text>
          )}
        </TouchableOpacity>

        {/* Thumb Down */}
        <TouchableOpacity
          style={[
            styles.thumbButton,
            styles.thumbNegative,
            rating === "negative" && styles.thumbNegativeActive,
            isSubmitting && styles.thumbDisabled,
          ]}
          onPress={handleNegativeSelect}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.thumbButtonText,
              styles.thumbNegativeText,
              rating === "negative" && styles.thumbNegativeActiveText,
            ]}
          >
            👎 لا
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Error Banner (friendly retry banner) */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* 4. Negative Feedback Form (revealed only if rating === "negative") */}
      {rating === "negative" ? (
        <View style={styles.negativeFormContainer}>
          <View style={styles.divider} />

          <Text style={styles.formSectionTitle}>ما المشكلة؟</Text>

          {/* Validation Error if submitted without reason */}
          {validationError ? (
            <Text style={styles.validationErrorText}>{validationError}</Text>
          ) : null}

          {/* Single-selection Reason List */}
          <View style={styles.reasonsList}>
            {REASON_OPTIONS.map((item) => {
              const isSelected = selectedReason === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.reasonOption,
                    isSelected && styles.reasonOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedReason(item.key);
                    if (validationError) setValidationError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text
                    style={[
                      styles.reasonLabel,
                      isSelected && styles.reasonLabelSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Optional Comment Input */}
          <Text style={styles.commentLabel}>ملاحظتك (اختياري)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="اكتب ملاحظتك هنا..."
            placeholderTextColor="#94A3B8"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlign="right"
            editable={!isSubmitting}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            onPress={handleNegativeSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>جارٍ الإرسال...</Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>إرسال الملاحظات</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#1E293B",
    textAlign: "right",
    marginBottom: 12,
  },
  thumbsRow: {
    flexDirection: "row-reverse",
    gap: 12,
  },
  thumbButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPositive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },
  thumbPositiveActive: {
    backgroundColor: "#DCFCE7",
    borderColor: "#16A34A",
  },
  thumbNegative: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  thumbNegativeActive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  thumbDisabled: {
    opacity: 0.6,
  },
  thumbButtonText: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
  },
  thumbPositiveText: {
    color: "#15803D",
  },
  thumbPositiveActiveText: {
    color: "#166534",
  },
  thumbNegativeText: {
    color: "#475569",
  },
  thumbNegativeActiveText: {
    color: "#B91C1C",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 14,
  },
  negativeFormContainer: {
    marginTop: 2,
  },
  formSectionTitle: {
    fontSize: 14,
    fontFamily: "Tajawal_700Bold",
    color: "#334155",
    textAlign: "right",
    marginBottom: 10,
  },
  validationErrorText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#DC2626",
    textAlign: "right",
    marginBottom: 8,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 14,
  },
  reasonOption: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  reasonOptionSelected: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#16A34A",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16A34A",
  },
  reasonLabel: {
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    color: "#334155",
    flex: 1,
    textAlign: "right",
  },
  reasonLabelSelected: {
    color: "#15803D",
    fontFamily: "Tajawal_700Bold",
  },
  commentLabel: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#475569",
    textAlign: "right",
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    color: "#0F172A",
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  submitButton: {
    backgroundColor: "#16A34A",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submittingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
  },
  submitButtonText: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#FFFFFF",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#B91C1C",
    textAlign: "right",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  successIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  successTitle: {
    fontSize: 15,
    fontFamily: "Tajawal_700Bold",
    color: "#15803D",
    textAlign: "center",
  },
  successSub: {
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    color: "#475569",
    textAlign: "center",
  },
});
