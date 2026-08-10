import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { LocalizedText } from './LocalizedText';
import { localizedRow } from '@/lib/layoutDirection';
import { t } from '@/lib/i18n';

export function HomePopularSearches({ onSelect }: { onSelect: (query: string) => void }) {
  const colors = useColors();
  const popular = ["حليب", "خبز", "أرز", "جبن", "شوكولاتة", "دجاج"];

  return (
    <View style={styles.container}>
      <LocalizedText style={[styles.sectionTitle, { color: colors.foreground }]}>
        {t("home.popularSearches")}
      </LocalizedText>
      <View style={[localizedRow(), styles.chipContainer]}>
        {popular.map((term, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.chip, { backgroundColor: colors.muted }]}
            onPress={() => onSelect(term)}
            activeOpacity={0.7}
          >
            <LocalizedText style={[styles.chipText, { color: colors.foreground }]}>
              {term}
            </LocalizedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 32, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Tajawal_700Bold', marginBottom: 16 },
  chipContainer: { flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  chipText: { fontSize: 14, fontFamily: 'Tajawal_500Medium' }
});
