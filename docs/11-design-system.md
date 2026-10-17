# Design system

Status: the direction below is PROPOSED (P-12). The owner asked Claude to suggest it and will finalise it. What is already LOCKED: follow Apple's Human Interface Guidelines (D-15), and the banned patterns in section 9 (D-16). Contrast ratios quoted were calculated with the WCAG formula. Any token not listed with a ratio must pass the token contrast test before it is added.

## 1. Intent

People use this product on the worst day of their week, often on a phone, often shaking. The design must feel calm, exact and trustworthy. It earns trust by being clear about what is happening, who is involved and how fresh the information is, not by decoration.

Principles, taken from Apple's guidelines:

1. **Clarity.** Text is legible at every size. Controls look like controls. One primary action per screen.
2. **Deference.** The interface stays out of the way of the content, which here is a map, a time and a status.
3. **Depth.** Layers (sheets, dialogs) show where you are and how to go back.
4. **Consistency.** The same thing looks and behaves the same everywhere. Standard patterns before custom ones.
5. **Feedback.** Every action gets an immediate, visible result.
6. **Accessibility.** Scalable text, high contrast, 44 pixel minimum touch targets, full dark mode, and respect for reduced motion.

Plus two product principles:

7. **Show freshness.** Anything live shows when it last updated.
8. **Never invent proof.** No fake testimonials, invented statistics, stock photos of staff, or badges that claim certification we do not hold.

## 2. The concept: Care Thread

The owner asked for a design that feels connected: hospital, ambulance, reports and patient. The concept is one thread per case that links those four. It appears in the same form on every screen for every role, so the whole product feels like one system. Details in section 8.

## 3. Color

Tokens are CSS variables. Components never use raw hex values.

### 3.1 Light

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--bg` | `#F5F5F7` | Page background | |
| `--surface` | `#FFFFFF` | Cards, sheets, inputs | |
| `--text-1` | `#1D1D1F` | Primary text | 16.83 on surface, 15.46 on bg |
| `--text-2` | `#6E6E73` | Secondary text | 5.07 on surface, 4.66 on bg |
| `--border` | `#D2D2D7` | Dividers, decorative borders | Decorative only |
| `--border-strong` | `#8E8E93` | Input borders, control outlines | 3.26 on surface |
| `--primary` | `#0066CC` | Primary actions, links | 5.57 on surface, 5.11 on bg |
| `--primary-hover` | `#0058B0` | Hover and pressed | 6.95 with white text |
| `--on-primary` | `#FFFFFF` | Text on primary | 5.57 |
| `--danger` | `#D70015` | SOS, errors, destructive | 5.38 on surface, 5.38 with white text |
| `--success` | `#1E7B34` | Completed, confirmed | 5.33 on surface |
| `--warning` | `#C93400` | Caution | 5.28 on surface |
| `--primary-tint` | `#EAF3FF` | Quiet backgrounds for info | 4.97 with `--primary` text |
| `--danger-tint` | `#FFF1F0` | Error background | 4.90 with `--danger` text |
| `--success-tint` | `#EAF7EC` | Success background | 4.83 with `--success` text |
| `--warning-tint` | `#FFF3E5` | Caution background | 4.83 with `--warning` text |

### 3.2 Dark

Dark mode is built on true layers, not a gray wash.

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--bg` | `#000000` | Page background | |
| `--surface` | `#1C1C1E` | Cards, sheets, inputs | |
| `--elevated` | `#2C2C2E` | Raised layers above surface | |
| `--text-1` | `#F5F5F7` | Primary text | 19.29 on bg, 15.63 on surface, 12.80 on elevated |
| `--text-2` | `#A1A1A6` | Secondary text | 8.16 on bg, 6.61 on surface, 5.42 on elevated |
| `--border-strong` | `#6E6E73` | Control outlines | 3.36 on surface |
| `--border` | `#38383A` | Dividers, decorative borders | Decorative only (PROPOSED, added in WP-0) |
| `--primary-hover` | `#5AB0FF` | Hover and pressed | 9.09 with black text (PROPOSED, added in WP-0) |
| `--primary` | `#2997FF` | Primary actions, links | 6.96 on bg, 5.64 on surface |
| `--on-primary` | `#000000` | Text on primary | 6.96 |
| `--danger` | `#FF453A` | SOS, errors | 4.99 on surface |
| `--on-danger` | `#000000` | Text on danger | 6.16 |
| `--success` | `#30D158` | Completed | 8.42 on surface |
| `--warning` | `#FF9F0A` | Caution | 8.28 on surface |
| `--danger-tint` | `#3A1412` | Error background | 4.78 with `--danger` text |

