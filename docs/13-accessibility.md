# Accessibility

Target: WCAG 2.2 level AA for every screen, plus the stricter targets below where Apple's guidelines ask for more. People using this product may be injured, frightened, in a moving vehicle, or using assistive technology. Accessibility is a release requirement, not polish.

## 1. Requirements

| Area | Requirement |
| --- | --- |
| Contrast | Text 4.5 to 1, large text and control outlines 3 to 1, in both themes. Tokens are measured in `11-design-system.md` section 3. |
| Touch targets | At least 44 by 44 pixels (Apple's guideline, stricter than the WCAG minimum of 24). |
| Text size | Scales to 200 percent without loss of content. Reflows at 320 pixel width without horizontal scrolling, except for maps and tables, which scroll inside their own container. |
| Keyboard | Everything works without a mouse. Logical tab order. No keyboard traps. Visible focus ring on every control. |
| Screen readers | Semantic HTML first. Landmarks, headings in order, labels on every control. ARIA only where HTML cannot express it. |
| Live updates | Status changes are announced. Routine updates (ETA) use `aria-live="polite"`. Critical changes (failed match, ambulance arrived) use `assertive`. ETA is announced on meaningful change, not every ping. |
| Color | Never the only signal. Every status has text. |
| Motion | Respects reduced motion. No flashing. Nothing auto-plays. |
| Forms | Visible labels, errors tied to fields, error summary on submit, instructions before the field. Autocomplete attributes on name, phone and email. |
| Timeouts | The 30 second driver offer is an essential time limit. It shows the remaining time as text, announces when it is about to end, and never hides the accept control. |
| Language | `lang="en"` set. |
| Zoom | Pinch zoom is never disabled. |

## 2. Maps and charts

- The map is never the only source of information. A text block gives position, distance, ETA and last update.
- Map controls are keyboard reachable. Markers have accessible names.
- Every chart has a table view with the same data. Chart colors differ in more than hue, and series are labelled directly.

## 3. Stress-aware design rules

1. Large targets and generous spacing on the SOS and trip screens.
2. Minimal typing. Use choices.
3. No time-limited actions for patients.
4. Errors never blame the person.
5. Confirmation screens are short and state the result first.

## 4. Testing

| Check | When |
| --- | --- |
| Automated axe checks on every screen in Playwright | Every pull request |
| Keyboard-only walk through each role's main flow | Every release |
| VoiceOver on iPhone and Safari for patient and driver flows | Every release |
| Zoom to 200 percent and a 320 pixel viewport | Every release |
| Dark mode and light mode contrast token test | Every pull request that changes tokens |
| Reduced motion | Every release |

Automated tools find only part of the problems. A release is not accessible because axe passes.

## 5. Definition of done for UI

A screen is done when the checks in this document pass, the design review checklist in `11-design-system.md` section 10 passes, and a person has completed its main task using only the keyboard.
