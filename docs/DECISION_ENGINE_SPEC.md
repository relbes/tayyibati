# Decision Engine Specification

The Decision Engine evaluates the resolved ingredients of a dish to dynamically calculate its final dietary compatibility ruling and human-readable explanation.

---

## ⚖️ Ruling Evaluation Priority Order

The final ruling is calculated by evaluating ingredient statuses in strict hierarchical order:

```
1. Forbidden Ingredients Present (> 0)
       │ ── Yes ──► FINAL RULING = FORBIDDEN (Score: 0)
       ▼ No
2. Conditional Ingredients Present (> 0)
       │ ── Yes ──► FINAL RULING = CONDITIONAL (Score: 50)
       ▼ No
3. Allowed Ingredients Present (> 0) & Unknown == 0
       │ ── Yes ──► FINAL RULING = ALLOWED (Score: 100)
       ▼ No
4. Unknown Ingredients Present (> 0) & Allowed == 0
       └──────────► FINAL RULING = UNKNOWN (Score: 50)
```

---

## 🛑 Rules & Constraints

### 1. Forbidden Trumps All
- If **EVEN ONE** ingredient has status `forbidden`, the entire composite dish MUST be classified as `forbidden`.
- Example: `الكبسة السعودية باللحم` containing `الطماطم` (forbidden) $\rightarrow$ Ruling: `forbidden`.

---

### 2. Conditional Second Priority
- If no forbidden ingredients exist, but one or more ingredients are `conditional`, the dish is classified as `conditional`.
- Example: `مقلوبة باذنجان باللحم` containing `الباذنجان` (conditional) $\rightarrow$ Ruling: `conditional`.

---

### 3. Unknown Ingredient Protection Rule
- **CRITICAL:** Unknown ingredients alone MUST NEVER automatically make a dish `forbidden`.
- If a dish has allowed ingredients AND some unknown ingredients, the known allowed ingredients preserve the ruling, while unknown ingredients are highlighted in the `unknownIngredients` list for user awareness.
- If ALL ingredients are unknown, the dish ruling is `unknown`.

---

## 📖 Explanation Generation Rules

Every ruling generates concise summary texts and detailed explanation narratives in both Arabic and English:

### 1. Forbidden Ruling Explanation Pattern
- **Arabic Summary:** `طبق غير مسموح لوجود مكونات محظورة ([قائمة المكونات المحظورة]).`
- **English Summary:** `Dish is forbidden due to forbidden ingredients ([Forbidden Ingredients List]).`

### 2. Conditional Ruling Explanation Pattern
- **Arabic Summary:** `طبق مشروط يتطلب الانتباه للمكونات ([قائمة المكونات المشروطة]).`
- **English Summary:** `Dish is conditional. Pay attention to ingredients ([Conditional Ingredients List]).`

### 3. Allowed Ruling Explanation Pattern
- **Arabic Summary:** `طبق مسموح وصحي. جميع المكونات مسموحة.`
- **English Summary:** `Dish is allowed and healthy. All ingredients are allowed.`

### 4. Unknown Ruling Explanation Pattern
- **Arabic Summary:** `النتيجة غير معروفة لعدم توفر مكونات الطبق في قاعدة البيانات.`
- **English Summary:** `Unknown result as ingredients are not in database.`
