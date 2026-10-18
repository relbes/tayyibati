import { db, foodsTable, dishes, foodAliases } from '@workspace/db';
import { ilike, or, eq } from 'drizzle-orm';
import { UnifiedAnalysisEngine } from './lib/unifiedAnalysisEngine';
import { CanonicalSearchEngine } from './lib/canonicalSearchEngine';
import { IntentClassificationEngine } from './lib/intentClassificationEngine';
import { getKnowledgeCache } from './lib/knowledgeCache';
import { warmDishEngineCache } from './lib/dishCompatibilityEngine';

async function runAudit() {
  console.log('================================================================================');
  console.log('  TAYYIBATI AUDIT: ISSUE A (CALORIES), ISSUE B (ORANGE), ISSUE C (MACARONI)     ');
  console.log('================================================================================\n');

  await warmDishEngineCache();
  const cache = await getKnowledgeCache();

  // ============================================================================
  // ISSUE B: ORANGE JUICE DB RECORDS & TRACE
  // ============================================================================
  console.log('--------------------------------------------------------------------------------');
  console.log('ISSUE B: ORANGE JUICE AUDIT');
  console.log('--------------------------------------------------------------------------------');

  const orangeDbFoods = await db.select().from(foodsTable).where(
    or(
      ilike(foodsTable.nameAr, '%برتقال%'),
      ilike(foodsTable.nameAr, '%عصير%'),
      ilike(foodsTable.nameEn, '%orange%')
    )
  );

  console.log(`Found ${orangeDbFoods.length} foods matching 'برتقال' / 'عصير' / 'orange':`);
  for (const f of orangeDbFoods) {
    console.log(`  [Food #${f.id}] "${f.nameAr}" | En: "${f.nameEn}" | Cat: "${f.category}" | Status: "${f.status}" | Reason: "${f.reason}" | Notes: "${f.notes}"`);
  }

  const orangeAliases = await db.select().from(foodAliases).where(
    or(
      ilike(foodAliases.aliasAr, '%برتقال%'),
      ilike(foodAliases.aliasAr, '%عصير%'),
      ilike(foodAliases.aliasEn, '%orange%')
    )
  );
  console.log(`\nFound ${orangeAliases.length} aliases matching 'برتقال' / 'عصير' / 'orange':`);
  for (const a of orangeAliases) {
    console.log(`  [Alias #${a.id}] "${a.aliasAr}" -> Food #${a.foodId}`);
  }

  console.log('\nTracing analysis for "عصير برتقال":');
  const ojRes = await UnifiedAnalysisEngine.analyze({ query: 'عصير برتقال', inputType: 'text' });
  console.log('  resultMode:', ojRes.report.resultMode);
  console.log('  queryIntent:', ojRes.report.queryIntent);
  console.log('  canonicalResult:', ojRes.report.canonicalResult ? {
    canonicalId: ojRes.report.canonicalResult.canonicalId,
    canonicalNameAr: ojRes.report.canonicalResult.canonicalNameAr,
    matchType: ojRes.report.canonicalResult.matchType,
    searchOutcome: ojRes.report.canonicalResult.searchOutcome,
    sourceType: (ojRes.report.canonicalResult as any).sourceType,
  } : null);
  console.log('  primaryRuling:', ojRes.report.primaryRuling);
  console.log('  forbidden count:', ojRes.report.forbidden.length);
  if (ojRes.report.forbidden[0]) {
    console.log('  forbidden[0]:', {
      nameAr: ojRes.report.forbidden[0].nameAr,
      status: ojRes.report.forbidden[0].status,
      reason: ojRes.report.forbidden[0].reason,
      notes: ojRes.report.forbidden[0].notes,
    });
  }

  console.log('\nTracing analysis for "برتقال":');
  const oFruitRes = await UnifiedAnalysisEngine.analyze({ query: 'برتقال', inputType: 'text' });
  console.log('  primaryRuling:', oFruitRes.report.primaryRuling);

  // ============================================================================
  // ISSUE C: MACARONI / PASTA DB RECORDS & TRACE
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('ISSUE C: MACARONI / PASTA AUDIT');
  console.log('--------------------------------------------------------------------------------');

  const pastaDbFoods = await db.select().from(foodsTable).where(
    or(
      ilike(foodsTable.nameAr, '%معكرون%'),
      ilike(foodsTable.nameAr, '%مكرون%'),
      ilike(foodsTable.nameAr, '%باستا%'),
      ilike(foodsTable.nameEn, '%pasta%'),
      ilike(foodsTable.nameEn, '%macaroni%')
    )
  );

  console.log(`Found ${pastaDbFoods.length} foods matching 'معكرون' / 'مكرون' / 'باستا':`);
  for (const f of pastaDbFoods) {
    console.log(`  [Food #${f.id}] "${f.nameAr}" | En: "${f.nameEn}" | Cat: "${f.category}" | Status: "${f.status}" | Reason: "${f.reason}" | Notes: "${f.notes}"`);
  }

  const pastaDbDishes = await db.select().from(dishes).where(
    or(
      ilike(dishes.nameAr, '%معكرون%'),
      ilike(dishes.nameAr, '%مكرون%'),
      ilike(dishes.nameAr, '%باستا%')
    )
  );
  console.log(`\nFound ${pastaDbDishes.length} dishes matching 'معكرون' / 'مكرون' / 'باستا':`);
  for (const d of pastaDbDishes) {
    console.log(`  [Dish #${d.id}] "${d.nameAr}" | En: "${d.nameEn}" | Cat: "${d.category}" | Desc: "${d.description}"`);
  }

  console.log('\nTracing analysis for "معكرون":');
  const pastaRes1 = await UnifiedAnalysisEngine.analyze({ query: 'معكرون', inputType: 'text' });
  console.log('  resultMode:', pastaRes1.report.resultMode);
  console.log('  queryIntent:', pastaRes1.report.queryIntent);
  console.log('  canonicalResult:', pastaRes1.report.canonicalResult ? {
    canonicalId: pastaRes1.report.canonicalResult.canonicalId,
    canonicalNameAr: pastaRes1.report.canonicalResult.canonicalNameAr,
    matchType: pastaRes1.report.canonicalResult.matchType,
    searchOutcome: pastaRes1.report.canonicalResult.searchOutcome,
  } : null);
  console.log('  primaryRuling:', pastaRes1.report.primaryRuling);
  console.log('  forbidden count:', pastaRes1.report.forbidden.length);
  if (pastaRes1.report.forbidden[0]) {
    console.log('  forbidden[0]:', {
      nameAr: pastaRes1.report.forbidden[0].nameAr,
      status: pastaRes1.report.forbidden[0].status,
      reason: pastaRes1.report.forbidden[0].reason,
      notes: pastaRes1.report.forbidden[0].notes,
    });
  }

  console.log('\nTracing analysis for "معكرونة":');
  const pastaRes2 = await UnifiedAnalysisEngine.analyze({ query: 'معكرونة', inputType: 'text' });
  console.log('  primaryRuling:', pastaRes2.report.primaryRuling);

  // ============================================================================
  // ISSUE A: NUTRITION & CALORIE INTENT AUDIT
  // ============================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('ISSUE A: NUTRITION & CALORIE INTENT AUDIT');
  console.log('--------------------------------------------------------------------------------');

  const testQueries = [
    'عملت كاسة جوز الهند وكاسة لبن مع بيضة وملعقة فانيلا وملعقة بيكنج باودر كم سعراتها',
    'كم سعرة حرارية في التفاح؟',
    'كم سعر حراري في بيضة مسلوقة',
    'احسب لي السعرات الحرارية لوجبتي',
    'جدول دايت للتنحيف',
    'نظام غذائي للتخسيس',
    'حمية لإنقاص الوزن',
    'وجبة لزيادة الوزن',
    // Legitimate food queries that MUST NOT be blocked:
    'بيض',
    'لبن',
    'بروتين بار',
    'طعام صحي',
    'جوز الهند',
    'هل البيض مسموح في الدايت؟',
    'هل اللبن مسموح؟'
  ];

  for (const q of testQueries) {
    const intentRes = IntentClassificationEngine.detectQueryIntent(q);
    console.log(`\nQuery: "${q}"`);
    console.log(`  -> Intent: ${intentRes.intent} (Confidence: ${intentRes.confidence}%, Reason: "${intentRes.reason}")`);
    if (intentRes.targetFoodQuery) {
      console.log(`  -> Target food query: "${intentRes.targetFoodQuery}"`);
    }

    const analysisRes = await UnifiedAnalysisEngine.analyze({ query: q, inputType: 'text' });
    console.log(`  -> Analysis ResultMode: ${analysisRes.report.resultMode}, notFound: ${analysisRes.report.notFound}, primaryRuling: ${analysisRes.report.primaryRuling?.status || 'none'}`);
  }

  process.exit(0);
}

runAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
