import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LocalizedText, LocalizedParagraph } from './LocalizedText';
import { isRTL } from '@/lib/i18n';
import { t } from '@/lib/i18n';
import { useRouter } from 'expo-router';

export function HomeQuickActions({ focusSearch }: { focusSearch: () => void }) {
  const colors = useColors();
  const router = useRouter();

  const cards = [
    {
      icon: "search",
      title: t("home.searchFood"),
      desc: t("home.searchFoodDesc"),
      onPress: focusSearch,
      color: colors.primary
    },
    {
      icon: "camera",
      title: t("home.analyzeImage"),
      desc: t("home.analyzeImageDesc"),
      onPress: () => router.push("/(tabs)/camera?action=camera"),
      color: colors.secondaryForeground
    },
    {
      icon: "scan",
      title: t("home.scanIngredients"),
      desc: t("home.scanIngredientsDesc"),
      onPress: () => router.push("/(tabs)/camera?action=camera"),
      color: colors.accent
    },
    {
      icon: "book",
      title: t("home.exploreDatabase"),
      desc: t("home.exploreDatabaseDesc"),
      onPress: () => router.push("/(tabs)/browse"),
      color: colors.primary
    },
    {
      icon: "information-circle",
      title: t("home.aboutSystem"),
      desc: t("home.aboutSystemDesc"),
      onPress: () => router.push("/about-system"),
      color: colors.primary
    }
  ];

  return (
    <View style={styles.container}>
      <LocalizedText style={[styles.sectionTitle, { color: colors.foreground, width: "100%", textAlign: isRTL() ? "right" : "left" }]}>
        {t("home.quickActions")}
      </LocalizedText>
      
      <View style={styles.cards}>
        {cards.map((card, i) => (
          <TouchableOpacity 
            key={i}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={card.onPress}
          >
            <View style={{ flexDirection: isRTL() ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              <View style={[styles.iconBox, { backgroundColor: card.color + "15" }, isRTL() ? { marginLeft: 12 } : { marginRight: 12 }]}>
                <Icon name={card.icon as any} size={20} color={card.color} />
              </View>
              <View style={{ flex: 1, alignItems: isRTL() ? 'flex-end' : 'flex-start' }}>
                <LocalizedText style={[styles.cardTitle, { color: colors.foreground }]}>
                  {card.title}
                </LocalizedText>
                <LocalizedParagraph style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                  {card.desc}
                </LocalizedParagraph>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 32, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Tajawal_700Bold', marginBottom: 16 },
  cards: { gap: 12 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontFamily: 'Tajawal_700Bold', marginBottom: 4 },
  cardDesc: { fontSize: 14, fontFamily: 'Tajawal_400Regular' }
});
