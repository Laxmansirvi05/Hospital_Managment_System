// The red-flag rule layer (docs/07-ai-triage.md sections 2 and 3). It runs before any model, a model
// can never lower what it decides, and it works when no model is reachable.
//
// DEMO RULES, NOT CLINICALLY REVIEWED. The design requires a qualified clinician to write or review
// this list before any real use (OPEN, owner to arrange). It is limited to widely accepted warning
// signs, in English only (D-05).

export const RULES_VERSION = 'demo-2026-11-03b';

const RULES = [
  {
    id: 'chest-pain',
    reason: 'Chest pain or pressure can be a heart attack.',
    patterns: [/\bchest\b[^.]{0,40}\b(pain|pressure|tight|tightness|heaviness|hurts?|aching)\b/i, /\b(pain|pressure|tightness|heaviness)\b[^.]{0,30}\bchest\b/i, /\bheart attack\b/i],
  },
  {
    id: 'breathing',
    reason: 'Serious trouble breathing needs help at once.',
    patterns: [/\b(can(no|')?t|can not|cannot|could not|couldn'?t|unable to|struggling to|hard to|trouble|difficult(y)? (in )?)\s*breath(e|ing)\b/i, /\bnot (able to )?breath(e|ing)\b/i, /\bshort(ness)? of breath\b/i, /\b(choking|gasping|turning blue|blue lips)\b/i],
  },
  {
    id: 'stroke',
    reason: 'These can be signs of a stroke, where every minute matters.',
    patterns: [/\b(face|mouth)\b[^.]{0,20}\b(droop|drooping|dropped|twisted)\b/i, /\bslurred speech\b|\b(speech|talking)\b[^.]{0,15}\b(slurred|garbled)\b/i, /\b(sudden|suddenly)\b[^.]{0,30}\b(weak|weakness|numb|numbness|paraly[sz]ed|can(no|')?t move)\b/i, /\bstroke\b/i],
  },
  {
    id: 'unconscious',
    reason: 'Someone who will not wake or respond needs emergency care.',
    patterns: [/\b(unconscious|unresponsive|not responding|passed out|fainted and|collapsed|won'?t wake|not waking)\b/i],
  },
  {
    id: 'seizure',
    reason: 'A seizure, especially a long or first one, needs emergency care.',
    patterns: [/\b(seizure|seizures|convulsion|convulsions|fits?|fitting)\b/i],
  },
  {
    id: 'bleeding',
    reason: 'Heavy bleeding that does not stop needs emergency care.',
    patterns: [/\b(heavy|severe|a lot of|lots of|non[- ]?stop|uncontrolled)\s+bleeding\b/i, /\bbleeding\b[^.]{0,25}\b(won'?t|will not|does not|doesn'?t|not) stop/i, /\b(vomiting|coughing|throwing up)\s+blood\b/i],
  },
  {
    id: 'allergy',
    reason: 'Swelling of the face or throat with trouble breathing can be a severe allergic reaction.',
    patterns: [/\b(throat|tongue|lips?|face)\b[^.]{0,20}\b(swell|swelling|swollen|closing)\b/i, /\banaphyla/i],
  },
  {
    id: 'self-harm',
    reason: 'Thoughts of ending your life or harming yourself need help right now.',
    patterns: [/\b(kill(ing)? (myself|me)|suicid|end(ing)? (my|this) life|want(ed)? to die|wish i (was|were) dead|better off dead|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|take my (own )?life|no reason to live)/i],
  },
  {
    id: 'poisoning',
    reason: 'Poisoning or an overdose needs emergency care.',
    patterns: [/\b(overdose|poison(ed|ing)?|swallowed (bleach|acid|pesticide|kerosene|pills))\b/i, /\btook too many (pills|tablets)\b/i],
  },
  {
    id: 'head-injury',
    reason: 'A head injury with vomiting, confusion or drowsiness needs emergency care.',
    patterns: [/\bhead (injury|hit|knock|trauma)\b[^.]{0,60}\b(vomit|vomiting|confus|drows|sleepy|unconscious|bleeding)/i],
  },
];

/** Checks a message against the rules. Returns { redFlag, matched: [{ id, reason }] }. */
export function checkRedFlags(text) {
  const matched = RULES.filter((r) => r.patterns.some((p) => p.test(String(text || '')))).map(({ id, reason }) => ({ id, reason }));
  return { redFlag: matched.length > 0, matched };
}

export const RULE_IDS = RULES.map((r) => r.id);
