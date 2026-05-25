# Prompt: Convert template.html → design.md

You are a design systems analyst. Read the provided `template.html` and produce a `design.md` that documents its visual design system. The output will be used by an AI agent to generate *new* slide decks in the same aesthetic — not to reproduce or remix the template itself.

**Critical framing:** The design.md is a vocabulary and constraint document, not a layout recipe. A model reading it should understand the design language deeply enough to compose original layouts from first principles, not copy the template's structure. Every decision you make in writing it should serve this goal.

---

## Output format

The file has two parts: a YAML frontmatter block and a markdown body.

### YAML frontmatter

```yaml
---
version: alpha
name: [Template name]
description: [2–3 sentence description of the overall aesthetic, mood, and design philosophy. Name the typefaces, describe the color feel, and give it a cultural reference point — "brutalist editorial", "literary magazine", "Swiss modernist", etc. This is the first thing the agent reads.]

colors:
  [token-name]: "[hex value]"
  ...

color-aliases:           # only if multiple CSS variable names point to the same hex
  [alias]: [canonical-token-name]

typography:
  [token-name]:
    fontFamily: "..."
    fontSize: [px]
    fontWeight: [number]
    lineHeight: [number]
    letterSpacing: [em or px]
    textTransform: [uppercase | none]   # only if always applied
  ...

spacing:
  [token-name]: [value]
  ...

canvas:
  width: 1920px
  height: 1080px

components:
  [component-name]:
    [property]: [value or "{token.ref}"]
  ...
---
```

**YAML rules:**
- Every color in the CSS gets a token. If multiple CSS variables resolve to the same hex (aliases), document the canonical name and list aliases separately under `color-aliases`.
- Typography tokens represent *roles*, not elements. Name them by function (`display-hero`, `label`, `body-md`) not by HTML tag (`h1`, `p`). Extract every distinct combination of font-family + size + weight + line-height + tracking that appears in the CSS.
- Component tokens describe the visual properties of reusable UI elements (cards, pills, tables, bars, stamps, markers). Do NOT tie them to a specific slide position or content type. Properties use `{token.ref}` notation to reference color/typography tokens.
- Spacing tokens are the structural constants: gutter sizes, grid gaps, internal padding values that repeat.

---

### Markdown body sections

Write the following sections. Each should read as a coherent design brief paragraph or table — not a bulleted list of CSS properties.

#### 1. Overview
Describe the design system's aesthetic character in 3–5 paragraphs. Cover:
- The foundational visual premise (what makes it recognisable at a glance)
- The typeface stack and how each face is used emotionally/functionally
- The color philosophy and how surfaces interact
- The depth/shadow/border philosophy
- **Density philosophy**: Is this a sparse or dense system? Some aesthetics (literary editorial, Swiss minimalist) read as elegant when sparse and broken when crowded. Others (populist poster, brutalist zine, magazine spread) read as authoritative when dense and broken when sparse. State this explicitly — it tells the agent how full a typical slide should feel without prescribing what goes on it.
- A "Key Characteristics" bullet list of 5–8 defining traits (use token refs like `{colors.ink}`)

#### 2. Colors
For each color token: name, hex, and a description of its semantic role and emotional register. Group into logical clusters (e.g. Canvas & Ink / Accent Colors / Surface Tones). If aliases exist, explain what each alias name communicates about its context of use.

**Required: a "Defaults" subsection.** State the default color choices an agent should reach for without thinking: default surface/background, default primary headline color on each surface type, default body text color, default accent color. The agent needs unambiguous defaults so it doesn't have to guess on every slide. Defaults are not rules that forbid alternatives — they are the answer to "what should I use here if nothing about the content suggests otherwise?"

Do NOT include any table or section mapping colors to specific slides.

#### 3. Typography
- A paragraph on the font family stack and the emotional register of each face
- Any inline mixing rules (e.g. "an `<em>` tag inside a grotesque headline switches to the serif face")
- A table of all typography tokens with: Token | Size | Family | Weight | Use — where "Use" describes the *type of content moment* (e.g. "Jumbo title or closing headline") not a specific slide (never "slide 4" or "the closing slide")
- Typography principles: line-height philosophy, letter-spacing rules, weight usage, what NOT to do
- **Required: a "Defaults" subsection.** State the default headline size for a primary section headline, default body size for paragraph text, default label size. These are the answers to "what size should I use here by default?" — they prevent the agent from defaulting to the smallest tokens in the table because they were listed first.
- **Required: a "Signature Treatments" subsection.** Flag any typography treatment that is non-optional whenever a particular element type is used. For example: "Every display-scale element in this system carries the stacked text-shadow — no exceptions." or "Display headlines are always uppercase." These are not "use this size" rules; they are "if you use a display element at all, it must look like this" rules. Be explicit about which treatments are mandatory once an element type is chosen.

