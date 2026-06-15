import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface Section {
  title: string;
  body: string;
}

const SECTIONS: Section[] = [
  {
    title: "مقدمة",
    body: "نحن في طيباتي نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. توضح هذه السياسة ما نجمعه وكيف نستخدمه عند استخدامك لتطبيق طيباتي.",
  },
  {
    title: "ما الذي نجمعه؟",
    body:
      "• الاسم والبريد الإلكتروني عند إنشاء حساب.\n" +
      "• الأطعمة والمكونات التي تبحث عنها أو تصوّرها.\n" +
      "• سجل التحليلات لعرضه لك لاحقاً.\n" +
      "• عدد التحليلات اليومية لإدارة الحد المجاني.\n" +
      "• صور الطعام التي ترفعها لتحليل مكوناتها — لا تُحفظ على خوادمنا بعد اكتمال التحليل.",
  },
  {
    title: "كيف نستخدم بياناتك؟",
    body:
      "• تقديم نتائج تحليل الطعام وفق نظام الطيبات.\n" +
      "• حفظ سجل تحليلاتك وعرضه لك.\n" +
      "• إرسال رمز إعادة تعيين كلمة المرور عند طلبك ذلك.\n" +
      "• تحسين دقة قاعدة بيانات الأطعمة بصورة مجمّعة وغير شخصية.",
  },
  {
    title: "مشاركة البيانات مع أطراف ثالثة",
    body:
      "نستخدم الخدمات التالية لتشغيل التطبيق:\n\n" +
      "• OpenAI — لتحليل الصور واستخراج المكونات. تخضع الصور لسياسة خصوصية OpenAI ولا تُستخدم لتدريب النماذج وفق شروط الاستخدام التجاري.\n" +
      "• Resend — لإرسال رسائل البريد الإلكتروني (إعادة تعيين كلمة المرور فقط).\n\n" +
      "لا نبيع بياناتك لأي طرف ثالث.",
  },
  {
    title: "تخزين البيانات وأمانها",
    body:
      "تُخزَّن بياناتك على خوادم آمنة. كلمات المرور مشفّرة ولا يمكن لأحد الاطلاع عليها. نحتفظ ببياناتك طالما حسابك نشط، ويمكنك طلب حذفها في أي وقت.",
  },
  {
    title: "حقوقك",
    body:
      "• الاطلاع على البيانات المحفوظة عنك.\n" +
      "• تصحيح أي معلومات غير دقيقة.\n" +
      "• طلب حذف حسابك وجميع بياناتك.\n\n" +
      "لممارسة أي من هذه الحقوق تواصل معنا عبر البريد الإلكتروني أدناه.",
  },
  {
    title: "الأطفال",
    body: "التطبيق موجّه للمستخدمين الذين تجاوزوا 13 عاماً. لا نجمع عمداً بيانات من الأطفال دون هذا السن.",
  },
  {
    title: "التعديلات على السياسة",
    body: "قد نحدّث هذه السياسة من وقت لآخر. سنعلمك بأي تغييرات جوهرية عبر إشعار داخل التطبيق أو البريد الإلكتروني.",
  },
  {
    title: "تواصل معنا",
    body: "إذا كانت لديك أسئلة حول سياسة الخصوصية، راسلنا على:\nprivacy@tayyibati.app",
  },
];

export default function PrivacyPolicyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-forward" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>
          سياسة الخصوصية
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Last updated */}
        <Text style={[styles.lastUpdated, { color: colors.mutedForeground }]}>
          آخر تحديث: يونيو 2025
        </Text>

        {SECTIONS.map((section, index) => (
          <View
            key={index}
            style={[
              styles.section,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionDot,
                  { backgroundColor: colors.primary },
                ]}
              />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {section.title}
              </Text>
            </View>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
              {section.body}
            </Text>
          </View>
        ))}

        {/* Footer note */}
        <View
          style={[
            styles.footerNote,
            {
              backgroundColor: colors.primary + "12",
              borderColor: colors.primary + "30",
            },
          ]}
        >
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={[styles.footerNoteText, { color: colors.primary }]}>
            بياناتك في أمان — لا نشارك معلوماتك الشخصية مع أي جهة تجارية
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Tajawal_700Bold",
    textAlign: "center",
    flex: 1,
  },
  scroll: {
    padding: 16,
    gap: 12,
  },
  lastUpdated: {
    fontSize: 12,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    marginBottom: 4,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    textAlign: "right",
  },
  sectionBody: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    textAlign: "right",
    lineHeight: 24,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Tajawal_500Medium",
    textAlign: "right",
    lineHeight: 20,
  },
});
