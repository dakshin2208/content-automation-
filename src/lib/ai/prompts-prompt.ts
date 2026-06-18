export function buildImagePromptsPrompt(
  storyboard: string,
  clientId?: string
): string {
  const contextBlock =
    clientId === "choose_your_college"
      ? `Context to reflect in the visuals:

* Education / college-choice (NIRF, cutoffs, counseling) — not healthcare
* Indian students, families, and campuses where relevant
* Counseling, decision-making, data-style visualization moments
`
      : `Context to reflect in the visuals:

* Medical / healthcare setting where the storyboard implies it — not unrelated domains
* Indian patients, clinics, or hospitals where relevant
`;

  return `Generate cinematic AI image prompts for each scene in the storyboard below.

Storyboard:
${storyboard}

${contextBlock}
Rules:

* For EVERY scene, generate **2 to 3** different visual prompts (minimum 2, maximum 3 per scene).
* Each prompt must be a **different angle, composition, or moment** — visually distinct from the others for that scene.
* Keep visuals **realistic and cinematic**.
* No text overlays.
* No logos.
* Maintain consistency with the medical or education context above.
* Use **Indian context** where relevant.
* Enforce **character consistency across all scenes and all Scene N.M variations**:
  * Keep the same main character identity unless storyboard explicitly introduces a new person.
  * Keep skin tone, height/build, face structure, hairstyle, age appearance, and overall styling consistent.
  * Keep wardrobe continuity (or realistic progression like adding/removing a jacket) while preserving identity.
  * If multiple recurring characters exist, keep each one consistent across the full sequence.
  * In every prompt, restate enough identity anchors so image models preserve the same character.
* Each scene prompt must be **explicitly described** using this level of detail:
  * Subject: age range, gender (if relevant), posture, gesture, facial expression, emotion
  * Environment: room/location type, props, mood, background elements
  * Lighting: source, direction, intensity, shadow behavior, screen glow if applicable
  * Camera: shot type, angle, framing, focal emphasis, depth of field
  * Color and mood: cinematic grading direction
  * Style: photorealistic, cinematic, high detail, natural lighting, realistic shadows, **9:16 vertical composition**
  * End every prompt with a **negative prompt** clause
* Use natural-language cinematic phrasing similar to this style: "A young Indian male student ... medium close-up ... shallow depth of field ... warm muted tones ...".
* Do not include readable text anywhere in scene elements.

Negative prompt requirements (append to every Scene N.M line as "negative prompt: ..."):
text, captions, subtitles, watermark, logo, brand name, UI text, readable words, unrealistic face, cartoon, illustration, low quality, blurry face, distorted hands, extra fingers, extra limbs, bad anatomy, overexposed lighting, harsh shadows, oversaturated colors, unrealistic skin tone, plastic skin, duplicate face, glitch, noise, artifacts

Format **EXACTLY** like this (number of lines under each scene depends on how many prompts you chose for that scene, always between 2 and 3):

Scene 1:
Scene 1.1 - [explicit cinematic prompt with subject + environment + lighting + camera + style] negative prompt: [required list]
Scene 1.2 - [explicit cinematic prompt with a different angle/composition/moment] negative prompt: [required list]
Scene 1.3 - [explicit cinematic prompt with another distinct variation] negative prompt: [required list]

Scene 2:
Scene 2.1 - [explicit cinematic prompt with subject + environment + lighting + camera + style] negative prompt: [required list]
Scene 2.2 - [explicit cinematic prompt with a different angle/composition/moment] negative prompt: [required list]

Scene 3:
Scene 3.1 - [explicit cinematic prompt with subject + environment + lighting + camera + style] negative prompt: [required list]
Scene 3.2 - [explicit cinematic prompt with a different angle/composition/moment] negative prompt: [required list]
Scene 3.3 - [explicit cinematic prompt with another distinct variation] negative prompt: [required list]

(Continue for every scene in the storyboard. Match scene numbering to the storyboard.)

IMPORTANT:

* Minimum **2** prompts per scene; maximum **3** per scene.
* Each prompt must be visually distinct.
* Return **only** the prompts — no preamble, no markdown fences.`;
}
