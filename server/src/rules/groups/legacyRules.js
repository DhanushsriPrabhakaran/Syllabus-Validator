/**
 * Legacy Compatibility & Format Gap Rules (LEGACY-*)
 */
export function validateLegacyRules(fields, context) {
  const findings = [];
  const { profile = 'REG2026_STRICT', locations = {} } = context;

  // Informational format migration helper
  const gaps = [];
  if (fields?.courseCode && fields.courseCode.startsWith('22')) {
    gaps.push('Regulation prefix 22 -> Upgrade to 26');
  }
  if (fields?.assessmentPatternType === 'BLOOM_WISE') {
    gaps.push('Bloom-wise assessment table -> Convert to CO-wise continuous & terminal matrix');
  }
  if (!fields?.booksSplit) {
    gaps.push('Single book list -> Split into 1-2 Text Books and 3-6 Reference Books');
  }
  if (fields?.courseOutcomes && fields.courseOutcomes.some(c => !c.tpsLevel && c.bloomLabel)) {
    gaps.push('Bloom labels without TPS -> Assign TPS numbers 2 to 5');
  }

  if (gaps.length > 0) {
    findings.push({
      ruleId: 'LEGACY-CONVERSION-SUMMARY',
      field: 'formatGaps',
      status: 'pass',
      severity: 'info',
      extractedValue: `${gaps.length} format gaps identified`,
      expected: 'Regulation 2026 compliant structure',
      reason: `Identified modernization gaps: ${gaps.join('; ')}.`,
      guidelineRef: 'Regulation 2026 Transition Guideline',
      howToFix: 'Use the Extraction Review screen to populate missing 2026 fields and re-validate.',
      location: null
    });
  }

  return findings;
}
