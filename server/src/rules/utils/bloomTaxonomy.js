/**
 * Bloom Taxonomy and Thinking Process Skills (TPS) mapping utilities.
 */

export const DEFAULT_BLOOM_TO_TPS = {
  Remember: 1,
  Understand: 2,
  Apply: 3,
  Analyze: 4,
  Evaluate: 5,
  Create: 5
};

export const DEFAULT_ACTION_VERBS = {
  tps2: ['explain', 'describe', 'interpret', 'classify'],
  tps3: ['solve', 'compute', 'demonstrate', 'use', 'apply'],
  tps4: ['compare', 'differentiate', 'examine', 'break down', 'analyze', 'analyse'],
  tps5: ['assess', 'conclude', 'critique', 'decide', 'evaluate', 'justify', 'prioritise', 'prioritize', 'recommend', 'validate', 'verify']
};

/**
 * Normalizes Bloom level to TPS number 1..5
 */
export function getTpsFromBloom(bloomLabel, customMapping) {
  if (!bloomLabel) return null;
  const mapping = customMapping || DEFAULT_BLOOM_TO_TPS;
  const normalized = bloomLabel.trim();
  for (const [key, val] of Object.entries(mapping)) {
    if (key.toLowerCase() === normalized.toLowerCase()) {
      return val;
    }
  }
  return null;
}

/**
 * Extracts the first word (action verb) from a CO statement
 */
export function extractFirstVerb(statement) {
  if (!statement || typeof statement !== 'string') return '';
  const cleaned = statement.trim().replace(/^CO\d+[:\s\-\.]*/i, '');
  const match = cleaned.match(/^([a-zA-Z]+)/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Validates whether a verb matches the expected TPS level
 * Returns: { valid: boolean, foundTps: number | null, isUnlisted: boolean }
 */
export function validateVerbForTps(verb, tpsLevel, actionVerbsConfig) {
  if (!verb) return { valid: false, foundTps: null, isUnlisted: true };
  const v = verb.toLowerCase();
  const verbs = actionVerbsConfig || DEFAULT_ACTION_VERBS;

  // Check which TPS level contains this verb, if any
  let foundTps = null;
  for (let lvl = 2; lvl <= 5; lvl++) {
    const list = verbs[`tps${lvl}`] || [];
    if (list.map(x => x.toLowerCase()).includes(v)) {
      foundTps = lvl;
      break;
    }
  }

  if (foundTps === null) {
    return { valid: false, foundTps: null, isUnlisted: true };
  }

  return {
    valid: foundTps === tpsLevel,
    foundTps,
    isUnlisted: false
  };
}
