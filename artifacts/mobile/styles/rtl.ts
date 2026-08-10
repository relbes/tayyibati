import { StyleSheet, ViewStyle, TextStyle } from "react-native";

export const rtlStyles = StyleSheet.create({
  container: {
    direction: "rtl",
    flex: 1,
  },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
  },
  text: {
    writingDirection: "rtl",
    textAlign: "right",
  },
  textInput: {
    writingDirection: "rtl",
    textAlign: "right",
  },
});

export const getRTLRowStyle = (extraStyles?: ViewStyle | ViewStyle[]) => {
  return [rtlStyles.row, extraStyles];
};

export const getArabicTextStyle = (extraStyles?: TextStyle | TextStyle[]) => {
  return [rtlStyles.text, extraStyles];
};
