const EDUCATION_TONE_BLOCK = `
## Delivery tone (education / advisor — prioritize in bracket tags)

Aim overall for: **honest**, **concerned** (student confusion), **insightful**, **reassuring**, **aspirational**. Prefer tags like [calm][reassuring], [thoughtful][concerned], [warm][hopeful][slight_emphasis]; keep delivery clear and approachable, never clinical.
`;

export function buildVoiceoverPrompt(script: string, clientId?: string): string {
  const toneExtra =
    clientId === "choose_your_college" ? EDUCATION_TONE_BLOCK : "";

  return `You write voiceover copy for ElevenLabs text-to-speech (e.g. Eleven v3). Output must be ready to send to the API as-is.

Script to adapt:
${script}
${toneExtra}
## Output rules (strict)

1. **Emotions, pacing, and delivery ONLY inside square brackets** — e.g. [fast], [calm], [conversational], [serious], [reassuring], [emphasis]. Stack multiple tags when needed: [fast][calm_questioning] or [fast][listing].
2. **Spoken words are plain text** — no quotation marks around dialogue. No labels like "Calm, direct:" before the line.
3. **Pauses as bracket tags only** — use [pause], [short_pause], [slight_pause], [half_beat_pause], or similar. Do NOT use (pause) or line breaks only for pauses.
4. **No timestamps** — do not write "0–4 sec", "5–9 sec", "|", or time ranges.
5. **No pipe blocks** — do not use " | Tone, tone " between sections.
6. **One main beat per line** (optional blank line between beats for readability). Keep lines short and punchy for short-form video.
7. **Natural, not overdramatic.** Total read roughly 30–50 seconds; about 5–10 beats is fine.
8. Use **lowercase with underscores inside tags** when the tag is more than one word, e.g. [calm_questioning], [strong_brand].

## Example shape (style only — do not copy wording)

[fast][calm_questioning] Pulling a tooth feels cheaper… right?

[fast][conversational] Sounds easier, right?

[slight_pause][fast][listing] Quick fix… less pain… lower cost.

[fast][serious] But what you don't see…

[fast][slight_emphasis] is what comes next.

[pause]

[fast][reassuring] Protect your smile the smart way.

Return **only** the formatted voiceover text, no preamble or markdown.`;
}
