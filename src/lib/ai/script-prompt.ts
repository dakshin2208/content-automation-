import { getClientDisplayName } from "../clients";

function normalizeCategory(category: string): "AI_EXPLAINER" | "AI_STORY" | "TALKING_HEAD" | "OTHER" {
  const key = category.trim().toUpperCase();
  if (key === "TALKING_HEAD") return "TALKING_HEAD";
  if (key === "AI_EXPLAINER") return "AI_EXPLAINER";
  if (key === "AI_STORY") return "AI_STORY";
  return "OTHER";
}

function getCategoryProfile(category: string): {
  durationSeconds: string;
  categoryRules: string;
  sectionRules: string;
  toneRule: string;
  outputExample: string;
} {
  const normalized = normalizeCategory(category);

  if (normalized === "AI_EXPLAINER") {
    return {
      durationSeconds: "30-45",
      categoryRules:
        "* Duration: 30-45 seconds\n* Focus: explanation, clarity, structured info\n* Tone: informative, simple, helpful",
      sectionRules: "* AI_EXPLAINER -> 5-6 sections total",
      toneRule: "clear, structured",
      outputExample: `VOICEOVER SCRIPT (30-45 sec)

HOOK (0-3 sec)
"Line"
"Line"

RE-HOOK (3-7 sec)
"Line"
"Line"

PROBLEM
[7-16 sec]
"Line"
"Line"

SOLUTION
[16-32 sec]
"Line"
"Line"

CTA (last segment)
[32-45 sec]
"Line"`,
    };
  }

  if (normalized === "AI_STORY") {
    return {
      durationSeconds: "25-35",
      categoryRules:
        "* Duration: 25-35 seconds\n* Focus: emotional storytelling\n* Tone: relatable, engaging, fast-paced",
      sectionRules: "* AI_STORY -> 4-5 sections total (faster pacing)",
      toneRule: "emotional, fast, relatable",
      outputExample: `VOICEOVER SCRIPT (25-35 sec)

HOOK (0-3 sec)
"Line"
"Line"

RE-HOOK (3-7 sec)
"Line"
"Line"

PROBLEM
[7-15 sec]
"Line"

SOLUTION
[15-24 sec]
"Line"

CTA (last segment)
[24-35 sec]
"Line"`,
    };
  }

  if (normalized === "TALKING_HEAD") {
    return {
      durationSeconds: "45-60",
      categoryRules:
        "* Duration: 45-60 seconds\n* Focus: authority, trust, deeper explanation\n* Tone: expert, calm, confident",
      sectionRules: "* TALKING_HEAD -> 6-8 sections total (more depth)",
      toneRule: "calm, authoritative",
      outputExample: `VOICEOVER SCRIPT (45-60 sec)

HOOK (0-4 sec)
"Line"
"Line"

RE-HOOK (4-9 sec)
"Line"
"Line"

PROBLEM
[9-18 sec]
"Line"

[18-28 sec]
"Line"

SOLUTION
[28-38 sec]
"Line"

[38-48 sec]
"Line"

CTA (last segment)
[48-60 sec]
"Line"`,
    };
  }

  return {
    durationSeconds: "30-40",
    categoryRules:
      "* Duration: 30-40 seconds\n* Focus: clarity + engagement\n* Tone: concise, confident, helpful",
    sectionRules: "* Default -> 5-6 sections total",
    toneRule: "clear, confident",
    outputExample: `VOICEOVER SCRIPT (30-40 sec)

HOOK (0-3 sec)
"Line"
"Line"

RE-HOOK (3-7 sec)
"Line"
"Line"

PROBLEM
[7-16 sec]
"Line"

SOLUTION
[16-26 sec]
"Line"

CTA (last segment)
[26-40 sec]
"Line"`,
  };
}

export function buildScriptPrompt(
  clientId: string,
  topic: string,
  category: string
): string {
  const profile = getCategoryProfile(category);
  const clientLabel =
    clientId === "choose_your_college"
      ? "ChooseYourCollege"
      : getClientDisplayName(clientId);
  const audienceLine =
    clientId === "choose_your_college"
      ? "students + parents"
      : "patients";
  return `Write a HIGH-CONVERSION Instagram reel script for ${clientLabel}.

Topic: ${topic}
Category: ${category}

---

CATEGORY RULES:

${profile.categoryRules}

---

CONTEXT:

* Audience: ${audienceLine}
* Goal: grab attention, retain, and drive action
* Style: short, punchy, emotionally engaging

---

STRUCTURE (ADAPT BASED ON CATEGORY):

HOOK (varies based on duration)
RE-HOOK (varies based on duration)
PROBLEM (varies based on duration)
SOLUTION (varies based on duration)
CTA (varies based on duration)

---

DURATION CONTROL:

${profile.sectionRules}

---

TONE GUIDELINES:

* Choose tone dynamically based on category:
* AI_STORY -> emotional, fast, relatable
* AI_EXPLAINER -> clear, structured
* TALKING_HEAD -> calm, authoritative
* For this script, enforce: ${profile.toneRule}

---

OUTPUT FORMAT:

${profile.outputExample}

---

STRICT RULES:

* Generate ONLY ONE script
* DO NOT repeat output
* DO NOT exceed category duration range (${profile.durationSeconds} sec)
* Ensure timestamps match total duration

---

FINAL INSTRUCTION:

Return ONLY the script in the required format.
Do NOT add anything else.`;
}
