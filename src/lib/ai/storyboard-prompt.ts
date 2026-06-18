export function buildStoryboardPrompt(script: string, clientId?: string): string {
  if (clientId === "choose_your_college") {
    return `Convert this script into storyboard scenes.

Focus on:

* student confusion visuals
* comparison (wrong vs right choice)
* data-driven visuals (charts, selection)
* emotional journey

Script:
${script}

Format:

Scene 1:

* Visual:
* Voiceover:
* Duration:

(Repeat for each scene.)

Keep 4–6 scenes. Return only the storyboard.`;
  }

  return `Convert this script into a structured storyboard.

Script:
${script}

Format:

Scene 1:
* Visual:
* Voiceover:
* Duration:

Scene 2:
...

Use a total of 4–6 scenes. Return only the storyboard.`;
}
