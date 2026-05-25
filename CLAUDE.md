# CLAUDE.md

## HTML Slide Deck Skill

When the user asks you to build a presentation, slide deck, or HTML slides, use the **beautiful-html-templates** library located at `./beautiful-html-templates/`.

Follow the exact six-step workflow in `./beautiful-html-templates/AGENTS.md`:

1. **Ask** the user about occasion and mood before picking anything.
2. **Read** `./beautiful-html-templates/index.json` and pick 3 candidate templates.
3. **Build** a title-slide preview for each candidate with the user's real content.
4. **Open** all 3 previews in the browser (`open <path>`) and send the paths to the user.
5. **Build** the full deck in the chosen template, adapting all slides.
6. **Open** the final deck in the browser and send the absolute file path.

Key rules:
- Never skip the clarifying questions (Step 1) or the preview step (Step 4).
- Preserve fonts, colors, layout grid, and decorative elements exactly — they are the design system.
- Replace only user-facing content (headlines, body copy, stats, names, dates, images).
- If a needed layout is missing from the template, design it using the same design system — do not switch templates or import a new visual language.
- After every artifact (preview or final deck), open it in the browser and send the absolute path.

The 34 available templates range from editorial (`Editorial Forest`, `Cobalt Grid`) to playful (`Daisy Days`, `Scatterbrain`) to retro (`Retro Windows`, `Sakura Chroma`) to professional (`Signal`, `Blue Professional`). Match on tone and mood, not industry.
