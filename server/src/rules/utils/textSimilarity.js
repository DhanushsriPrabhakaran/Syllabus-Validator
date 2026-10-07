/**
 * Text similarity and NLP utilities for deterministic syllabus validation.
 */

// Common English stopwords to ignore in semantic comparisons
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 's', 'same', 'she', 'should', 'so', 'some', 'such', 't',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenize string into cleaned lowercase word tokens, removing stopwords
 */
export function tokenize(text, removeStopwords = true) {
  if (!text || typeof text !== 'string') return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);

  if (removeStopwords) {
    return tokens.filter(t => !STOPWORDS.has(t));
  }
  return tokens;
}

/**
 * Build term frequency map
 */
export function getTermFrequencies(tokens) {
  const map = new Map();
  for (const t of tokens) {
    map.set(t, (map.get(t) || 0) + 1);
  }
  return map;
}

/**
 * Compute Cosine Similarity between two texts (0.0 to 1.0)
 */
export function calculateCosineSimilarity(textA, textB) {
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqA = getTermFrequencies(tokensA);
  const freqB = getTermFrequencies(tokensB);

  const allTerms = new Set([...freqA.keys(), ...freqB.keys()]);

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const term of allTerms) {
    const a = freqA.get(term) || 0;
    const b = freqB.get(term) || 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compute Jaccard token overlap between two texts (0.0 to 1.0)
 */
export function calculateJaccardOverlap(textA, textB) {
  const setA = new Set(tokenize(textA));
  const setB = new Set(tokenize(textB));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Check if text begins with generic opener phrases
 */
const GENERIC_OPENERS = [
  /\b(this\s+course\s+(will\s+cover|is\s+designed\s+to|covers|aims\s+to|provides|introduces))\b/i,
  /\b(the\s+course\s+(will\s+cover|is\s+designed\s+to|covers|aims\s+to|provides|introduces|deals\s+with))\b/i,
  /\b(students\s+will\s+(learn|understand|gain|be\s+introduced))\b/i,
  /\b(the\s+objective\s+of\s+this\s+course)\b/i,
  /\b(in\s+this\s+course)\b/i
];

export function checkGenericPreamble(text) {
  if (!text) return null;
  for (const pattern of GENERIC_OPENERS) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}