Dark tints for primary, success and warning are not defined yet. Define them only with a measured ratio of 4.5 or more.

### 3.3 Rules

1. Text contrast at least 4.5 to 1. Large text and control outlines at least 3 to 1. Measure, do not eyeball.
2. Red is reserved for SOS, errors and destructive actions. If everything is red, nothing is urgent.
3. Color never carries meaning alone. Every status has a text label as well.
4. Blue is the single interactive color.
5. No purple. No purple to blue gradient anywhere (section 9).
6. Dark mode is tested on its own, with the same contrast rules. It follows the system setting by default with a manual override.

## 4. Typography

PROPOSED (P-07). The system font stack, so Apple devices render San Francisco and other platforms render their own system face. No font file is downloaded, which also helps load time on poor networks.

```
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, system-ui, sans-serif;
--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
```

Type scale, derived from Apple's text styles. Sizes in pixels with line height.

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| Large title | 34 / 41 | 700 | Top of main screens |
| Title 1 | 28 / 34 | 700 | Section screens |
| Title 2 | 22 / 28 | 600 | Card and panel titles |
| Title 3 | 20 / 25 | 600 | Sub sections |
| Headline | 17 / 22 | 600 | Row titles, button text |
| Body | 17 / 24 | 400 | Default text |
| Callout | 16 / 21 | 400 | Secondary blocks |
| Subhead | 15 / 20 | 400 | Meta lines |
| Footnote | 13 / 18 | 400 | Timestamps, hints |
| Caption | 12 / 16 | 400 | Smallest allowed |

Rules:

1. Body text on phones is never smaller than 16 pixels.
2. Text scales with the user's browser and system text size. Use relative units. Layouts must survive 200 percent text.
3. Numbers that change (ETA, bed counts, times, distances) use `font-variant-numeric: tabular-nums` so they do not jitter.
4. Weights used: 400, 600, 700. Nothing lighter than 400.
5. Left aligned text. Centered only for short single-line statuses. Line length 45 to 75 characters for reading text.
6. One typeface family. No decorative display face, no serif accent words, no italic emphasis for effect. Emphasis uses weight.

## 5. Spacing, layout and shape

### 5.1 Spacing

