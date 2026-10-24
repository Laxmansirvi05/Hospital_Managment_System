---
name: ui-component
description: Use when building or changing any CareRoute screen or component. Enforces design tokens, the banned pattern list, accessibility, Apple HIG-based rules and the Care Thread component, using plain HTML, CSS and JavaScript.
---

# Build UI

## Read first

1. `docs/11-design-system.md`, all of it. Section 9 is binding.
2. `docs/12-ux-and-content.md` for copy and screens.
3. `docs/13-accessibility.md`.
4. Check `docs/00-decisions.md`. The visual direction is PROPOSED until the owner approves it. Do not introduce colors, fonts or icons that are not in the design system. If something is missing, ask.

## Steps

1. Identify the role and the screen in `docs/12-ux-and-content.md` section 2. Identify the one primary action.
2. Reuse native elements and existing custom elements in `public/js/components`. If a new component is needed, build it as a custom element with its own file in `public/css/components`, from tokens, with all states: default, hover, pressed, focus, disabled, loading, error. No framework and no library. Write data to the page with `textContent` or cloned templates, never `innerHTML` with data.
3. Use only token values for color, spacing (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80), radius and type size. No raw hex, no arbitrary pixel values.
4. Case status uses the Care Thread component. Do not build a one-off timeline.
5. Use semantic HTML first. Add ARIA only where HTML cannot express the meaning.
6. Every live value shows when it last updated. Every status has text as well as color.
7. Write copy using `docs/12-ux-and-content.md` sections 5 to 8.
8. Test light and dark. Compute contrast for any new color pair.
9. Test keyboard use and reduced motion. Add Playwright and axe checks.

## Never

- Purple to blue gradients, gradient text, glass or blur effects, colored left borders on cards, grain textures.
- Emoji in headings, a badge above a headline, rows of three icon tiles.
- Lucide icons as the default, the default look of any component library or CSS framework (a framework itself needs approval under `docs/02-trd.md` section 1.2), Inter, Space Grotesk, Instrument Serif, serif accent words.
- Scroll reveal animations, cursor-following effects, opacity fades on button hover.
- Spacing outside the scale.
- Em dashes, buzzwords, or claims we cannot source.

## Finish

Run the design review agent. Fix or report every finding. Update `docs/11-design-system.md` if the component set changed.
