import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LocalizedText, LocalizedParagraph } from './LocalizedText';
import { isRTL, t } from '@/lib/i18n';

const DISCLAIMERS = [
  t("firstRun.disclaimer1"),
  t("firstRun.disclaimer2"),
  t("firstRun.disclaimer3")
];

export function FirstRunAcknowledgment({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState([false, false, false]);
  const colors = useColors();

  const toggleCheck = (index: number) => {
    const newChecked = [...checked];
    newChecked[index] = !newChecked[index];
    setChecked(newChecked);
  };

  const allChecked = checked.every(c => c);
  const checkedCount = checked.filter(c => c).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LocalizedText style={[styles.title, { color: colors.foreground, width: "100%", textAlign: isRTL() ? "right" : "left" }]}>{t("firstRun.title")}</LocalizedText>
        <LocalizedParagraph style={[styles.subtitle, { color: colors.mutedForeground, textAlign: isRTL() ? "right" : "left" }]}>
          {t("firstRun.subtitle")}
        </LocalizedParagraph>

        <View style={styles.cards}>
          {DISCLAIMERS.map((text, i) => (
            <TouchableOpacity 
              key={i}
              style={[
                styles.card, 
                { 
                  backgroundColor: colors.card,
                  borderColor: checked[i] ? colors.primary : colors.border
                }
              ]}
              onPress={() => toggleCheck(i)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: isRTL() ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
                <View style={[styles.checkbox, { borderColor: checked[i] ? colors.primary : colors.border, backgroundColor: checked[i] ? colors.primary : 'transparent' }, isRTL() ? { marginLeft: 16 } : { marginRight: 16 }]}>
                  {checked[i] && <Icon name="checkmark" size={16} color="#fff" />}
                </View>
                <LocalizedParagraph style={[styles.cardText, { color: colors.foreground, flex: 1, textAlign: isRTL() ? "right" : "left" }]}>
                  {text}
                </LocalizedParagraph>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
        <LocalizedText style={[styles.progress, { color: colors.mutedForeground, textAlign: 'center' }]}>
          {checkedCount} / 3
        </LocalizedText>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: allChecked ? colors.primary : colors.muted }]}
          disabled={!allChecked}
          onPress={onAccept}
        >
          <LocalizedText style={[styles.buttonText, { color: allChecked ? '#fff' : colors.mutedForeground, textAlign: 'center' }]}>
            {t("firstRun.enterApp")}
          </LocalizedText>
        </TouchableOpacity>
        <LocalizedParagraph style={[styles.footerText, { color: colors.mutedForeground, textAlign: 'center' }]}>
          {t("firstRun.footerText")}
        </LocalizedParagraph>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontFamily: 'Tajawal_700Bold', marginBottom: 8, },
  subtitle: { fontSize: 16, fontFamily: 'Tajawal_400Regular', marginBottom: 32 },
  cards: { gap: 16 },
  card: { padding: 16, borderRadius: 12, borderWidth: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cardText: { fontSize: 15, fontFamily: 'Tajawal_500Medium' },
  footer: { padding: 24, borderTopWidth: 1 },
  progress: { fontSize: 16, fontFamily: 'Tajawal_500Medium', marginBottom: 16 },
  button: { paddingVertical: 16, borderRadius: 12, marginBottom: 16 },
  buttonText: { fontSize: 18, fontFamily: 'Tajawal_700Bold' },
  footerText: { fontSize: 12, fontFamily: 'Tajawal_400Regular' }
});