#### 4. Layout
- The canvas dimensions and how the scaling system works
- The gutter system: which gutter values are for chrome (topbar/footer) vs content
- Any universal chrome frame that appears on every slide (topbar, footer bar, etc.) — describe its anatomy and exact positioning constants
- Do NOT include a grid pattern table or list of "available" layouts. The spacing constants are the constraint; grid composition is the model's creative decision.

#### 5. Depth and Elevation
Describe the shadow/depth philosophy. Is it flat? Hard offset? Blurred drop shadows? Color-block contrast? Document the exact technique(s) used and their values. Explain why — what does this choice communicate aesthetically?

#### 6. Shapes and Treatment
- Border radius scale: every value used and what element types use it
- Border weight and style conventions
- Any decorative element *types* (e.g. "hard offset stamp", "skewed lever", "stacked blocks") described as reusable design primitives — without tying them to a specific slide

#### 7. Do's and Don'ts
Two lists of 6–10 items each. These are aesthetic laws derived from the system's internal logic — NOT layout rules or content placement rules. Good Do's/Don'ts answer: "what would break the aesthetic?" and "what non-obvious choices define the style?"

**At least half of the Do's must require positive action** ("Apply the stacked shadow to every display element", "Use blue as the default headline color on paper surfaces"), not only avoidance ("Don't use red as a background"). A list of only-avoidances tells the agent what not to do but leaves a vacuum about what to actually reach for. Mix positive defaults with prohibitions.

#### 8. Responsive Behavior
Note that this is a 1920×1080 presentation system with no responsive breakpoints. Describe how the deck-stage scaling works, presenter behavior, and print/export characteristics if relevant.

#### 9. CJK & International Content
A required section. Most templates in this library will be used for Chinese decks. The agent needs explicit guidance on how to swap the Latin typeface stack for an appropriate Chinese pairing and apply CJK-specific adjustments. Include the following subsections:

**Recommended Chinese Pairing** — A small table mapping each major typographic role in the template's Latin system to a Chinese counterpart. Use only CDN-loadable fonts (Google Fonts: Noto Sans SC, Noto Serif SC, ZCOOL XiaoWei, ZCOOL KuaiLe, Ma Shan Zheng, LXGW WenKai TC, Long Cang, Zhi Mang Xing; cn-fontsource: Smiley Sans Oblique, Yozai). Never recommend install-required fonts (优设标题黑, HarmonyOS Sans SC, MiSans, etc.) as defaults. Never recommend 刘建毛草 (illegible) or 站酷庆科黄油体 (too round, low readability at small sizes).

**Mixed-Content Strategy** — State explicitly which of two strategies the template should use:
- **Strategy A (default for most templates)**: single CJK family for the whole text, e.g. `font-family: 'Noto Sans SC', sans-serif`. The CJK font's built-in Latin glyphs render any English mixed in. Consistent across platforms, no baseline issues.
- **Strategy C (for literary/editorial templates only)**: Latin face first with CJK fallback, e.g. `font-family: 'Instrument Serif', 'Noto Serif SC', serif`. Use only when the template's Latin face carries strong identity (Instrument Serif, Playfair Display, custom serifs). Warn about potential baseline mismatch at display sizes.

**Loading** — Provide an exact `<link>` snippet the agent can drop into the template's `<head>` to load the recommended Chinese fonts. Include an authoritative CDN-routing table immediately under the snippet so downstream agents do not invent alternative CDN paths:

| Font | Correct CDN | Wrong CDN (do not use) |
|---|---|---|
| Noto Sans SC, Noto Serif SC | Google Fonts: `family=Noto+Sans+SC` / `family=Noto+Serif+SC` | — |
| ZCOOL XiaoWei | Google Fonts: `family=ZCOOL+XiaoWei` | `cn-fontsource-zcool-xiaowei` (does not exist on npm) |
| ZCOOL KuaiLe | Google Fonts: `family=ZCOOL+KuaiLe` | — |
| Ma Shan Zheng, Liu Jian Mao Cao, Long Cang, Zhi Mang Xing | Google Fonts (each on its own `family=...` param) | — |
| LXGW WenKai TC | Google Fonts: `family=LXGW+WenKai+TC` | chinese-fonts-cdn.deno.dev (proxies through unreliable mirrors) |
| Smiley Sans Oblique (得意黑) | cn-fontsource: `https://cdn.jsdelivr.net/npm/cn-fontsource-smiley-sans-oblique-regular/font.css` | Google Fonts (not hosted there) |
| Yozai (悠哉字体) | cn-fontsource: `https://cdn.jsdelivr.net/npm/cn-fontsource-yozai-regular/font.css` | Google Fonts (not hosted there) |

