# Motion & Animation

Animation is functional, not decorative. Every motion earns its place by helping the user.

## Purposeful animation
Each animation must serve a purpose:
- **Orient users:** smooth transitions during navigation changes.
- **Establish relationships:** show how elements connect (expand from source, slide between states).
- **Provide feedback:** confirm interactions (button press, form submission).
- **Guide attention:** direct focus to important changes (new messages, errors).

## Animation & Gestalt principles
Motion should reinforce visual relationships:
- **Proximity:** elements near each other move together.
- **Similarity:** similar elements animate similarly (all buttons share hover timing).
- **Continuity:** movement follows natural paths (smooth curves, not jumpy angles).
- **Figure-ground:** important elements animate while backgrounds stay stable.

## Natural physics
Animations should feel organic, not mechanical:
- **Entrances:** ease-out (fast start, slow end).
- **Exits:** ease-in (slow start, fast end).
- **Transitions:** ease-in-out (smooth both ends).
- Avoid linear easing (robotic) except for continuous loops.
- Apply appropriate mass/momentum: lightweight UI vs weighty modals.

## Subtle restraint
- Felt rather than seen.
- Don't delay user actions — keep interactive feedback under 300ms.
- Never block critical actions with decorative animation.
- Respect `prefers-reduced-motion`.

## Timing guidelines
- Micro-interactions (button press, checkbox): 100–150ms.
- State changes (accordion, tab switch): 200–300ms.
- Page transitions (route change, modal open/close): 300–500ms.
- Attention-directing (notification, error highlight): 200–400ms.

## Physics profiles (consistent durations by element type)
- Lightweight (icons, small UI): 150ms.
- Standard (cards, panels): 300ms.
- Weighty (modals, page transitions): 500ms.

## Performance optimization
- Animate **`transform` and `opacity` only** (GPU-accelerated, smooth 60fps).
- Avoid animating `width`, `height`, `top`, `left`, `margin` (reflow/repaint).
- Use `will-change` sparingly for complex animations.
- Test on low-end devices — 60fps on powerful hardware ≠ 60fps on mobile.

## Implementation
- Use `framer-motion` (or `motion`) sparingly and purposefully.
- Prefer CSS animations/transitions over JS when possible.
- Implement `@media (prefers-reduced-motion: reduce)` to disable/reduce motion.

```jsx
// Simple hover transition
<button className="transition-colors duration-200 ease-out bg-blue-600 hover:bg-blue-700">
  Click me
</button>

// Framer Motion for a complex interaction
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
  Content
</motion.div>
```

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
