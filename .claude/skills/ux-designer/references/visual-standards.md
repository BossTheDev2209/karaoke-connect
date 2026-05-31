# Visual Design Standards

Detailed guidance for color, typography, and layout. Pair every decision here with the Design Decision Protocol — propose, get approval, then implement.

## Table of contents
- Color & contrast
- Typography
- Layout & spatial design

---

## Color & contrast

### Color system architecture

Every interface needs two color roles:

**Base / neutral palette (4–5 colors):**
- Backgrounds (lightest)
- Surface colors (cards, inputs)
- Borders and dividers
- Text (darkest)
- Slightly desaturated, warm or cool greys based on brand intent.

**Accent palette (1–3 colors):**
- Primary action (CTA buttons)
- Status indicators (success, warning, error, info)
- Focus / hover states
- Saturated enough for clear contrast against the neutrals.

Example structure:
```
Neutrals: slate-50, slate-100, slate-300, slate-700, slate-900
Accents:  teal-500 (primary), amber-500 (warning), red-500 (error)
```

### Color application rules
- **Backgrounds:** lightest neutral (slate-50 or white).
- **Text:** darkest neutral for primary (slate-900), mid-tone for secondary (slate-600).
- **Primary buttons:** accent color with white text.
- **Secondary buttons:** neutral with border and dark text.
- **Status:** green = success, red = error, amber = warning, blue = info.
- **Interactive states:**
  - Hover: darken 10–15% or shift hue slightly.
  - Focus: ring/outline in the accent color.
  - Disabled: opacity 40–50%, remove hover effects.

### Color relationships
Choose warm or cool intentionally:
- **Warm greys** (beige/brown undertones): organic, approachable, trustworthy.
- **Cool greys** (blue undertones): modern, tech-forward, professional.

Accents should contrast clearly with both light backgrounds (buttons on white) and dark text (if used as backgrounds for white text).

### Intentional color usage
- Every color serves a purpose: hierarchy, function, status, or action.
- Avoid decorative colors that communicate nothing.
- Same color = same meaning throughout.

### Accessibility
- WCAG 2.1 AA: minimum **4.5:1** for normal text, **3:1** for large text.
- Ensure contrast works for color-blind users.
- Never rely on color alone — add icons or labels.

### Unique color strategy (to avoid looking AI-generated)
- Avoid default SaaS blue (#3B82F6) unless it genuinely fits the brand.
- Consider unexpected neutrals: warm greys, soft off-whites, deep charcoals.
- Pair neutrals with distinctive accents: terracotta + charcoal, sage + navy, coral + slate.
- Run the "does this look AI-generated?" filter on every combination.

---

## Typography

Typography is a primary design element conveying personality and hierarchy — not an afterthought.

### Functional vs emotional typography
- **Headlines / display:** prioritize emotion, personality, attention (legibility secondary).
- **Body text:** prioritize legibility, reading comfort, accessibility.
- **UI / labels:** prioritize clarity, scannability, consistency.

### Font selection
- 2–3 typefaces maximum.
- ≤3 weights per typeface (e.g., Regular 400, Medium 500, Bold 700).
- Prefer variable fonts for control and performance.
- Sources: Google Fonts (web, reliable) or system fonts for performance-critical apps (`-apple-system, BlinkMacSystemFont, Segoe UI`).
- Choose for the brand's purpose, not "trending" lists.

### Typographic scale
Use mathematical relationships. Major third (1.25×) for moderate contrast; perfect fourth (1.333×) for dramatic. Base 16px (1rem).

Example (1.25×):
```
xs:   0.64rem  (10px)
sm:   0.8rem   (13px)
base: 1rem     (16px)
lg:   1.25rem  (20px)
xl:   1.563rem (25px)
2xl:  1.953rem (31px)
3xl:  2.441rem (39px)
4xl:  3.052rem (49px)
5xl:  3.815rem (61px)
```

### Spacing & readability
- Line height: ~1.5× font size for body (16px text → 24px line-height).
- Line length: 45–75 characters (60–70 ideal).
- Paragraph spacing: 1–1.5em.
- Letter spacing (tracking): tighter on large text (−0.02 to −0.05em), default on body, looser on small captions (+0.01 to +0.03em). As size increases, reduce tracking; as size decreases, increase it.

### Font pairing logic
Create contrast through:
- **Category:** serif + sans (classic, clear).
- **Weight:** light + bold (dynamic).
- **Personality:** geometric + humanist (modern + warm).

Examples: serif headlines + sans body (editorial); display headlines + system body (distinctive + efficient); bold sans headlines + light sans body (modern, clean).

### UI typography specifics
- Button text: Semi-Bold (600), 14–16px, consistent casing.
- Form labels: Regular (400), 14px, above the input.
- Input text: Regular (400), **16px minimum** (prevents iOS zoom on focus).
- Placeholder: Light (300) or desaturated, same size as input.
- Error messages: Regular (400), 12–14px, color-coded.

### Responsive typography
Scale across breakpoints. Reduce sizes ~20–30% on mobile and reduce the number of distinct hierarchy levels on small screens.
```jsx
<h1 className="text-3xl md:text-4xl lg:text-5xl">Responsive Headline</h1>
```
```css
h1 { font-size: clamp(2rem, 5vw, 4rem); } /* fluid */
```

---

## Layout & spatial design

**Compositional balance.** Every screen should feel balanced. Mind visual weight and negative space. Use generous negative space and sufficient margins/padding for a spacious, professional look.

**Grid discipline.** Maintain a consistent underlying grid — order with room for meaningful exceptions. Use grid/flex wrappers with `gap`; prefer wrappers over direct margins/padding on children.

**Spatial relationships.** Group related elements via proximity, alignment, and shared attributes. Use size, color, and spacing to highlight what matters.

**Attention guidance.** Design a clear path through the content. Avoid cluttered interfaces where elements compete for focus.
