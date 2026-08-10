import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LocalizedText, LocalizedParagraph } from './LocalizedText';
import { localizedRow } from '@/lib/layoutDirection';
import { t } from '@/lib/i18n';

export function HomeSearchEducation() {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
      <View style={[localizedRow(), { alignItems: 'flex-start' }]}>
        <Icon name="information-circle" size={20} color={colors.primary} />
        <View style={{ flex: 1, marginEnd: 12 }}>
          <LocalizedText style={[styles.title, { color: colors.primary }]}>
            {t("home.betterResultTitle")}
          </LocalizedText>
          <LocalizedParagraph style={[styles.desc, { color: colors.foreground }]}>
            {t("home.betterResultDesc")}
          </LocalizedParagraph>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 32, marginHorizontal: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  title: { fontSize: 16, fontFamily: 'Tajawal_700Bold', marginBottom: 8 },
  desc: { fontSize: 14, fontFamily: 'Tajawal_400Regular' }
});
