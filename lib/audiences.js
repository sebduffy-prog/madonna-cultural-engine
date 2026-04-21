// Shared audience segments — mirrors AudienceIntelligence.jsx SEGMENTS list.
// Used by Tactics, Ideas, and Add-to-Plan forms so everything uses the same
// canonical cohort labels.

export const AUDIENCE_OPTIONS = [
  { key: "genZ", label: "Gen Z", color: "#2DD4BF" },
  { key: "genX", label: "Gen X", color: "#FB923C" },
  { key: "millennial", label: "Millennial", color: "#F472B6" },
  { key: "genJones", label: "Gen Jones", color: "#A78BFA" },
  { key: "fashion", label: "Fashion", color: "#F59E0B" },
  { key: "disco", label: "Gay Community", color: "#FFD500" },
  { key: "nightlife", label: "General Nightlife", color: "#34D399" },
];

const LABEL_BY_KEY = Object.fromEntries(AUDIENCE_OPTIONS.map(a => [a.key, a.label]));
const KEY_BY_LABEL = Object.fromEntries(AUDIENCE_OPTIONS.map(a => [a.label.toLowerCase(), a.key]));

// Resolve an audience value (key or freeform string from legacy records) to
// a canonical {key, label} — or null if no match.
export function resolveAudience(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (LABEL_BY_KEY[v]) return { key: v, label: LABEL_BY_KEY[v] };
  const key = KEY_BY_LABEL[v.toLowerCase()];
  if (key) return { key, label: LABEL_BY_KEY[key] };
  return null;
}

export function audienceLabel(value) {
  return resolveAudience(value)?.label || value || "";
}
