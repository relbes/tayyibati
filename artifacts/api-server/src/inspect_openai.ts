import OpenAI from "openai";
import { db, appConfigTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SYSTEM_FOOD_KNOWLEDGE_PROMPT, buildFoodKnowledgePrompt } from "./lib/ai/prompts";

async function getOpenAIClient(): Promise<OpenAI> {
  const [row] = await db
    .select()
    .from(appConfigTable)
    .where(eq(appConfigTable.key, "openai_api_key"));
  const key = row?.value?.trim();
  if (key && key.length > 10) return new OpenAI({ apiKey: key });
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function main() {
  const openai = await getOpenAIClient();
  const query = "شاورما لحم";
  const userPromptText = buildFoodKnowledgePrompt({ query, inputType: "text" });

  console.log("Calling OpenAI for query:", query);
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_FOOD_KNOWLEDGE_PROMPT },
      { role: "user", content: [{ type: "text", text: userPromptText }] },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  console.log("RAW CONTENT:");
  console.log(completion.choices[0]?.message?.content);
}

main().catch(console.error);
