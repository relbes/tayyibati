import { db } from "@workspace/db";
import { foodsTable } from "@workspace/db";

const foods = [
  // === FORBIDDEN ===
  { nameAr: "لحم الخنزير", nameEn: "pork", category: "لحوم", status: "forbidden" as const, reason: "ممنوع شرعاً - من أصل الخنزير" },
  { nameAr: "لحم الخنزير المقدد", nameEn: "bacon", category: "لحوم", status: "forbidden" as const, reason: "من لحم الخنزير" },
  { nameAr: "هام الخنزير", nameEn: "ham", category: "لحوم", status: "forbidden" as const, reason: "من لحم الخنزير" },
  { nameAr: "السجق الخنزير", nameEn: "pork sausage", category: "لحوم", status: "forbidden" as const, reason: "من لحم الخنزير" },
  { nameAr: "الكحول", nameEn: "alcohol", category: "مواد كيميائية", status: "forbidden" as const, reason: "مسكر ممنوع" },
  { nameAr: "النبيذ", nameEn: "wine", category: "مشروبات", status: "forbidden" as const, reason: "مسكر" },
  { nameAr: "البيرة", nameEn: "beer", category: "مشروبات", status: "forbidden" as const, reason: "مسكر" },
  { nameAr: "شحم الخنزير", nameEn: "lard", category: "دهون", status: "forbidden" as const, reason: "من الخنزير" },
  { nameAr: "جيلاتين الخنزير", nameEn: "pork gelatin", category: "إضافات", status: "forbidden" as const, reason: "من الخنزير" },
  { nameAr: "الخمر", nameEn: "spirits", category: "مشروبات", status: "forbidden" as const, reason: "مسكر ممنوع" },
  { nameAr: "دم الحيوانات", nameEn: "animal blood", category: "أخرى", status: "forbidden" as const, reason: "الدم نجس" },
  { nameAr: "لحوم الميتة", nameEn: "carrion", category: "لحوم", status: "forbidden" as const, reason: "ميتة ممنوعة" },
  { nameAr: "ريتشارد ستيبرات", nameEn: "rennet pork", category: "إضافات", status: "forbidden" as const, reason: "من الخنزير" },

  // === CONDITIONAL ===
  { nameAr: "الجيلاتين", nameEn: "gelatin", category: "إضافات", status: "conditional" as const, reason: "يعتمد على المصدر - جيلاتين مسموح" },
  { nameAr: "إنزيمات اللحوم", nameEn: "meat enzymes", category: "إضافات", status: "conditional" as const, reason: "يعتمد على المصدر" },
  { nameAr: "مستخلص اللحم", nameEn: "meat extract", category: "إضافات", status: "conditional" as const, reason: "يعتمد على مصدر اللحم" },
  { nameAr: "دهون الحيوانات", nameEn: "animal fat", category: "دهون", status: "conditional" as const, reason: "مسموح إن كان من ذبح شرعي" },
  { nameAr: "الكارمين", nameEn: "carmine", category: "ألوان", status: "conditional" as const, reason: "من الحشرات - خلاف بين العلماء" },
  { nameAr: "مصل اللبن", nameEn: "whey", category: "ألبان", status: "conditional" as const, reason: "مسموح إن لم يحتوي على أنفحة خنزير" },
  { nameAr: "الفانيليا الطبيعية", nameEn: "natural vanilla", category: "نكهات", status: "conditional" as const, reason: "قد يحتوي على كحول في الاستخلاص" },
  { nameAr: "خميرة الخبز", nameEn: "yeast extract", category: "إضافات", status: "conditional" as const, reason: "مسموح في الغالب، تحقق من المصدر" },

  // === ALLOWED ===
  { nameAr: "لحم البقر", nameEn: "beef", category: "لحوم", status: "allowed" as const, reason: null },
  { nameAr: "لحم الدجاج", nameEn: "chicken", category: "لحوم", status: "allowed" as const, reason: null },
  { nameAr: "لحم الغنم", nameEn: "lamb", category: "لحوم", status: "allowed" as const, reason: null },
  { nameAr: "لحم الضأن", nameEn: "mutton", category: "لحوم", status: "allowed" as const, reason: null },
  { nameAr: "لحم الإبل", nameEn: "camel meat", category: "لحوم", status: "allowed" as const, reason: null },
  { nameAr: "السمك", nameEn: "fish", category: "مأكولات بحرية", status: "allowed" as const, reason: null },
  { nameAr: "الجمبري", nameEn: "shrimp", category: "مأكولات بحرية", status: "allowed" as const, reason: null },
  { nameAr: "الحبار", nameEn: "squid", category: "مأكولات بحرية", status: "allowed" as const, reason: null },
  { nameAr: "التونا", nameEn: "tuna", category: "مأكولات بحرية", status: "allowed" as const, reason: null },
  { nameAr: "السلمون", nameEn: "salmon", category: "مأكولات بحرية", status: "allowed" as const, reason: null },
  { nameAr: "الحليب", nameEn: "milk", category: "ألبان", status: "allowed" as const, reason: null },
  { nameAr: "الجبن", nameEn: "cheese", category: "ألبان", status: "allowed" as const, reason: null },
  { nameAr: "اللبن", nameEn: "yogurt", category: "ألبان", status: "allowed" as const, reason: null },
  { nameAr: "الزبدة", nameEn: "butter", category: "ألبان", status: "allowed" as const, reason: null },
  { nameAr: "القشدة", nameEn: "cream", category: "ألبان", status: "allowed" as const, reason: null },
  { nameAr: "البيض", nameEn: "eggs", category: "بروتين", status: "allowed" as const, reason: null },
  { nameAr: "القمح", nameEn: "wheat", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "الطحين", nameEn: "flour", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "الأرز", nameEn: "rice", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "الشعير", nameEn: "barley", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "الذرة", nameEn: "corn", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "الشوفان", nameEn: "oats", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "السكر", nameEn: "sugar", category: "محليات", status: "allowed" as const, reason: null },
  { nameAr: "العسل", nameEn: "honey", category: "محليات", status: "allowed" as const, reason: null },
  { nameAr: "الملح", nameEn: "salt", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الفلفل الأسود", nameEn: "black pepper", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الكركم", nameEn: "turmeric", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الزنجبيل", nameEn: "ginger", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الثوم", nameEn: "garlic", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "البصل", nameEn: "onion", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "الطماطم", nameEn: "tomato", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "الخيار", nameEn: "cucumber", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "الجزر", nameEn: "carrot", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "البطاطس", nameEn: "potatoes", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "الفلفل", nameEn: "pepper", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "الخس", nameEn: "lettuce", category: "خضروات", status: "allowed" as const, reason: null },
  { nameAr: "البقدونس", nameEn: "parsley", category: "أعشاب", status: "allowed" as const, reason: null },
  { nameAr: "الكزبرة", nameEn: "coriander", category: "أعشاب", status: "allowed" as const, reason: null },
  { nameAr: "النعناع", nameEn: "mint", category: "أعشاب", status: "allowed" as const, reason: null },
  { nameAr: "التفاح", nameEn: "apple", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "البرتقال", nameEn: "orange", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "الموز", nameEn: "banana", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "العنب", nameEn: "grapes", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "الفراولة", nameEn: "strawberry", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "التمر", nameEn: "dates", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "الليمون", nameEn: "lemon", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "المانجو", nameEn: "mango", category: "فواكه", status: "allowed" as const, reason: null },
  { nameAr: "زيت الزيتون", nameEn: "olive oil", category: "زيوت", status: "allowed" as const, reason: null },
  { nameAr: "زيت عباد الشمس", nameEn: "sunflower oil", category: "زيوت", status: "allowed" as const, reason: null },
  { nameAr: "زيت النخيل", nameEn: "palm oil", category: "زيوت", status: "allowed" as const, reason: null },
  { nameAr: "زيت الذرة", nameEn: "corn oil", category: "زيوت", status: "allowed" as const, reason: null },
  { nameAr: "زيت جوز الهند", nameEn: "coconut oil", category: "زيوت", status: "allowed" as const, reason: null },
  { nameAr: "الشوكولاته", nameEn: "chocolate", category: "حلويات", status: "allowed" as const, reason: null },
  { nameAr: "الكاكاو", nameEn: "cocoa", category: "حلويات", status: "allowed" as const, reason: null },
  { nameAr: "السمسم", nameEn: "sesame", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "اللوز", nameEn: "almonds", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "الفستق", nameEn: "pistachio", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "الجوز", nameEn: "walnuts", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "الفول السوداني", nameEn: "peanuts", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "بذور الشيا", nameEn: "chia seeds", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "دقيق الأرز", nameEn: "rice flour", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "النشا", nameEn: "starch", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "نشا الذرة", nameEn: "corn starch", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "العدس", nameEn: "lentils", category: "بقوليات", status: "allowed" as const, reason: null },
  { nameAr: "الحمص", nameEn: "chickpeas", category: "بقوليات", status: "allowed" as const, reason: null },
  { nameAr: "الفول", nameEn: "fava beans", category: "بقوليات", status: "allowed" as const, reason: null },
  { nameAr: "الفاصوليا", nameEn: "beans", category: "بقوليات", status: "allowed" as const, reason: null },
  { nameAr: "بيكنج باودر", nameEn: "baking powder", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "صودا الخبيز", nameEn: "baking soda", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "الخميرة", nameEn: "yeast", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "حمض الستريك", nameEn: "citric acid", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "حمض اللاكتيك", nameEn: "lactic acid", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "فيتامين سي", nameEn: "vitamin c", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "الماء", nameEn: "water", category: "أخرى", status: "allowed" as const, reason: null },
  { nameAr: "الخل", nameEn: "vinegar", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "خل التفاح", nameEn: "apple cider vinegar", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "صلصة الطماطم", nameEn: "tomato sauce", category: "صلصات", status: "allowed" as const, reason: null },
  { nameAr: "معجون الطماطم", nameEn: "tomato paste", category: "صلصات", status: "allowed" as const, reason: null },
  { nameAr: "الخردل", nameEn: "mustard", category: "صلصات", status: "allowed" as const, reason: null },
  { nameAr: "المايونيز المسموح", nameEn: "halal mayonnaise", category: "صلصات", status: "allowed" as const, reason: null },
  { nameAr: "الزعتر", nameEn: "thyme", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "القرفة", nameEn: "cinnamon", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الهيل", nameEn: "cardamom", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الكمون", nameEn: "cumin", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الكزبرة المطحونة", nameEn: "ground coriander", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "الشطة", nameEn: "chili", category: "توابل", status: "allowed" as const, reason: null },
  { nameAr: "المكسرات المشكلة", nameEn: "mixed nuts", category: "مكسرات وبذور", status: "allowed" as const, reason: null },
  { nameAr: "الأعشاب البحرية", nameEn: "seaweed", category: "مأكولات بحرية", status: "allowed" as const, reason: null },
  { nameAr: "صلصة الصويا", nameEn: "soy sauce", category: "صلصات", status: "allowed" as const, reason: null },
  { nameAr: "الفانيليا الصناعية", nameEn: "artificial vanilla", category: "نكهات", status: "allowed" as const, reason: null },
  { nameAr: "الإيمولسيفاير النباتي", nameEn: "plant emulsifier", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "مستخلص الشعير", nameEn: "malt extract", category: "إضافات", status: "allowed" as const, reason: null },
  { nameAr: "بروتين الصويا", nameEn: "soy protein", category: "بروتين", status: "allowed" as const, reason: null },
  { nameAr: "دقيق الصويا", nameEn: "soy flour", category: "حبوب", status: "allowed" as const, reason: null },
  { nameAr: "زيت الصويا", nameEn: "soy oil", category: "زيوت", status: "allowed" as const, reason: null },
];

async function seed() {
  console.log("Seeding foods database...");
  try {
    // Check if already seeded
    const existing = await db.select().from(foodsTable).limit(1);
    if (existing.length > 0) {
      console.log("Database already has data, skipping seed");
      return;
    }
    
    for (const food of foods) {
      await db.insert(foodsTable).values(food).onConflictDoNothing();
    }
    console.log(`Seeded ${foods.length} foods successfully`);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

seed().then(() => process.exit(0));
