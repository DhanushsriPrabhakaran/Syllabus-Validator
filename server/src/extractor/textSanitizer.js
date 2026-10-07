/**
 * Text Layer Artifact Sanitizer
 * Normalizes common PDF extraction artifacts (broken ligatures, split words)
 * without masking faculty spelling errors or altering semantics.
 */

const REPLACEMENTS = [
  { pattern: /\bUnderstan\s+d\b/gi, replacement: 'Understand' },
  { pattern: /\bLeft\s+ist\b/gi, replacement: 'Leftist' },
  { pattern: /\binlargedictionaries\b/gi, replacement: 'in large dictionaries' },
  { pattern: /\bCand\s+C\+\+\b/gi, replacement: 'C and C++' },
  { pattern: /\b(\d+)\s*thEdition\b/gi, replacement: '$1th Edition' },
  { pattern: /\b(\d+)\s*ndEdition\b/gi, replacement: '$1nd Edition' },
  { pattern: /\b(\d+)\s*rdEdition\b/gi, replacement: '$1rd Edition' }
];

export function sanitizeText(text) {
  if (!text) return '';
  let cleaned = text;
  for (const { pattern, replacement } of REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned;
}
