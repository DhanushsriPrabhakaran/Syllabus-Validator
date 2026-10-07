import { calculateLabCredits } from '../utils/creditCalculator.js';

/**
 * Laboratory (Practical) Course Validation Rules (LAB-*)
 */
export function validateLabRules(fields, context) {
  const findings = [];
  const { config, locations = {} } = context;
  const thresholds = config?.thresholds || {};

  const L = Number(fields?.L ?? 0);
  const T = Number(fields?.T ?? 0);
  const P = Number(fields?.P ?? 0);
  const credits = Number(fields?.credits);
  const cos = Array.isArray(fields?.courseOutcomes) ? fields.courseOutcomes : [];
  const experiments = Array.isArray(fields?.experiments) ? fields.experiments : [];

  const addFinding = (f) => findings.push(f);

  // 1. LAB-CREDITS-P: L=0, T=0, Credits = P / 2
  const expectedCredits = calculateLabCredits(P);
  const isZeroLT = L === 0 && T === 0;
  if (isZeroLT && !isNaN(credits) && credits === expectedCredits) {
    addFinding({
      ruleId: 'LAB-CREDITS-P',
      field: 'credits',
      status: 'pass',
      severity: 'info',
      extractedValue: `Credits: ${credits}, L-T-P: 0-0-${P}`,
      expected: `${expectedCredits} credits (P/2)`,
      reason: `Laboratory credits match formula: P/2 = ${expectedCredits} with L=0, T=0.`,
      guidelineRef: 'Lab guideline, Section 1',
      howToFix: '',
      location: locations?.credits || null
    });
  } else {
    addFinding({
      ruleId: 'LAB-CREDITS-P',
      field: 'credits',
      status: 'fail',
      severity: 'error',
      extractedValue: `Credits: ${credits}, L-T-P: ${L}-${T}-${P}`,
      expected: `L=0, T=0, Credits = ${expectedCredits} (P/2)`,
      reason: `Practical courses must have L=0, T=0, and Credits = P/2 (expected ${expectedCredits}, found ${credits}).`,
      guidelineRef: 'Lab guideline, Section 1',
      howToFix: `Set L=0, T=0 and credits = ${expectedCredits}.`,
      location: locations?.credits || null
    });
  }

  // 2. LAB-CO-COUNT: 6 to 7 COs recommended
  const minLabCo = thresholds.coCountLabMin || 6;
  const maxLabCo = thresholds.coCountLabMax || 7;
  if (cos.length >= minLabCo && cos.length <= maxLabCo) {
    addFinding({
      ruleId: 'LAB-CO-COUNT',
      field: 'courseOutcomes',
      status: 'pass',
      severity: 'info',
      extractedValue: `${cos.length} COs`,
      expected: `${minLabCo} to ${maxLabCo} Course Outcomes`,
      reason: `Laboratory has ${cos.length} COs, meeting the 6-7 recommendation.`,
      guidelineRef: 'Lab guideline, Section 2',
      howToFix: '',
      location: locations?.courseOutcomes || null
    });
  } else {
    addFinding({
      ruleId: 'LAB-CO-COUNT',
      field: 'courseOutcomes',
      status: 'warn',
      severity: 'warning',
      extractedValue: `${cos.length} COs`,
      expected: `${minLabCo} to ${maxLabCo} Course Outcomes`,
      reason: `Laboratory has ${cos.length} COs (recommended: ${minLabCo} to ${maxLabCo} including affective and psychomotor outcomes).`,
      guidelineRef: 'Lab guideline, Section 2',
      howToFix: `Structure laboratory outcomes into ${minLabCo} to ${maxLabCo} COs covering psychomotor, affective, and cognitive domains.`,
      location: locations?.courseOutcomes || null
    });
  }

  // 3. LAB-EXP-COUNT: Min 10-12 experiments
  if (experiments.length >= 10) {
    addFinding({
      ruleId: 'LAB-EXP-COUNT',
      field: 'experiments',
      status: 'pass',
      severity: 'info',
      extractedValue: `${experiments.length} experiments`,
      expected: '>= 10 experiments',
      reason: `Laboratory lists ${experiments.length} experiments (guideline: minimum 10-12).`,
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: '',
      location: locations?.experiments || null
    });
  } else {
    addFinding({
      ruleId: 'LAB-EXP-COUNT',
      field: 'experiments',
      status: 'warn',
      severity: 'warning',
      extractedValue: `${experiments.length} experiments`,
      expected: 'Minimum 10 to 12 experiments',
      reason: `Laboratory has ${experiments.length} experiments, which is below the recommended 10-12 experiments.`,
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: 'Include at least 10 to 12 structured experiments.',
      location: locations?.experiments || null
    });
  }

  // 4. LAB-EXP-LEVEL: Schwab/Herron enquiry levels 1 to 3 (Level 0 warns, >3 errors)
  let level0Count = 0;
  let invalidLevelCount = 0;
  for (const exp of experiments) {
    const lvl = Number(exp.level);
    if (lvl === 0) level0Count++;
    else if (lvl < 0 || lvl > 3 || isNaN(lvl)) invalidLevelCount++;
  }

  if (invalidLevelCount > 0) {
    addFinding({
      ruleId: 'LAB-EXP-LEVEL',
      field: 'experiments',
      status: 'fail',
      severity: 'error',
      extractedValue: `${invalidLevelCount} invalid enquiry levels`,
      expected: 'Enquiry levels 1 to 3',
      reason: `Found experiments with enquiry levels outside the allowed Schwab/Herron range of 1 to 3.`,
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: 'Assign valid enquiry levels (1: Structured, 2: Guided, 3: Open) to each experiment.',
      location: locations?.experiments || null
    });
  } else if (level0Count > 0) {
    addFinding({
      ruleId: 'LAB-EXP-LEVEL',
      field: 'experiments',
      status: 'warn',
      severity: 'warning',
      extractedValue: `${level0Count} Level 0 experiments`,
      expected: 'Enquiry levels 1, 2, or 3',
      reason: `Found ${level0Count} experiment(s) with Level 0 (Confirmation). Guideline emphasizes Level 1, 2, or 3 enquiry.`,
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: 'Elevate Level 0 experiments to Level 1 (Structured) or higher.',
      location: locations?.experiments || null
    });
  } else if (experiments.length > 0) {
    addFinding({
      ruleId: 'LAB-EXP-LEVEL',
      field: 'experiments',
      status: 'pass',
      severity: 'info',
      extractedValue: 'All enquiry levels 1 to 3',
      expected: 'Enquiry levels 1 to 3',
      reason: 'All experiments have valid enquiry levels (1 to 3).',
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: '',
      location: locations?.experiments || null
    });
  }

  // 5. LAB-EXP-MAPPING: Experiments mapped to COs
  const unmappedExps = experiments.filter(e => !e.cos || e.cos.length === 0);
  if (unmappedExps.length === 0 && experiments.length > 0) {
    addFinding({
      ruleId: 'LAB-EXP-MAPPING',
      field: 'experiments',
      status: 'pass',
      severity: 'info',
      extractedValue: 'All experiments mapped to COs',
      expected: 'Each experiment mapped to >= 1 CO',
      reason: 'All experiments are mapped to relevant Course Outcomes.',
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: '',
      location: locations?.experiments || null
    });
  } else if (unmappedExps.length > 0) {
    addFinding({
      ruleId: 'LAB-EXP-MAPPING',
      field: 'experiments',
      status: 'warn',
      severity: 'warning',
      extractedValue: `${unmappedExps.length} unmapped experiments`,
      expected: 'Each experiment mapped to >= 1 CO',
      reason: `${unmappedExps.length} experiments do not have mapped Course Outcomes.`,
      guidelineRef: 'Lab guideline, Section 3',
      howToFix: 'Map each experiment to the corresponding Course Outcomes (e.g. CO1, CO2).',
      location: locations?.experiments || null
    });
  }

  return findings;
}
