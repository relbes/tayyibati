import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '@/components/Icon';
import { useColors } from '@/hooks/useColors';
import { LocalizedText } from './LocalizedText';
import { useRouter } from 'expo-router';
import { isRTL, t } from '@/lib/i18n';

export function HomeImageActions() {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <LocalizedText style={[styles.title, { color: colors.mutedForeground, textAlign: 'center' }]}>
        {t("home.orVerifyWithImage")}
      </LocalizedText>
      <View style={styles.buttons}>
        <TouchableOpacity 
          style={[{ flexDirection: isRTL() ? 'row-reverse' : 'row' }, styles.button, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
          onPress={() => router.push("/(tabs)/camera?action=camera")}
        >
          <Icon name="camera" size={24} color="#fff" />
          <LocalizedText style={[styles.buttonText, { color: '#fff' }]}>
            {t("home.takePhoto")}
          </LocalizedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[{ flexDirection: isRTL() ? 'row-reverse' : 'row' }, styles.button, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }]}
          activeOpacity={0.8}
          onPress={() => router.push("/(tabs)/camera?action=gallery")}
        >
          <Icon name="images" size={24} color={colors.secondaryForeground} />
          <LocalizedText style={[styles.buttonText, { color: colors.secondaryForeground }]}>
            {t("home.chooseFromGallery")}
          </LocalizedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24, paddingHorizontal: 16 },
  title: { fontSize: 14, fontFamily: 'Tajawal_500Medium', marginBottom: 12 },
  buttons: { gap: 12 },
  button: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    borderRadius: 12,
    gap: 12
  },
  buttonText: { fontSize: 18, fontFamily: 'Tajawal_700Bold', textAlign: 'center' }
});
