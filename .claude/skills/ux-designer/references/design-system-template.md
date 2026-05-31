# Design System Template (meta-framework)

A way to reason about which parts of a design system are non-negotiable, which express the brand, and which flex with context. Use it when establishing tokens or a system for a project.

## The three layers

### 1. Fixed — universal rules (don't negotiate these)
These protect usability and accessibility regardless of brand. They are constraints, not choices.
- WCAG AA contrast (4.5:1 normal text, 3:1 large), keyboard navigability, visible focus states.
- Minimum touch targets (~44×44px), 16px minimum input font (prevents iOS zoom).
- One meaning per color; never signal by color alone.
- Animate only `transform`/`opacity`; respect `prefers-reduced-motion`.
- A consistent spacing base unit and type scale exist (the *values* are project-specific; *having* a mathematical system is fixed).

### 2. Project-specific — brand personality (decide once, per project, with the user)
These define how the product feels. Lock them early, then apply consistently.
- Neutral temperature: warm vs cool greys.
- Accent palette (1–3) and what each accent means.
- Typeface choices and pairing (2–3 faces, ≤3 weights).
- Scale ratio (1.25× vs 1.333×) and base size.
- Spacing scale values, corner radius language, border vs surface strategy.
- Motion personality (snappy vs gentle; physics profile durations).
- Texture/imagery strategy (flat, photographic, patterned, grain).

### 3. Adaptable — context-dependent (decide per screen/component)
These respond to the specific job of a view.
- Layout density and column structure for the screen's content.
- Which hierarchy levels appear (fewer on mobile / simple screens).
- Component variants (primary vs secondary action, card vs inline).
- Empty / loading / error states tuned to the flow.
- Responsive behavior at each breakpoint.

## Decision tree

```
New design decision
├─ Does it affect accessibility or core usability?
│    └─ YES → Fixed. Apply the rule; don't ask, just do it right.
├─ Does it define how the brand/product feels overall?
│    └─ YES → Project-specific. Propose 2–3 options + trade-offs, get approval, then lock and reuse.
└─ Is it about one screen/component's specific job?
     └─ YES → Adaptable. Decide in context, consistent with the locked project layer.
```

## How to use it in a session
1. Confirm the **Fixed** layer is respected (it always is).
2. If the **Project-specific** layer isn't established yet, that's the first thing to settle with the user (Design Decision Protocol — options + trade-offs). Capture the chosen tokens.
3. Make **Adaptable** decisions per screen, always checking them against the locked project tokens for coherence.