Base unit 4 pixels. Only these steps exist: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80`. Any other value is a bug.

| Use | Value |
| --- | --- |
| Inside a small control | 8 or 12 |
| Card padding | 16 on phones, 24 on desktop. The same card type always uses the same padding. |
| Gap between related items | 8 or 12 |
| Gap between groups | 24 |
| Gap between page sections | 48 or 64 |
| Page gutter | 16 phone, 24 tablet, 32 desktop |

### 5.2 Layout

- Mobile first. Breakpoints: 640, 1024, 1280.
- Phone screens for patient and driver: single column, primary action reachable by thumb at the bottom, respect safe areas.
- Hospital and dispatcher: desktop dashboards on a 12 column grid, dense but with the same spacing steps.
- Content width for reading text: 680 maximum.

### 5.3 Shape and elevation

| Token | Value | Use |
| --- | --- | --- |
| `--radius-s` | 8 | Tags, small controls |
| `--radius-m` | 12 | Buttons, inputs |
| `--radius-l` | 16 | Cards |
| `--radius-xl` | 24 | Sheets, dialogs |

- Cards are flat: a solid surface and a 1 pixel `--border`. No colored edge on any side.
- Light mode may use one subtle shadow for floating layers only (sheets, menus). Dark mode shows depth by stepping to a lighter surface, never by glow.
- No blur, no translucency, no frosted panels (section 9).

## 6. Motion

Motion explains a change. It never decorates. The interface is dynamic because it reacts to live data and to what the user does, not because it animates for show.

| Allowed | Duration |
| --- | --- |
| Press feedback on controls | 100 ms |
| Toggle, expand, collapse, tab change | 200 ms |
| Sheet and dialog enter and exit | 300 ms |
| Ambulance marker moving between pings | Matches the ping interval, interpolated |
| Progress indicators for real work | While the work runs |

Easing: `cubic-bezier(0.2, 0, 0, 1)` for entering, a plain ease-in for leaving.

Rules:

1. Hover and pressed states swap to the defined token. Opacity is never animated on buttons.
2. Hover styles apply only where hover exists (`@media (hover: hover)`).
3. Nothing animates because it scrolled into view.
4. Nothing follows the cursor.
5. When the user prefers reduced motion, transitions become instant and the marker jumps between positions.
6. A live status change is announced to assistive technology and also shown visually. The visual change does not rely on animation.

## 7. Icons and imagery

PROPOSED (P-08).

1. Text first. Icons support labels. They do not replace them for any important action.
2. A small custom set for domain concepts: ambulance, hospital, report, patient, route, bed. Drawn on a 24 grid with one stroke weight and round joins, so the set is consistent.
3. Generic controls (close, chevron, search, plus) are also custom SVGs in the same style (D-20). No icon library is used.
4. Icon sizes 20 and 24. Never inside a colored tile. Never three tiles in a row to describe features.
5. Imagery is the map and real product screens. No stock photos of smiling staff. No abstract blobs, mesh backgrounds or grain.

## 8. Components

Every component is built from tokens and covers default, hover, pressed, focus, disabled, loading and error states. Focus shows a 2 pixel outline in `--primary` with a 2 pixel offset, visible in both themes.

| Component | Rules |
| --- | --- |
| Button | Variants: primary, secondary, text, destructive. Minimum height 44. Label is a verb. Loading state keeps the width. Disabled explains why in nearby text, never by color alone. |
| SOS button | Largest control in the product, `--danger` fill. One per screen, bottom of the phone screen. Behavior against accidental taps is OPEN (Q-12), see 8.1. |
| Input | Label above, never placeholder-only. Helper text below. Error text names the problem and the fix. Minimum height 44. |
| Segmented control | For choices of 2 to 4 options such as ambulance type. |
| Switch | For consent and sharing, always with a sentence saying what it does. |
| Card | Flat surface, 1 pixel border, `--radius-l`, standard padding. Status shown inside by label and dot, never by an edge color. |
| List row | Title, optional detail, one trailing value or action. Height at least 44. |
| Table | Dashboard use. Sticky header, tabular numerals, row height at least 44 for touch, sortable columns announce their sort. |
| Sheet | Bottom sheet on phones, side panel on desktop. Solid surface. Visible close control. |
| Dialog | Only for confirmations that cost something. Focus trapped, returns focus on close. |
| Toast | For non-critical confirmation. Never for an emergency status. |
| Status label | A dot plus text such as "En route". The text is always present. |
| ETA block | Large tabular number, unit, and "updated 12 s ago". |
| Bed count | The number first, then "of 12". An optional bar is secondary. Shows "updated 4 min ago". |
| Map | MapLibre. Patient marker, ambulance marker, route line, destination. Always paired with a text summary of position and ETA, so the map is not the only way to read the state. |
| Chart | Direct labels, no legends where avoidable, no pie charts, table view available. Colors from tokens. |
| Empty state | Says what is missing and what to do. No illustration required. |
| Skeleton | For loads over 300 ms. Matches final layout. |

### 8.0 How components are built (PROPOSED, P-06)

- Plain HTML elements first: `button`, `a`, `input`, `select`, `details`, `dialog`, `table`. They bring keyboard and screen reader behavior for free.
- Shared widgets are custom elements in `public/js/components`, for example `<cr-care-thread>`, `<cr-status-label>`, `<cr-eta-block>`. They render into the page (no shadow DOM), so page CSS and tokens apply.
- Each component has one CSS file in `public/css/components`, wrapped in a cascade layer, styled only with tokens. Class names use the prefix `cr-`.
- No component library and no CSS framework.

### 8.1 SOS and accidental taps (OPEN, Q-12)

Options, with the trade-off. This is a decision for the owner.

| Option | Behavior | For | Against |
| --- | --- | --- | --- |
| A. Send at once, short undo | One tap sends. A banner offers "Cancel request" for 5 seconds. | Fastest in a real emergency | Prank or accidental SOS reaches drivers briefly |
| B. Press and hold | Hold the button for about 1.5 seconds, with a visible progress ring | Prevents pocket taps | Hard with shaking hands, hard for some disabilities |
| C. Confirm step | Tap, then confirm | Simple, familiar | One more step under stress |

If it is decided that confirmation is needed, A is the least costly for a real emergency. This is a suggestion only.

### 8.2 Care Thread component

One component, used on every role's case screen and in compact form in lists.

Structure: four nodes joined by a line, in this order.

| Node | Shows |
| --- | --- |
| Patient | Who and where, condition summary where permitted |
| Ambulance | Crew status, ETA, last update time |
| Hospital | Destination name and readiness, "Not chosen yet" before pickup |
| Reports | Count of shared reports, or "None shared" |

Layout: vertical on phones, horizontal on wide screens. Each node is a text block with a small dot marker and a state word. No icon tiles. The connecting line is solid between completed steps, and dashed toward steps not reached.

Node states by emergency status:

| Status | Patient | Ambulance | Hospital | Reports |
| --- | --- | --- | --- | --- |
| `matching` | Active | Searching | Not chosen yet | Per sharing |
| `assigned` | Done | Active, ETA | Not chosen yet | Per sharing |
| `en_route` | Done | Active, ETA | Not chosen yet | Per sharing |
| `arrived` | Active | Done | Not chosen yet | Per sharing |
| `picked_up` | Done | Active, ETA to hospital | Active, pre-alert sent | Visible to hospital if shared |
| `at_hospital` | Done | Done | Active | Visible to hospital if shared |
| `completed` | Done | Done | Done | Done |
| `cancelled` | Stopped | Stopped | None | None |

What each role sees:

- Patient: all four nodes, plain words.
- Driver: patient and hospital detail needed for the trip, report names only if `shareWithCrew`.
- Hospital: ambulance ETA, patient condition, shared reports.
- Dispatcher: compact one-line version per case in the active list, full version on open.
- Family link: ambulance node only, with ETA and last update. No other nodes.

## 9. Banned patterns (binding, D-16)

The security-style rule for design: these are not allowed in code, copy or visuals. The design agent in `.claude/agents/design-review-agent.md` checks for them. The "Look for" column gives search hints.

| # | Banned | Do instead | Look for |
| --- | --- | --- | --- |
| 1 | Purple to blue gradients | Flat tokens. Blue is `--primary`. | `linear-gradient`, `radial-gradient`, `conic-gradient` with purple or violet and blue stops |
| 2 | Gradient hero text | Solid `--text-1` | `background-clip: text`, `-webkit-text-fill-color: transparent`, `color: transparent` |
| 3 | Emoji in headings, or as decoration | Words | Emoji ranges in `.html`, `.js`, `.css`, `.md` |
| 4 | One font (Inter) used everywhere by default | System stack with a defined scale | `Inter`, `@font-face` or font links for Inter |
| 5 | Cards with a colored left border | Flat card, status inside as label and dot | `border-left`, `border-inline-start`, `border-left-color` with a color on a card |
| 6 | Glassmorphism, frosted translucent cards | Solid surfaces | `backdrop-filter`, `filter: blur` on panels, translucent card backgrounds |
| 7 | Low contrast dark mode | Measured ratios in section 3.2 | Token test |
| 8 | Three icon boxes in a row describing features | Real content, a table, or prose | Grid of three equal icon tiles |
| 9 | A small badge above the headline | Headline only | Pill or chip element immediately above an `h1` |
| 10 | Lucide icons everywhere | Text first, custom domain icons, one other open set copied as SVG files, sparingly | `lucide` in any file name, import or markup |
| 11 | Untouched shadcn components | Restyle every primitive with tokens, remove default look | Any component library's default look. None is used. |
| 12 | Sections that fade in on scroll | Static content | `IntersectionObserver` used for reveals, `animation-timeline: view()`, scroll animation libraries, `@keyframes` fade or slide tied to scroll |
| 13 | Effects that follow the cursor | None | `mousemove` listeners driving visuals |
| 14 | Buttons that fade on hover | Token swap | `opacity` inside `:hover` or `:active` rules, `transition: opacity` on buttons |
| 15 | Inconsistent spacing | Only the spacing steps in 5.1 | Any `px`, `rem` or `gap` value in CSS that is not a spacing token |
| 16 | Em dashes in copy, docs or comments | Commas, periods, colons, or a new sentence. Ranges use "to". | The em dash character anywhere |
| 17 | Generic buzzwords | Specific, plain statements | Word list in `12-ux-and-content.md` |
| 18 | Serif italics on accent words | Weight for emphasis | `italic` on single words in headings, serif fonts |
| 19 | Space Grotesk with Instrument Serif | System stack | Those font names |
| 20 | Grain or noise texture | Flat surfaces | Noise images, SVG turbulence filters |

Notes on interpretation, to confirm with the owner: the original list was dictated, and these names were read as: purple to blue gradient, Inter, Lucide, shadcn, em dash, Space Grotesk, Instrument Serif.

Additional rules proposed with them (PROPOSED): no decorative gradients of any kind, and no en dashes in prose.

## 10. Design review checklist

A UI change passes when all are true:

1. No item in section 9 appears.
2. Every color, spacing, radius and type value is a token.
3. Light and dark were both checked, and contrast was measured for any new color pair.
4. Touch targets are at least 44 pixels.
5. Every live value shows its freshness.
6. Every status has text, not only color.
7. Keyboard and screen reader paths work (see `13-accessibility.md`).
8. Reduced motion was tested.
9. Copy follows `12-ux-and-content.md`.
10. The Care Thread looks and behaves the same as elsewhere.
