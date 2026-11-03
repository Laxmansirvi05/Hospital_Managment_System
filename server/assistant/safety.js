// The D-33 limits on every assistant answer (docs/07-ai-triage.md section 0), enforced by the
// server: the disclaimer is the server's own text, and model text that reads as a prescription, a
// diagnosis or a promise is replaced instead of shown.

export const DISCLAIMER = 'This is general guidance, not a diagnosis or a prescription. Please see a qualified doctor about your health. In an emergency, call 112.';

const BANNED = [
  // Prescriptions and telling someone to take a medicine (limits 1 and 2).
  /\bI (would )?(prescribe|recommend (taking|you take)|suggest (taking|you take))\b/i,
  /\b(you should|you must|you need to|please) (take|start|use|try)\b[^.]{0,40}\b(\d+\s?(mg|ml|mcg|tablets?|capsules?)|tablet|capsule|syrup|antibiotic|painkiller|medicine|medication|dose)\b/i,
  // A dose after take, start, use or give. Lab units such as mg/dL describe a result, not a dose.
  /\b(take|start|use|give)\b[^.,;]{0,30}?\b\d+(\.\d+)?\s?(mg|ml|mcg|g|iu|units?|tablets?|capsules?|drops?|puffs?)\b(?!\s?\/)/i,
  /\b(every|once|twice|thrice|three times)\b[^.]{0,20}\b(a day|daily|hours?)\b[^.]{0,30}\b(tablet|capsule|dose|mg)\b/i,
  // Definitive diagnoses (limit 3).
  /\byou (definitely |certainly |clearly |probably )?have (a |an )?(diabetes|cancer|tumou?r|infection|pneumonia|covid|dengue|malaria|typhoid|tuberculosis|tb|heart disease|stroke|fracture|migraine|asthma|hypertension|thyroid|anaemia|anemia|disease|disorder|syndrome)\b/i,
  /\b(you are|you're) (suffering from|diagnosed with)\b/i,
  /\bmy diagnosis\b|\bthe diagnosis is\b/i,
  // Replacing a professional, or promising an outcome (limits 4 and 5).
  /\b(no need|don'?t need|do not need) (to see|for) (a )?(doctor|physician|hospital)\b/i,
  /\b(guaranteed?|will (definitely |certainly )?cure|100 ?% (cure|safe|effective))\b/i,
];

/** True when the text breaks a D-33 limit. */
export function breaksLimits(text) {
  return BANNED.some((p) => p.test(String(text || '')));
}

export const SAFE_FALLBACK = 'I cannot advise on that directly. A doctor can look at your symptoms properly and tell you what to do. I can help you find a doctor or hospital, or explain words in your reports.';
