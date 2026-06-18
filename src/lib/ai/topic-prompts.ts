import type { ClientOption } from "../clients";

function excludeBlock(count: number, excludeTopics: string[]): string {
  if (excludeTopics.length === 0) return "";
  const lines = excludeTopics
    .slice(0, 80)
    .map((t, i) => `${i + 1}. ${t.replace(/\s+/g, " ").trim()}`)
    .join("\n");
  return `

You (or a prior step) already have these topics — do NOT repeat or closely copy them:
${lines}

Generate exactly ${count} NEW additional distinct topics (different from everything above).
`;
}

export function buildTopicsUserPrompt(
  client: ClientOption,
  count: number,
  excludeTopics: string[] = []
): string {
  const tail = excludeBlock(count, excludeTopics);
  if (client.id === "choose_your_college") {
    return `Generate exactly ${count} Instagram/Reels content ideas for an education platform called ChooseYourCollege.

Context:
The platform helps students choose the best college based on their cutoff using real NIRF data.

Content mix — over a full set of 60 topics, aim for roughly: student problems & confusion (15); myth busting (10); data-driven insights (10); emotional student journeys (10); parent perspective (5); product explanation (10). For this batch of ${count} topics, allocate across those pillars proportionally while keeping each topic distinct.

For each topic assign exactly one category from this list only:
* TALKING_HEAD (advice, direct speaking)
* AI_EXPLAINER (how system works, data explanation)
* AI_STORY (student journey, transformation)

Ensure:
* No repetition between topics
* One clear line per topic (short title-style)

Return ONLY JSON — a non-empty array like:

[{"topic":"...","category":"TALKING_HEAD"},...]

Categories must be exactly: TALKING_HEAD, AI_EXPLAINER, or AI_STORY.${tail}`;
  }

  const location = client.city;
  if (client.id === "dr_shrutika") {
    return `Generate exactly ${count} Instagram content topics for a dentist in ${location}.

For each topic assign exactly one category from this list only:
* TALKING_HEAD (doctor speaking, advice, FAQs)
* AI_EXPLAINER (procedures, concepts, how things work)
* AI_STORY (patient journey, transformation, storytelling)

Ensure:
* Balanced distribution across the three categories (as even as possible)
* No repetition between topics
* One clear line per topic (short title-style)

Return a JSON array only, no other text. Format:
[
  {"topic": "example topic text", "category": "TALKING_HEAD"},
  ...
]

Categories must be exactly: TALKING_HEAD, AI_EXPLAINER, or AI_STORY.${tail}`;
  }

  return `Generate exactly ${count} Instagram content topics for a sports medicine / sports injury and rehab doctor in ${location}.
Focus on sports injury, rehabilitation, fitness, and performance topics relevant to active people.

For each topic assign exactly one category from this list only:
* TALKING_HEAD (doctor speaking, advice, FAQs)
* AI_EXPLAINER (procedures, concepts, how things work)
* AI_STORY (patient journey, transformation, storytelling)

Ensure:
* Balanced distribution across the three categories (as even as possible)
* No repetition between topics
* One clear line per topic (short title-style)

Return a JSON array only, no other text. Format:
[
  {"topic": "example topic text", "category": "TALKING_HEAD"},
  ...
]

Categories must be exactly: TALKING_HEAD, AI_EXPLAINER, or AI_STORY.${tail}`;
}

export const TOPICS_SYSTEM =
  "You output only valid JSON when asked. No markdown unless wrapping JSON in a code block.";
