import { getKnowledgeCache } from "./lib/knowledgeCache";
import { normalize, stripArticle } from "./lib/arabicNormalization";

async function checkBaseEntities() {
  const cache = await getKnowledgeCache();
  const terms = ["ارز", "جميد", "خبز", "بهارات"];

  for (const term of terms) {
    console.log(`\n===================================`);
    console.log(`CHECKING FOODS FOR BASE TERM: '${term}'`);
    console.log(`===================================`);

    const matches = cache.foods.filter(f => {
      const nAr = normalize(f.nameAr);
      const sAr = stripArticle(f.nameAr);
      return nAr.includes(term) || sAr.includes(term);
    });

    matches.forEach(f => {
      console.log(`Food ID: ${f.id} | nameAr: "${f.nameAr}" | status: ${f.status}`);
    });

    const aliasMatches = cache.aliases.filter(a => {
      const nAl = normalize(a.aliasAr);
      const sAl = stripArticle(a.aliasAr);
      return nAl === term || sAl === term || nAl.includes(term);
    });

    console.log(`Aliases matching '${term}':`);
    aliasMatches.forEach(a => {
      const food = cache.foodById.get(a.foodId);
      console.log(`Alias: "${a.aliasAr}" -> Food ID ${a.foodId} (${food?.nameAr})`);
    });
  }
}

checkBaseEntities().catch(console.error);
