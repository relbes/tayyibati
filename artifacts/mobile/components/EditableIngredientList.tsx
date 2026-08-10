import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { isRTL } from "@/lib/i18n";

interface Props {
  initialIngredients: string[];
  onReanalyze: (ingredientsText: string) => void;
}

export function EditableIngredientList({ initialIngredients, onReanalyze }: Props) {
  const colors = useColors();
  const [ingredients, setIngredients] = useState<string[]>(initialIngredients);
  const [newIngredient, setNewIngredient] = useState("");
  const rtl = isRTL();

  const handleRemove = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const val = newIngredient.trim();
    if (val && !ingredients.includes(val)) {
      setIngredients((prev) => [...prev, val]);
      setNewIngredient("");
    }
  };

  const handleSubmit = () => {
    if (ingredients.length > 0) {
      onReanalyze(ingredients.join("، "));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: rtl ? "right" : "left" }]}>مكونات محتملة حسب طريقة التحضير:</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: rtl ? "right" : "left" }]}>
        هذا الطعام غير مسجل لدينا، فقمنا بتحليل المكونات المحتملة. يمكنك تعديلها للحصول على نتيجة دقيقة.
      </Text>

      <View style={styles.list}>
        {ingredients.map((ing, idx) => (
          <View key={idx} style={[styles.ingredientRow, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: rtl ? "row-reverse" : "row" }]}>
            <Text style={[styles.ingredientText, { color: colors.foreground, flex: 1, textAlign: rtl ? "right" : "left" }]}>{ing}</Text>
            <TouchableOpacity onPress={() => handleRemove(idx)} style={styles.removeBtn}>
              <Icon name="x" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={[styles.addReqContainer, { flexDirection: rtl ? "row-reverse" : "row" }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, textAlign: rtl ? "right" : "left", writingDirection: rtl ? "rtl" : "ltr" }]}
          placeholder="إضافة مكون..."
          placeholderTextColor={colors.mutedForeground}
          value={newIngredient}
          onChangeText={setNewIngredient}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleAdd}>
          <Icon name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: ingredients.length === 0 ? 0.5 : 1 }]}
        onPress={handleSubmit}
        disabled={ingredients.length === 0}
      >
        <Text style={styles.submitBtnText}>إعادة التحليل بالمكونات المحددة</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 12,
    width: "100%",
  },
  title: {
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
    marginBottom: 4,
    width: "100%",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Tajawal_400Regular",
    marginBottom: 16,
    lineHeight: 18,
    width: "100%",
  },
  list: {
    gap: 8,
    marginBottom: 16,
  },
  ingredientRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
  },
  ingredientText: {
    fontSize: 15,
    fontFamily: "Tajawal_500Medium",
  },
  removeBtn: {
    padding: 4,
  },
  addReqContainer: {
    gap: 8,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: "Tajawal_400Regular",
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtn: {
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Tajawal_700Bold",
  },
});
