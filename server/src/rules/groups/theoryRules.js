import { calculateCosineSimilarity, checkGenericPreamble } from '../utils/textSimilarity.js';
import { getTpsFromBloom, validateVerbForTps, extractFirstVerb } from '../utils/bloomTaxonomy.js';
import { calculateTheoryCredits, calculateRequiredPeriods } from '../utils/creditCalculator.js';

/**
 * Theory Course Validation Rules (THEORY-*)
 */
export function validateTheoryRules(fields, context) {
  const findings = [];
  const { config, userDept, uploaderEmail, profile = 'REG2026_STRICT', courseNature = 'Core', isCommonCourse = false, locations = {} } = context;
  const isStrict = profile === 'REG2026_STRICT';
  const thresholds = config?.thresholds || {};

  const courseCode = (fields?.courseCode || '').trim();
  const courseName = (fields?.courseName || '').trim();
  const credits = Number(fields?.credits);
  const L = Number(fields?.L ?? 0);
  const T = Number(fields?.T ?? 0);
  const P = Number(fields?.P ?? 0);
  const preamble = fields?.preamble || {};
  const cos = Array.isArray(fields?.courseOutcomes) ? fields.courseOutcomes : [];
  const assess = fields?.assessmentPattern;
  const assessBloom = fields?.assessmentPatternByBloom;
  const assessType = fields?.assessmentPatternType || 'NOT_FOUND';
  const booksSplit = fields?.booksSplit !== false;
  const textBooks = Array.isArray(fields?.textBooks) ? fields.textBooks : [];
  const refBooks = Array.isArray(fields?.referenceBooks) ? fields.referenceBooks : [];
  const schedule = Array.isArray(fields?.lectureSchedule) ? fields.lectureSchedule : [];
  const designers = Array.isArray(fields?.courseDesigners) ? fields.courseDesigners : [];

  // Helper to add findings
  const addFinding = (f) => findings.push(f);

  // -------------------------------------------------------------
  // 1. Course Code Rules
  // -------------------------------------------------------------
  // Expected format: RR AA C U V (7 chars) or legacy (e.g. 22CA120)
  const codeClean = courseCode.replace(/\s+/g, '');
  const codeLoc = locations?.courseCode || null;

  // Extract parts
  const regMatch = codeClean.match(/^(\d{2})([A-Z]{2})(.*)$/);
  const RR = regMatch ? regMatch[1] : '';
  const AA = regMatch ? regMatch[2] : '';
  const rest = regMatch ? regMatch[3] : '';

  // 1.1 THEORY-CODE-DEPT
  if (AA) {
    const isDeptMatch = userDept ? AA.toUpperCase() === userDept.toUpperCase() : true;
    const isCommon = isCommonCourse || (config?.commonCourseDepts || []).includes(AA.toUpperCase());

    if (isDeptMatch || (isCommonCourse && isCommon)) {
      addFinding({
        ruleId: 'THEORY-CODE-DEPT',
        field: 'courseCode',
        status: 'pass',
        severity: 'info',
        extractedValue: AA,
        expected: userDept || 'Matching Department',
        reason: `Programme code ${AA} matches faculty department (${userDept || AA}).`,
        guidelineRef: 'Theory guideline, Section 1.2',
        howToFix: '',
        location: codeLoc
      });
    } else {
      addFinding({
        ruleId: 'THEORY-CODE-DEPT',
        field: 'courseCode',
        status: isCommon ? 'warn' : 'fail',
        severity: isCommon ? 'warning' : 'error',
        extractedValue: AA,
        expected: userDept,
        reason: `Programme code ${AA} does not match your department (${userDept}). Expected a code starting with ${RR || '26'}${userDept}.`,
        guidelineRef: 'Theory guideline, Section 1.2',
        howToFix: `Change programme code to ${userDept} or mark as Common Course.`,
        location: codeLoc
      });
    }
  }

  // 1.2 THEORY-CODE-REG
  const curReg = config?.currentRegulation || '26';
  if (RR === curReg) {
    addFinding({
      ruleId: 'THEORY-CODE-REG',
      field: 'courseCode',
      status: 'pass',
      severity: 'info',
      extractedValue: RR,
      expected: curReg,
      reason: `Regulation prefix ${RR} matches current regulation (${curReg}).`,
      guidelineRef: 'Theory guideline, Section 1.2',
      howToFix: '',
      location: codeLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-CODE-REG',
      field: 'courseCode',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: RR,
      expected: curReg,
      reason: isStrict
        ? `Course code uses Regulation ${RR}; new syllabi must use ${curReg}.`
        : `Course code uses legacy Regulation ${RR} (current is ${curReg}).`,
      guidelineRef: 'Theory guideline, Section 1.2',
      howToFix: `Update course regulation prefix to ${curReg} (e.g. 26${AA}...).`,
      location: codeLoc
    });
  }

  // 1.3 THEORY-CODE-UV (Checks C U V pattern: Category char, Identifier char [A-Z except I,O], Version digit [0-9])
  const cuvRegex = /^[A-Z0-9][A-HJ-NP-Z][0-9]$/;
  if (cuvRegex.test(rest)) {
    addFinding({
      ruleId: 'THEORY-CODE-UV',
      field: 'courseCode',
      status: 'pass',
      severity: 'info',
      extractedValue: rest,
      expected: 'C U V format',
      reason: `Course suffix '${rest}' follows standard C U V pattern.`,
      guidelineRef: 'Theory guideline, Section 1.2',
      howToFix: '',
      location: codeLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-CODE-UV',
      field: 'courseCode',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: rest,
      expected: 'C U V format (Category letter, Identifier letter A-Z except I/O, Version digit)',
      reason: `Suffix '${rest}' does not match the C U V pattern: expected category code, identifier letter (A-Z except I and O), and version digit.`,
      guidelineRef: 'Theory guideline, Section 1.2',
      howToFix: `Format the course code as RR AA C U V (e.g. 26${AA || 'CS'}CA0).`,
      location: codeLoc
    });
  }

  // -------------------------------------------------------------
  // 2. Course Name Rules
  // -------------------------------------------------------------
  const nameLoc = locations?.courseName || null;

  // 2.1 THEORY-NAME-CHARS: Only letters, digits and spaces
  const disallowedMatch = courseName.match(/[^a-zA-Z0-9\s]/g);
  if (disallowedMatch) {
    const uniqueChars = [...new Set(disallowedMatch)].join(' ');
    addFinding({
      ruleId: 'THEORY-NAME-CHARS',
      field: 'courseName',
      status: 'fail',
      severity: 'error',
      extractedValue: courseName,
      expected: 'Letters, digits, and spaces only',
      reason: `Course name contains disallowed characters: ${uniqueChars}. Only letters, digits and spaces are allowed.`,
      guidelineRef: 'Theory guideline, Section 1.1',
      howToFix: `Remove characters '${uniqueChars}' and spell out words like 'AND'.`,
      location: nameLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-NAME-CHARS',
      field: 'courseName',
      status: 'pass',
      severity: 'info',
      extractedValue: courseName,
      expected: 'Letters, digits, and spaces only',
      reason: 'Course name contains only allowed characters.',
      guidelineRef: 'Theory guideline, Section 1.1',
      howToFix: '',
      location: nameLoc
    });
  }

  // 2.2 THEORY-NAME-LEN: <= 60 characters
  const maxLen = thresholds.courseNameMaxLen || 60;
  if (courseName.length <= maxLen) {
    addFinding({
      ruleId: 'THEORY-NAME-LEN',
      field: 'courseName',
      status: 'pass',
      severity: 'info',
      extractedValue: `${courseName.length} characters`,
      expected: `<= ${maxLen} characters`,
      reason: `Course name length is ${courseName.length} characters (limit: ${maxLen}).`,
      guidelineRef: 'Theory guideline, Section 1.1',
      howToFix: '',
      location: nameLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-NAME-LEN',
      field: 'courseName',
      status: 'fail',
      severity: 'error',
      extractedValue: `${courseName.length} characters`,
      expected: `<= ${maxLen} characters`,
      reason: `Course name exceeds maximum length of ${maxLen} characters (found ${courseName.length}).`,
      guidelineRef: 'Theory guideline, Section 1.1',
      howToFix: `Shorten course name to ${maxLen} characters or fewer.`,
      location: nameLoc
    });
  }

  // 2.3 THEORY-NAME-CASE: Title Case
  const words = courseName.split(/\s+/).filter(Boolean);
  const isAllCaps = words.length > 0 && courseName === courseName.toUpperCase() && /[A-Z]/.test(courseName);
  const isAllLower = words.length > 0 && courseName === courseName.toLowerCase();
  if (isAllCaps || isAllLower) {
    addFinding({
      ruleId: 'THEORY-NAME-CASE',
      field: 'courseName',
      status: 'warn',
      severity: 'warning',
      extractedValue: courseName,
      expected: 'Title Case (e.g. Data Structures and Applications)',
      reason: isAllCaps
        ? 'Course name is in ALL CAPS. Title Case is required.'
        : 'Course name is all lower case. Title Case is required.',
      guidelineRef: 'Theory guideline, Section 1.1',
      howToFix: 'Convert course title to Title Case with lowercase small words.',
      location: nameLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-NAME-CASE',
      field: 'courseName',
      status: 'pass',
      severity: 'info',
      extractedValue: courseName,
      expected: 'Title Case',
      reason: 'Course name uses valid Title Case.',
      guidelineRef: 'Theory guideline, Section 1.1',
      howToFix: '',
      location: nameLoc
    });
  }

  // -------------------------------------------------------------
  // 3. Credits and L-T-P
  // -------------------------------------------------------------
  const expectedCredits = calculateTheoryCredits(L, T, P);
  const creditsLoc = locations?.credits || locations?.category || null;
  if (!isNaN(credits) && credits === expectedCredits) {
    addFinding({
      ruleId: 'THEORY-CREDITS-MATH',
      field: 'credits',
      status: 'pass',
      severity: 'info',
      extractedValue: `Credits: ${credits}, L-T-P: ${L}-${T}-${P}`,
      expected: `${expectedCredits} credits`,
      reason: `Credits match formula: ${L} + ${T} + ${P}/2 = ${expectedCredits}.`,
      guidelineRef: 'Theory guideline, Section 1.3',
      howToFix: '',
      location: creditsLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-CREDITS-MATH',
      field: 'credits',
      status: 'fail',
      severity: 'error',
      extractedValue: `Credits: ${credits}, L-T-P: ${L}-${T}-${P}`,
      expected: `${expectedCredits} credits (L + T + P/2)`,
      reason: `Credits are ${credits} but L-T-P is ${L}-${T}-${P}, so credits should be ${expectedCredits} (L + T + P/2).`,
      guidelineRef: 'Theory guideline, Section 1.3',
      howToFix: `Adjust credit value to ${expectedCredits} or correct L-T-P periods.`,
      location: creditsLoc
    });
  }

  // -------------------------------------------------------------
  // 4. Preamble Rules
  // -------------------------------------------------------------
  const preambleText = preamble.text || '';
  const wordCount = preamble.wordCount || (preambleText.trim() ? preambleText.trim().split(/\s+/).length : 0);
  const lineCount = preamble.lineCount || 0;
  const minWords = thresholds.preambleWordMin || 60;
  const maxWords = thresholds.preambleWordMax || 90;
  const preambleLoc = locations?.preamble || null;

  // 4.1 THEORY-PREAMBLE-WORDS
  if (wordCount >= minWords && wordCount <= maxWords) {
    addFinding({
      ruleId: 'THEORY-PREAMBLE-WORDS',
      field: 'preamble',
      status: 'pass',
      severity: 'info',
      extractedValue: `${wordCount} words`,
      expected: `${minWords} to ${maxWords} words`,
      reason: `Preamble word count (${wordCount} words) is within the recommended range.`,
      guidelineRef: 'Theory guideline, Section 2',
      howToFix: '',
      location: preambleLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-PREAMBLE-WORDS',
      field: 'preamble',
      status: 'warn',
      severity: 'warning',
      extractedValue: `${wordCount} words`,
      expected: `${minWords} to ${maxWords} words`,
      reason: `Preamble has ${wordCount} words, which is ${wordCount < minWords ? 'below' : 'above'} the recommended ${minWords} to ${maxWords} word guideline.`,
      guidelineRef: 'Theory guideline, Section 2',
      howToFix: `Revise preamble narrative to be between ${minWords} and ${maxWords} words.`,
      location: preambleLoc
    });
  }

  // 4.2 THEORY-PREAMBLE-LINES (Informational check: 3 to 4 lines)
  if (lineCount >= 3 && lineCount <= 4) {
    addFinding({
      ruleId: 'THEORY-PREAMBLE-LINES',
      field: 'preamble',
      status: 'pass',
      severity: 'info',
      extractedValue: `${lineCount} lines`,
      expected: '3 to 4 lines',
      reason: `Preamble has ${lineCount} lines, meeting the recommended 3-4 lines layout.`,
      guidelineRef: 'Theory guideline, Section 2',
      howToFix: '',
      location: preambleLoc
    });
  }

  // 4.3 THEORY-PREAMBLE-GENERIC: Flags generic opener phrases
  const genericOpener = checkGenericPreamble(preambleText);
  if (genericOpener) {
    addFinding({
      ruleId: 'THEORY-PREAMBLE-GENERIC',
      field: 'preamble',
      status: 'warn',
      severity: 'warning',
      extractedValue: genericOpener,
      expected: 'Specific domain motivation and engineering context',
      reason: `Generic opener phrase detected: "${genericOpener}". Preambles should explain why the course matters rather than generic student-intent phrases.`,
      guidelineRef: 'Theory guideline, Section 2',
      howToFix: 'Replace generic opening sentences with the industry context and engineering rationale.',
      location: preambleLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-PREAMBLE-GENERIC',
      field: 'preamble',
      status: 'pass',
      severity: 'info',
      extractedValue: 'No generic phrasing detected',
      expected: 'Specific domain motivation and engineering context',
      reason: 'Preamble does not contain generic student-intent phrases.',
      guidelineRef: 'Theory guideline, Section 2',
      howToFix: '',
      location: preambleLoc
    });
  }

  // -------------------------------------------------------------
  // 5. Course Outcomes (CO) Rules
  // -------------------------------------------------------------
  const minCo = thresholds.coCountTheoryMin || 6;
  const maxCo = thresholds.coCountTheoryMax || 8;
  const coCount = cos.length;

  // 5.1 THEORY-CO-COUNT
  if (coCount >= minCo && coCount <= maxCo) {
    addFinding({
      ruleId: 'THEORY-CO-COUNT',
      field: 'courseOutcomes',
      status: 'pass',
      severity: 'info',
      extractedValue: `${coCount} COs`,
      expected: `${minCo} to ${maxCo} Course Outcomes`,
      reason: `Found ${coCount} Course Outcomes, satisfying the required range of ${minCo} to ${maxCo}.`,
      guidelineRef: 'Theory guideline, Section 3.1',
      howToFix: '',
      location: locations?.courseOutcomes || null
    });
  } else {
    addFinding({
      ruleId: 'THEORY-CO-COUNT',
      field: 'courseOutcomes',
      status: 'fail',
      severity: 'error',
      extractedValue: `${coCount} COs`,
      expected: `${minCo} to ${maxCo} Course Outcomes`,
      reason: `Found ${coCount} COs. A theory course must have between ${minCo} and ${maxCo} Course Outcomes.`,
      guidelineRef: 'Theory guideline, Section 3.1',
      howToFix: `Formulate between ${minCo} and ${maxCo} distinct Course Outcomes.`,
      location: locations?.courseOutcomes || null
    });
  }

  // 5.2 Format gaps: Check presence of TPS, PI, Weightage, SDG columns in COs
  let hasTps = true;
  let hasPi = true;
  let hasWeightage = true;
  let hasSdg = true;

  for (const co of cos) {
    if (co.tpsLevel === undefined || co.tpsLevel === null || co.tpsLevel === '') hasTps = false;
    if (!co.pi) hasPi = false;
    if (co.coWeightage === undefined || co.coWeightage === null) hasWeightage = false;
    if (!co.sdg) hasSdg = false;
  }

  // TPS column check
  if (!hasTps) {
    addFinding({
      ruleId: 'THEORY-CO-FORMAT-TPS',
      field: 'courseOutcomes',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: 'Missing TPS column in CO table',
      expected: 'TPS level (2 to 5) specified for each CO',
      reason: isStrict
        ? 'TPS level column is missing in Course Outcomes table; 2026 format requires explicit TPS levels (2 to 5).'
        : 'Legacy format gap: TPS level missing. Bloom level mapped to approximate TPS.',
      guidelineRef: 'Theory guideline, Section 3.2',
      howToFix: 'Add a TPS column with values from 2 to 5 (mapped from Bloom taxonomy).',
      location: locations?.courseOutcomes || null
    });
  }

  // PI column check
  if (!hasPi) {
    addFinding({
      ruleId: 'THEORY-CO-FORMAT-PI',
      field: 'courseOutcomes',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: 'Missing PI column in CO table',
      expected: 'Performance Indicator (PI) specified for each CO (e.g. 1.4.1)',
      reason: isStrict
        ? 'Performance Indicator (PI) column is missing in Course Outcomes table.'
        : 'Legacy format gap: Performance Indicator (PI) column not found.',
      guidelineRef: 'Theory guideline, Section 3.3',
      howToFix: 'Map each Course Outcome to a distinct Performance Indicator from the department catalogue.',
      location: locations?.courseOutcomes || null
    });
  }

  // Weightage column check
  if (!hasWeightage) {
    addFinding({
      ruleId: 'THEORY-CO-FORMAT-WEIGHTAGE',
      field: 'courseOutcomes',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: 'Missing CO weightage column',
      expected: 'Weightage percentage (summing to 100%) for each CO',
      reason: isStrict
        ? 'CO Weightage column is missing in Course Outcomes table.'
        : 'Legacy format gap: CO Weightage column not present.',
      guidelineRef: 'Theory guideline, Section 3.4',
      howToFix: 'Assign weightage percentages (8% to 20%) to each CO totaling 100%.',
      location: locations?.courseOutcomes || null
    });
  }

  // SDG column check
  if (!hasSdg) {
    addFinding({
      ruleId: 'THEORY-CO-FORMAT-SDG',
      field: 'courseOutcomes',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: 'Missing SDG column in CO table',
      expected: 'SDG number and level for each CO',
      reason: isStrict
        ? 'SDG column is missing in Course Outcomes table.'
        : 'Legacy format gap: SDG mapping column not present.',
      guidelineRef: 'Theory guideline, Section 5',
      howToFix: 'Map relevant Course Outcomes to UN Sustainable Development Goals (SDG 1-17).',
      location: locations?.courseOutcomes || null
    });
  }

  // 5.3 TPS Ratio (>= 70% at TPS 3 or above)
  // For legacy COs without numeric TPS, map bloomLabel (e.g. Apply -> 3)
  const coTpsLevels = cos.map(co => {
    if (co.tpsLevel) return Number(co.tpsLevel);
    if (co.bloomLabel) return getTpsFromBloom(co.bloomLabel, config?.bloomToTpsMapping);
    return null;
  });

  const validTpsList = coTpsLevels.filter(lvl => lvl !== null);
  if (validTpsList.length > 0) {
    const tps3PlusCount = validTpsList.filter(lvl => lvl >= 3).length;
    const ratio = Math.round((tps3PlusCount / validTpsList.length) * 100);
    const requiredRatio = thresholds.coTps3PlusPercentageMin || 70;

    if (ratio >= requiredRatio) {
      addFinding({
        ruleId: 'THEORY-CO-TPS-RATIO',
        field: 'courseOutcomes',
        status: 'pass',
        severity: 'info',
        extractedValue: `${tps3PlusCount} of ${validTpsList.length} COs (${ratio}%)`,
        expected: `>= ${requiredRatio}% at TPS 3 or above`,
        reason: `${ratio}% of COs are at TPS 3 or higher, satisfying the ${requiredRatio}% requirement.`,
        guidelineRef: 'Theory guideline, Section 3.2',
        howToFix: '',
        location: locations?.courseOutcomes || null
      });
    } else {
      addFinding({
        ruleId: 'THEORY-CO-TPS-RATIO',
        field: 'courseOutcomes',
        status: 'fail',
        severity: 'error',
        extractedValue: `${tps3PlusCount} of ${validTpsList.length} COs (${ratio}%)`,
        expected: `>= ${requiredRatio}% at TPS 3 or above`,
        reason: `Only ${tps3PlusCount} of ${validTpsList.length} COs are at TPS 3 or higher (${ratio}%). Minimum ${requiredRatio}% required.`,
        guidelineRef: 'Theory guideline, Section 3.2',
        howToFix: 'Elevate lower-level COs to Application (TPS 3), Analysis (TPS 4), or Evaluation (TPS 5).',
        location: locations?.courseOutcomes || null
      });
    }
  }

  // 5.4 Verb matching: check each CO's first verb against approved action verbs
  const unlistedVerbs = [];
  const mismatchedVerbs = [];
  for (let i = 0; i < cos.length; i++) {
    const co = cos[i];
    const verb = co.firstVerb || extractFirstVerb(co.statement);
    const expectedTps = co.tpsLevel ? Number(co.tpsLevel) : (co.bloomLabel ? getTpsFromBloom(co.bloomLabel, config?.bloomToTpsMapping) : 3);
    const check = validateVerbForTps(verb, expectedTps, config?.actionVerbs);

    if (check.isUnlisted) {
      if (verb) unlistedVerbs.push({ id: co.id || `CO${i + 1}`, verb });
    } else if (!check.valid) {
      mismatchedVerbs.push({ id: co.id || `CO${i + 1}`, verb, expectedTps, foundTps: check.foundTps });
    }
  }

  if (unlistedVerbs.length > 0) {
    const verbNames = [...new Set(unlistedVerbs.map(u => u.verb))].join(', ');
    addFinding({
      ruleId: 'THEORY-CO-VERB-MATCH',
      field: 'courseOutcomes',
      status: 'warn',
      severity: 'warning',
      extractedValue: verbNames,
      expected: 'Approved Regulation 2026 action verbs for TPS level',
      reason: `Action verbs (${verbNames}) are not in the approved Regulation 2026 action verbs list.`,
      guidelineRef: 'Theory guideline, Section 3.2',
      howToFix: 'Select approved action verbs from the TCE Bloom-to-TPS taxonomy list.',
      location: locations?.courseOutcomes || null
    });
  } else if (mismatchedVerbs.length > 0) {
    const item = mismatchedVerbs[0];
    addFinding({
      ruleId: 'THEORY-CO-VERB-MATCH',
      field: 'courseOutcomes',
      status: 'fail',
      severity: 'error',
      extractedValue: `${item.id}: '${item.verb}'`,
      expected: `Approved action verb for TPS ${item.expectedTps}`,
      reason: `${item.id} starts with '${item.verb}' which belongs to TPS ${item.foundTps}, but the CO is assigned TPS ${item.expectedTps}.`,
      guidelineRef: 'Theory guideline, Section 3.2',
      howToFix: `Change '${item.verb}' to an action verb appropriate for TPS ${item.expectedTps}.`,
      location: locations?.courseOutcomes || null
    });
  } else if (cos.length > 0) {
    addFinding({
      ruleId: 'THEORY-CO-VERB-MATCH',
      field: 'courseOutcomes',
      status: 'pass',
      severity: 'info',
      extractedValue: 'All verbs match taxonomy',
      expected: 'Approved action verbs',
      reason: 'All CO action verbs match approved TPS taxonomy.',
      guidelineRef: 'Theory guideline, Section 3.2',
      howToFix: '',
      location: locations?.courseOutcomes || null
    });
  }

  // -------------------------------------------------------------
  // 6. Assessment Pattern Rules
  // -------------------------------------------------------------
  const assessLoc = locations?.assessmentPattern || null;

  // 6.1 Layout check: 2026 requires CO-wise layout
  if (assessType === 'BLOOM_WISE') {
    addFinding({
      ruleId: 'THEORY-ASSESS-LAYOUT',
      field: 'assessmentPattern',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: 'Bloom-wise assessment layout',
      expected: 'CO-wise assessment pattern with CAT1, Assignment 1, CAT2, Assignment 2, and Terminal',
      reason: isStrict
        ? 'CO-wise assessment pattern with CAT1, Assignment 1, CAT2, Assignment 2 and Terminal is required.'
        : 'Legacy format: Bloom-wise assessment table detected instead of 2026 CO-wise layout.',
      guidelineRef: 'Theory guideline, Section 4.1',
      howToFix: 'Convert the assessment matrix to a CO-wise distribution across continuous assessments and terminal exams.',
      location: assessLoc
    });

    // Check Bloom-wise column sums and dominant Bloom level share
    const bloomData = assessBloom || assess?.byBloom;
    if (bloomData && typeof bloomData === 'object') {
      const cols = ['CAT1', 'CAT2', 'CAT3', 'Terminal'];
      let allSums100 = true;
      const colSums = {};
      const applyShares = {};

      for (const col of cols) {
        let sum = 0;
        let applyVal = 0;
        for (const [lvl, marks] of Object.entries(bloomData)) {
          const val = Number(marks?.[col] ?? 0);
          sum += val;
          if (lvl.toLowerCase() === 'apply') {
            applyVal = val;
          }
        }
        colSums[col] = sum;
        applyShares[col] = applyVal;
        if (sum !== 100 && sum !== 0) allSums100 = false;
      }

      // Column sums check
      if (allSums100) {
        addFinding({
          ruleId: 'THEORY-ASSESS-COLS-SUM',
          field: 'assessmentPattern',
          status: 'pass',
          severity: 'info',
          extractedValue: Object.entries(colSums).map(([k, v]) => `${k}=${v}`).join(', '),
          expected: 'Each assessment column sum === 100',
          reason: 'Assessment component columns (CAT1, CAT2, CAT3, Terminal) each sum to 100.',
          guidelineRef: 'Theory guideline, Section 4.1',
          howToFix: '',
          location: assessLoc
        });
      }

      // Approximate Bloom-70 rule: CAT1 & CAT2 vs CAT3 & Terminal
      // In sample: CAT1 = 60, CAT2 = 60 (< 70), CAT3 = 80, Terminal = 80 (>= 70)
      const lowApplyCols = Object.entries(applyShares).filter(([k, v]) => v > 0 && v < 70);
      if (lowApplyCols.length > 0) {
        const desc = lowApplyCols.map(([k, v]) => `${k} = ${v}%`).join(', ');
        addFinding({
          ruleId: 'THEORY-ASSESS-BLOOM-70',
          field: 'assessmentPattern',
          status: 'warn',
          severity: 'warning',
          extractedValue: desc,
          expected: '>= 70% share at dominant Bloom level (Apply)',
          reason: `Application level share in ${desc} falls below the 70% guideline for dominant course outcomes.`,
          guidelineRef: 'Theory guideline, Section 4.2',
          howToFix: 'Ensure at least 70% of assessment weightage is allocated to the dominant Bloom/TPS level.',
          location: assessLoc
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 7. Books Rules
  // -------------------------------------------------------------
  const allBooks = (fields?.allBooks && Array.isArray(fields.allBooks) && fields.allBooks.length > 0)
    ? fields.allBooks
    : [...textBooks, ...refBooks];
  const booksLoc = locations?.textBooks || locations?.referenceBooks || null;

  // 7.1 THEORY-BOOKS-SPLIT: Must separate Text Books and Reference Books
  if (!booksSplit || (textBooks.length === 0 && refBooks.length > 0) || (refBooks.length === 0 && textBooks.length > 0 && allBooks.length > 2)) {
    addFinding({
      ruleId: 'THEORY-BOOKS-SPLIT',
      field: 'books',
      status: isStrict ? 'fail' : 'warn',
      severity: isStrict ? 'error' : 'warning',
      extractedValue: `${allBooks.length} books in single list`,
      expected: '1 to 2 Text Books and 3 to 6 Reference Books in distinct sections',
      reason: isStrict
        ? 'Books are not split into separate Text Books and Reference Books sections.'
        : 'Legacy format: Learning resources listed in a single combined list without Text/Reference separation.',
      guidelineRef: 'Theory guideline, Section 6.1',
      howToFix: 'Separate books into "Text Books" (1-2 books) and "Reference Books" (3-6 books).',
      location: booksLoc
    });
  }

  // 7.2 THEORY-BOOKS-YEAR: All books must have a publication year
  const missingYearBooks = allBooks.filter(b => !b.year || isNaN(Number(b.year)));
  if (missingYearBooks.length === 0 && allBooks.length > 0) {
    const years = allBooks.map(b => b.year).join(', ');
    addFinding({
      ruleId: 'THEORY-BOOKS-YEAR',
      field: 'books',
      status: 'pass',
      severity: 'info',
      extractedValue: `Years: ${years}`,
      expected: 'Valid publication year for every book',
      reason: 'All listed books contain valid publication years.',
      guidelineRef: 'Theory guideline, Section 6.1',
      howToFix: '',
      location: booksLoc
    });
  } else if (missingYearBooks.length > 0) {
    addFinding({
      ruleId: 'THEORY-BOOKS-YEAR',
      field: 'books',
      status: 'fail',
      severity: 'error',
      extractedValue: missingYearBooks.map(b => b.title || b.raw).join('; '),
      expected: 'Valid publication year for every book',
      reason: `Publication year is missing for ${missingYearBooks.length} book(s).`,
      guidelineRef: 'Theory guideline, Section 6.1',
      howToFix: 'Include publication years for all book entries.',
      location: booksLoc
    });
  }

  // 7.3 THEORY-BOOKS-EDITION: Books should specify edition
  const missingEditionBooks = allBooks.filter(b => !b.edition || b.edition.trim() === '');
  if (missingEditionBooks.length > 0) {
    const titles = missingEditionBooks.map(b => b.title || b.authors || 'Book').join('; ');
    addFinding({
      ruleId: 'THEORY-BOOKS-EDITION',
      field: 'books',
      status: 'warn',
      severity: 'warning',
      extractedValue: titles,
      expected: 'Edition specified for every book entry',
      reason: `Book edition is not specified for: ${titles}.`,
      guidelineRef: 'Theory guideline, Section 6.1',
      howToFix: 'Add the specific edition number (e.g. 2nd Edition, 4th Edition) to the book citation.',
      location: booksLoc
    });
  }

  // 7.4 THEORY-BOOKS-RECENCY: For Core course, recency is informational
  if (courseNature === 'Core') {
    addFinding({
      ruleId: 'THEORY-BOOKS-RECENCY',
      field: 'books',
      status: 'pass',
      severity: 'info',
      extractedValue: 'Core Course',
      expected: 'Recent editions recommended (info for core)',
      reason: 'Recency is informational for core foundational courses.',
      guidelineRef: 'Theory guideline, Section 6.2',
      howToFix: '',
      location: booksLoc
    });
  }

  // -------------------------------------------------------------
  // 8. Lecture Schedule Rules
  // -------------------------------------------------------------
  const schedLoc = locations?.lectureSchedule || null;
  const statedTotal = Number(fields?.totalPeriodsStated);
  const calculatedTotal = Number(fields?.totalPeriodsCalculated);
  const requiredPeriods = calculateRequiredPeriods(credits, thresholds.periodsPerCredit || 12);

  const effectiveScheduleTotal = !isNaN(calculatedTotal) && calculatedTotal > 0 ? calculatedTotal : statedTotal;

  if (effectiveScheduleTotal === requiredPeriods) {
    addFinding({
      ruleId: 'THEORY-SCHEDULE-PERIODS',
      field: 'lectureSchedule',
      status: 'pass',
      severity: 'info',
      extractedValue: `${effectiveScheduleTotal} periods`,
      expected: `${requiredPeriods} periods (${credits} × 12)`,
      reason: `Total lecture periods (${effectiveScheduleTotal}) match credit requirement (${credits} × 12 = ${requiredPeriods}).`,
      guidelineRef: 'Theory guideline, Section 7',
      howToFix: '',
      location: schedLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-SCHEDULE-PERIODS',
      field: 'lectureSchedule',
      status: 'fail',
      severity: 'error',
      extractedValue: `${effectiveScheduleTotal} periods`,
      expected: `${requiredPeriods} periods (${credits} × 12)`,
      reason: `Total periods ${effectiveScheduleTotal} but ${requiredPeriods} required (${credits} × 12).`,
      guidelineRef: 'Theory guideline, Section 7',
      howToFix: `Adjust lecture hours across topics so the leaf row sum equals ${requiredPeriods}.`,
      location: schedLoc
    });
  }

  // -------------------------------------------------------------
  // 9. Course Designers Rules
  // -------------------------------------------------------------
  const designerLoc = locations?.courseDesigners || null;
  const primaryDesigner = designers[0] || {};
  const designerEmail = primaryDesigner.email || '';

  // 9.1 THEORY-DESIGNER-EMAIL: Domain must be @tce.edu
  if (designerEmail && designerEmail.toLowerCase().endsWith('@tce.edu')) {
    addFinding({
      ruleId: 'THEORY-DESIGNER-EMAIL',
      field: 'courseDesigners',
      status: 'pass',
      severity: 'info',
      extractedValue: designerEmail,
      expected: 'Official @tce.edu email address',
      reason: `Course designer email (${designerEmail}) has valid @tce.edu domain.`,
      guidelineRef: 'Theory guideline, Section 8',
      howToFix: '',
      location: designerLoc
    });
  } else {
    addFinding({
      ruleId: 'THEORY-DESIGNER-EMAIL',
      field: 'courseDesigners',
      status: 'fail',
      severity: 'error',
      extractedValue: designerEmail || 'Missing email',
      expected: 'Official @tce.edu email address',
      reason: 'Course designer email must end with @tce.edu.',
      guidelineRef: 'Theory guideline, Section 8',
      howToFix: 'Provide a valid faculty @tce.edu email address for the course designer.',
      location: designerLoc
    });
  }

  // 9.2 THEORY-DESIGNER-DEPT: Check designation and department
  if (!primaryDesigner.designation || !primaryDesigner.department) {
    addFinding({
      ruleId: 'THEORY-DESIGNER-DEPT',
      field: 'courseDesigners',
      status: 'warn',
      severity: 'warning',
      extractedValue: primaryDesigner.name || 'Designer',
      expected: 'Faculty Name, Designation, and Department',
      reason: 'Course designer designation and department are missing.',
      guidelineRef: 'Theory guideline, Section 8',
      howToFix: 'Include academic designation (e.g. Associate Professor) and Department.',
      location: designerLoc
    });
  }

  // -------------------------------------------------------------
  // 10. Informational: Obsolete legacy sections
  // -------------------------------------------------------------
  if (fields?.coPoMap || fields?.conceptMapPresent || fields?.assessmentQuestionsCount > 0) {
    addFinding({
      ruleId: 'LEGACY-OBSOLETE-SECTIONS',
      field: 'legacySections',
      status: 'pass',
      severity: 'info',
      extractedValue: 'Legacy curriculum sections detected',
      expected: 'Regulation 2026 template sections',
      reason: 'CO to PO mapping, Concept Map and Course Level Assessment Questions detected, not part of the 2026 template.',
      guidelineRef: 'Regulation 2026 Transition Note',
      howToFix: 'These legacy sections may be omitted in the 2026 template.',
      location: null
    });
  }

  return findings;
}
