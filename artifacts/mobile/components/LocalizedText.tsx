import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { localizedText, localizedTextFull } from '@/lib/layoutDirection';

interface LocalizedTextProps extends TextProps {
  fullWidth?: boolean;
}

export function LocalizedText({ style, fullWidth = false, ...props }: LocalizedTextProps) {
  const directionStyle = fullWidth ? localizedTextFull() : localizedText();
  
  return (
    <Text 
      {...props} 
      style={[
        styles.defaultText,
        directionStyle,
        style
      ]} 
    />
  );
}

export function LocalizedParagraph({ style, ...props }: TextProps) {
  return (
    <LocalizedText 
      {...props} 
      fullWidth 
      style={[
        styles.paragraph,
        style
      ]} 
    />
  );
}

const styles = StyleSheet.create({
  defaultText: {
    fontFamily: 'Tajawal_400Regular',
  },
  paragraph: {
    lineHeight: 24,
  },
});
