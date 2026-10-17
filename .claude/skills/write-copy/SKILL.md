---
name: write-copy
description: Use when writing any CareRoute user-facing text, error message, notification, SMS, consent text, empty state, or documentation sentence. Applies the voice rules, banned words and no-em-dash rule.
---

# Write copy

## Read first

`docs/12-ux-and-content.md`, sections 5 to 8.

## Process

1. Name the reader and their state. For patient screens, assume frightened, hurried and possibly one-handed.
2. Say the one thing they need: what is happening, what happens next, or what to do.
3. Use specific words and numbers with units. "6 min", "2.4 km", "12 of 30 beds".
4. Sentence case. Buttons are verbs.
5. Errors say what went wrong and what the person can do. They do not blame the person.
6. Consent text names exactly who will see what, and when.
7. Anything medical: no diagnosis wording. Say "may need urgent care", never "you have". Triage disclaimers come from the server.
8. Add the emergency number where the document requires it. Verify the number before launch.

## Checks before finishing

- No em dash character. Use a comma, colon, period, or new sentence. Ranges use "to".
- No emoji. No exclamation marks on emergency screens.
- No word from the banned list in `docs/12-ux-and-content.md` section 7.
- No claim without a source: no "fastest", "trusted by", "certified", "24/7", "AI diagnosis".
- No invented statistics, testimonials or partner names.
- The text works read aloud by a screen reader.
- SMS text names no health detail and fits the provider's limits.

Search the text for the em dash character before returning it.
