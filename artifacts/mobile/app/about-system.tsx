import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { isRTL } from "@/lib/i18n";

export default function AboutSystemScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const rtl = isRTL();
  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const eatingLaws = [
    rtl ? "تناول الطعام عند الشعور بالجوع الحقيقي." : "Eat food when feeling true hunger.",
    rtl ? "شرب الماء عند الشعور بالعطش." : "Drink water when feeling thirsty.",
    rtl ? "التوقف عن تناول الطعام بمجرد الوصول إلى الشبع." : "Stop eating as soon as fullness is reached.",
    rtl ? "لا توجد مواعيد ثابتة للوجبات، ويعتمد النظام على الاستماع لإشارات الجسم الطبيعية." : "There are no fixed meal times; the system relies on listening to natural body signals.",
  ];

  const basicRules = [
    rtl ? "تناول الطعام عند الشعور بالجوع." : "Eat when feeling hungry.",
    rtl ? "شرب الماء عند الشعور بالعطش." : "Drink water when feeling thirsty.",
    rtl ? "التوقف عند الشبع." : "Stop when full.",
    rtl ? "تجنب الإفراط في تناول الطعام." : "Avoid overeating.",
    rtl ? "اختيار الأغذية الطبيعية والبسيطة." : "Choose natural and simple foods.",
    rtl ? "التقليل من الأغذية المصنعة." : "Reduce processed foods.",
    rtl ? "المحافظة على النشاط البدني اليومي." : "Maintain daily physical activity.",
  ];

  const sampleMeals = [
    rtl ? "🍞 توست مع جبنة ومربى" : "🍞 Toast with Cheese & Jam",
    rtl ? "🍯 توست مع طحينة وعسل" : "🍯 Toast with Tahini & Honey",
    rtl ? "🧈 توست مع زبدة وزيتون" : "🧈 Toast with Butter & Olives",
    rtl ? "🍖 لحم بقري مع أرز" : "🍖 Beef with Rice",
    rtl ? "🐟 سمك مشوي مع فريك" : "🐟 Grilled Fish with Freekeh",
    rtl ? "🥩 لحم ضأن مع فريك" : "🥩 Lamb Meat with Freekeh",
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.titleRow, { flexDirection: rtl ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: colors.muted }]}
            >
              <View>
                <Icon name={rtl ? "arrow-forward" : "arrow-back"} size={20} color={colors.foreground} />
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: rtl ? "flex-end" : "flex-start" }}>
              <Text style={[styles.pageTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
                {rtl ? "عن نظام الطيبات" : "About Tayyibati System"}
              </Text>
              <Text style={[styles.pageSubtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
                {rtl ? "تعرف على فلسفة النظام وقواعده الأساسية" : "Learn about the philosophy and core rules of the system"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.contentBody}>
          {/* Section 1: Warning Card */}
          <View style={[styles.warningCard, { backgroundColor: "#FEF7E0", borderColor: "#FBBC04" }]}>
            <View style={[styles.warningHeader, { flexDirection: rtl ? "row-reverse" : "row" }]}>
              <Icon name="alert-circle" size={22} color="#B06000" />
              <Text style={[styles.warningTitle, { color: "#B06000" }]}>
                {rtl ? "تنبيه" : "Disclaimer"}
              </Text>
            </View>
            <Text style={[styles.warningText, { color: "#B06000", textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "هذا المحتوى يهدف إلى التعريف بمبادئ نظام الطيبات كما هو متداول، وهو لأغراض تثقيفية فقط. لا يُعد بديلاً عن الاستشارة الطبية أو العلاج، ويُنصح دائمًا باستشارة الطبيب أو أخصائي التغذية قبل إجراء أي تغيير جوهري في النظام الغذائي أو إيقاف أي دواء موصوف."
                : "This content is intended to introduce the principles of the Tayyibati system for educational purposes only. It is not a substitute for medical advice or treatment. Always consult a doctor or nutritionist before making significant dietary changes or stopping prescribed medications."}
            </Text>
          </View>

          {/* Section 2: Philosophy */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "🌿 فلسفة النظام" : "🌿 System Philosophy"}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "يعتمد نظام الطيبات على فكرة أن اختيار نوعية الطعام وطريقة تناوله قد يكون لهما تأثير على راحة الجهاز الهضمي والصحة العامة."
                : "The Tayyibati system is based on the idea that food quality and eating habits have a direct impact on digestive comfort and general health."}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left", marginTop: 10 }]}>
              {rtl
                ? "ويركز النظام على تشجيع الأغذية الطبيعية والبسيطة، مع تقليل الأطعمة التي يعتبرها النظام أكثر إرهاقًا للهضم."
                : "The system emphasizes natural and simple foods while reducing items considered heavy or burdensome for digestion."}
            </Text>
          </View>

          {/* Section 3: Eating Laws */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "🍽️ قوانين الأكل" : "🍽️ Eating Laws"}
            </Text>
            <View style={styles.bulletList}>
              {eatingLaws.map((law, index) => (
                <View
                  key={index}
                  style={[
                    styles.bulletCard,
                    { backgroundColor: colors.muted, borderColor: colors.border, flexDirection: rtl ? "row-reverse" : "row" },
                  ]}
                >
                  <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.bulletText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
                    {law}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 4: Fuel & Waste Equation */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "⚖️ معادلة الوقود والعوادم" : "⚖️ Fuel & Waste Equation"}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "يشبّه النظام الطعام بالوقود؛ فكلما كان الطعام أبسط وأقرب إلى طبيعته، كان إنتاج الفضلات الناتجة عن الهضم أقل."
                : "The system compares food to fuel: the simpler and closer to nature the food is, the fewer metabolic waste products it generates."}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left", marginTop: 10 }]}>
              {rtl
                ? "أما الأطعمة التي تحتاج إلى هضم معقد أو تترك بقايا كثيرة، فيرى النظام أنها قد تزيد العبء على الجهاز الهضمي والجهاز المناعي."
                : "Foods requiring complex digestion or leaving substantial residues are viewed as imposing extra burden on the digestive and immune systems."}
            </Text>
          </View>

          {/* Section 5: Fasting & Rest */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "⏳ فترات الانقطاع عن الطعام" : "⏳ Meal Intermissions"}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "يشجع النظام على وجود فترات راحة بين الوجبات وعدم تناول الطعام بشكل متواصل طوال اليوم."
                : "The system encourages rest intervals between meals rather than continuous eating throughout the day."}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left", marginTop: 10 }]}>
              {rtl
                ? "ويرى أن هذه الفترات تمنح الجسم فرصة للراحة ودعم العمليات الطبيعية وتجديد الخلايا."
                : "These fasting intervals allow the body opportunity to rest, support natural biological processes, and promote cell renewal."}
            </Text>
          </View>

          {/* Section 6: Fundamental Rules Checklist */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "📋 القواعد الأساسية" : "📋 Core Checklist"}
            </Text>
            <View style={styles.checklist}>
              {basicRules.map((rule, idx) => (
                <View
                  key={idx}
                  style={[styles.checkRow, { flexDirection: rtl ? "row-reverse" : "row" }]}
                >
                  <View style={[styles.checkBadge, { backgroundColor: "#E6F4EA" }]}>
                    <Text style={{ color: "#34A853", fontWeight: "bold" }}>✓</Text>
                  </View>
                  <Text style={[styles.checkText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
                    {rule}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 7: Compatible Meals Examples */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "🍽️ أمثلة على وجبات متوافقة مع النظام" : "🍽️ Compatible Meal Examples"}
            </Text>
            <View style={[styles.chipsWrap, { flexDirection: rtl ? "row-reverse" : "row" }]}>
              {sampleMeals.map((meal, index) => (
                <View
                  key={index}
                  style={[
                    styles.mealChip,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.mealChipText, { color: colors.foreground }]}>
                    {meal}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Section 8: Perspectives */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "🔍 وجهات نظر مختلفة" : "🔍 Different Perspectives"}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "توجد آراء متعددة حول نظام الطيبات، فبينما يرى بعض متبعيه أنه ساعدهم على تحسين نمطهم الغذائي، يشير عدد من الأطباء وأخصائيي التغذية إلى أن بعض مبادئه تحتاج إلى مزيد من الدراسات العلمية."
                : "Diverse views exist regarding the Tayyibati system. While followers report dietary improvements, medical professionals note that certain principles require further scientific studies."}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left", marginTop: 10 }]}>
              {rtl
                ? "يعرض تطبيق طيباتي هذه المعلومات بهدف التوعية، ويُنصح دائمًا باستشارة المختصين قبل اعتماد أي نظام غذائي بشكل كامل."
                : "Tayyibati displays this information for educational awareness. Always consult medical specialists before fully adopting any dietary regimen."}
            </Text>
          </View>

          {/* Section 9: About Tayyibati App */}
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl ? "💚 عن تطبيق طيباتي" : "💚 About Tayyibati App"}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>
              {rtl
                ? "يساعدك تطبيق طيباتي على التحقق من توافق الأطعمة مع نظام الطيبات من خلال قاعدة بيانات يتم تحديثها باستمرار، بالإضافة إلى البحث النصي وتحليل الصور."
                : "Tayyibati helps you verify food compatibility with the Tayyibati system through a continuously updated database, text search, and image analysis."}
            </Text>
            <Text style={[styles.bodyText, { color: colors.foreground, textAlign: rtl ? "right" : "left", marginTop: 10 }]}>
              {rtl
                ? "هدف التطبيق هو تسهيل الوصول إلى المعلومات بطريقة منظمة وسريعة."
                : "The goal of the app is to make information accessible in an organized and fast manner."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: "Tajawal_700Bold",
  },
  pageSubtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    marginTop: 2,
  },
  contentBody: {
    padding: 16,
    gap: 16,
  },
  warningCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  warningHeader: {
    alignItems: "center",
    gap: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
  warningText: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 20,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    fontFamily: "Tajawal_400Regular",
    lineHeight: 22,
  },
  bulletList: {
    gap: 8,
  },
  bulletCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
    lineHeight: 20,
  },
  checklist: {
    gap: 10,
  },
  checkRow: {
    alignItems: "center",
    gap: 10,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Tajawal_500Medium",
  },
  chipsWrap: {
    flexWrap: "wrap",
    gap: 10,
  },
  mealChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  mealChipText: {
    fontSize: 13,
    fontFamily: "Tajawal_700Bold",
  },
});