Explicitly state: "**Do not invent or substitute CDN paths**. If a font is recommended above, use the exact URL listed; if a font is not recommended, do not add it." This prevents downstream agents from generalizing the `cn-fontsource-<name>-regular` naming pattern to fonts that aren't actually on cn-fontsource (a common failure mode).

**Universal CJK Adjustments** — A bullet list of the six universal rules. Include all six verbatim:
1. **Line-height**: increase by ~15–25% from the Latin spec. Body 1.75–1.85, display 1.15–1.25.
2. **Letter-spacing**: set to 0 on every CJK run. Negative display tracking and positive mono tracking both look broken on square CJK glyphs.
3. **Text transform**: don't apply `uppercase` to Chinese text.
4. **Punctuation**: use full-width Chinese punctuation （，。：；！？「」（））.
5. **No period on display headlines**: Chinese typography convention omits trailing 。 on display-scale headlines.
6. **Space between CJK and Latin (盘古之白 / Pangu spacing)**: insert an ASCII space between every Chinese character and adjacent Latin character or digit (`使用 Claude 处理`, not `使用Claude处理`).
7. **One font per sentence**: pick a CJK family with Latin coverage so mixed sentences render in a single family.
8. **No inline face-switching on `<em>`/`<strong>`/`<b>` in CJK**: this is the most common pitfall. Many Latin systems use an inline face switch for emphasis (e.g., grotesque headline → serif italic inside `<em>`). In Chinese, mid-sentence face switching reads as a typesetting error, not editorial contrast. When the template has such a rule, the CJK section MUST explicitly suppress the face-switch and recommend color or weight contrast instead (e.g., `color: var(--accent)` or `font-weight: 700` on the `<em>` element, with `font-family: inherit`). This rule overrides the template's Latin convention whenever the content is Chinese.

**Aesthetic Notes for This System** — One or two paragraphs explaining how to preserve the template's signature typographic rules in Chinese. If the system has an inline mixing rule (like an `<em>` tag triggering a face switch), state the Chinese equivalent. If the system depends on uppercase + heavy weight, explain how CJK weight-only contrast carries the same hierarchy. If the system uses a decorative face that doesn't have a CJK equivalent (script, brush, pixel), say so honestly.

**Known CJK Gap** — Honest notes about what doesn't transfer cleanly. Common gaps: no CDN-loadable Chinese monospace face; no good Chinese pixel font with CDN; Latin italic has no direct Chinese counterpart; brush-script aesthetic doesn't transfer (Chinese brush carries different cultural weight than Latin brush).

#### 10. Iteration Guide
6–10 short rules for someone extending or adding to this design system. Focus on: how to introduce new components consistently, what the invariants are (things that must always be true), and what traps to avoid. No slide-specific rules.

#### 11. Known Gaps
Honest notes about what the design.md doesn't capture: external script dependencies, hardcoded data, elements that are styled but dormant, licensed fonts with no fallback, etc.

---

## What to actively avoid

- **Never reference slide numbers.** Not "slide 1", "slide 4", "the closing slide", "the title slide". If a design element only appeared in one place in the template, describe it as a reusable component type, not as belonging to that position.
- **Never prescribe layouts.** Don't say "the left column contains the headline and the right panel contains the diagram." Describe the components that exist; let the model decide how to arrange them.
- **Never list "available" grid patterns.** That implies those are the only options. The gutter constants are the real constraint.
- **Never reference specific template content.** Don't mention "THANK YOU", "FLIP THE SWITCH", "42%", or any placeholder text from the template. The design.md describes the visual system, not the content.
- **Never write a Color Assignment Per Slide or Surface Assignment Per Slide table.** These are the most direct form of overfitting.
- **In the typography Use column**, describe the moment type ("Large ordinal numeral", "Section-opening display headline") not the template instance ("Step numbers in the process slide", "Closing headline").

---

## Quality check before outputting

Two tests. The design.md must pass both.

**Test 1 — Extrapolation:** If someone read this design.md without ever seeing the template.html, could they build a completely different deck — different number of slides, different content, different arrangement — that still unmistakably belongs to this design system? If no, find what's making it too prescriptive and rewrite it.

**Test 2 — Defaults and density:** Imagine an agent reading this and generating a new slide. Without referring back to the template, would the agent know:
- What color to make the primary headline?
- What size to make the primary headline?
- Whether to apply a particular signature treatment (shadow, border, texture) to that headline?
- Whether the resulting slide is supposed to feel visually full or visually sparse?

If the agent would have to guess on any of these, the design.md is missing defaults. Add them. Defaults don't constrain creativity — they remove the friction of re-deciding the same baseline question on every element. The agent retains full freedom to deviate when content demands it.
