import { calculateTheoryCredits, calculateTcpPeriods } from '../utils/creditCalculator.js';

/**
 * Theory cum Practical (TCP) Course Validation Rules (TCP-*)
 */
export function validateTcpRules(fields, context) {
  const findings = [];
  const { config, locations = {} } = context;
  const thresholds = config?.thresholds || {};

  const L = Number(fields?.L ?? 0);
  const T = Number(fields?.T ?? 0);
  const P = Number(fields?.P ?? 0);
  const credits = Number(fields?.credits);
  const statedTotal = Number(fields?.totalPeriodsStated);
  const calculatedTotal = Number(fields?.totalPeriodsCalculated);
  const experiments = Array.isArray(fields?.experiments) ? fields.experiments : [];

  const addFinding = (f) => findings.push(f);

  // 1. TCP-CREDITS-MATH: Credits = L + T + P/2 with P > 0 and L > 0
  const expectedCredits = calculateTheoryCredits(L, T, P);
  const hasBothComponents = L > 0 && P > 0;

  if (hasBothComponents && !isNaN(credits) && credits === expectedCredits) {
    addFinding({
      ruleId: 'TCP-CREDITS-MATH',
      field: 'credits',
      status: 'pass',
      severity: 'info',
      extractedValue: `Credits: ${credits}, L-T-P: ${L}-${T}-${P}`,
      expected: `${expectedCredits} credits with L>0 and P>0`,
      reason: `TCP credits match formula L + T + P/2 = ${expectedCredits} with both theory and practical components present.`,
      guidelineRef: 'TCP Format Notes, Section 1',
      howToFix: '',
      location: locations?.credits || null
    });
  } else {
    addFinding({
      ruleId: 'TCP-CREDITS-MATH',
      field: 'credits',
      status: 'fail',
      severity: 'error',
      extractedValue: `Credits: ${credits}, L-T-P: ${L}-${T}-${P}`,
      expected: `L > 0, P > 0, and Credits = ${expectedCredits} (L + T + P/2)`,
      reason: !hasBothComponents
        ? `A Theory cum Practical course must have both lecture (L > 0) and practical (P > 0) hours.`
        : `Credits are ${credits} but L-T-P is ${L}-${T}-${P}, expected ${expectedCredits}.`,
      guidelineRef: 'TCP Format Notes, Section 1',
      howToFix: 'Ensure L > 0, P > 0 and set credits to L + T + P/2.',
      location: locations?.credits || null
    });
  }

  // 2. TCP-LECTURE-PERIODS: Theory periods = (L + T) * 12
  const periods = calculateTcpPeriods(L, T, P, thresholds.periodsPerCredit || 12);
  const effectiveTotal = !isNaN(calculatedTotal) && calculatedTotal > 0 ? calculatedTotal : statedTotal;

  if (!isNaN(effectiveTotal) && effectiveTotal === periods.totalPeriods) {
    addFinding({
      ruleId: 'TCP-PERIODS-TOTAL',
      field: 'lectureSchedule',
      status: 'pass',
      severity: 'info',
      extractedValue: `${effectiveTotal} total periods`,
      expected: `${periods.totalPeriods} periods (Theory: ${periods.theoryPeriods}, Practical: ${periods.practicalPeriods})`,
      reason: `Total course periods (${effectiveTotal}) match TCP requirement: Theory ${periods.theoryPeriods} + Lab ${periods.practicalPeriods}.`,
      guidelineRef: 'TCP Format Notes, Section 2',
      howToFix: '',
      location: locations?.lectureSchedule || null
    });
  } else if (!isNaN(effectiveTotal) && effectiveTotal > 0) {
    addFinding({
      ruleId: 'TCP-PERIODS-TOTAL',
      field: 'lectureSchedule',
      status: 'fail',
      severity: 'error',
      extractedValue: `${effectiveTotal} periods`,
      expected: `${periods.totalPeriods} periods (Theory: ${periods.theoryPeriods}, Practical: ${periods.practicalPeriods})`,
      reason: `Total periods ${effectiveTotal} but ${periods.totalPeriods} required (Theory: ${periods.theoryPeriods}, Lab: ${periods.practicalPeriods}).`,
      guidelineRef: 'TCP Format Notes, Section 2',
      howToFix: `Set lecture schedule hours to ${periods.theoryPeriods} and practical hours to ${periods.practicalPeriods}.`,
      location: locations?.lectureSchedule || null
    });
  }

  // 3. TCP-EXP-MAPPING: Experiments mapped to COs
  if (experiments.length > 0) {
    const unmapped = experiments.filter(e => !e.cos || e.cos.length === 0);
    if (unmapped.length === 0) {
      addFinding({
        ruleId: 'TCP-EXP-MAPPING',
        field: 'experiments',
        status: 'pass',
        severity: 'info',
        extractedValue: 'All experiments mapped to COs',
        expected: 'Each practical experiment mapped to COs',
        reason: 'All practical experiments are aligned with course outcomes.',
        guidelineRef: 'TCP Format Notes, Section 3',
        howToFix: '',
        location: locations?.experiments || null
      });
    } else {
      addFinding({
        ruleId: 'TCP-EXP-MAPPING',
        field: 'experiments',
        status: 'warn',
        severity: 'warning',
        extractedValue: `${unmapped.length} unmapped experiments`,
        expected: 'Each practical experiment mapped to COs',
        reason: `${unmapped.length} practical experiments lack course outcome mappings.`,
        guidelineRef: 'TCP Format Notes, Section 3',
        howToFix: 'Link each experiment to corresponding course outcomes.',
        location: locations?.experiments || null
      });
    }
  }

  return findings;
}
