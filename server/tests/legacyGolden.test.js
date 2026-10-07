import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { seedRulesConfig } from '../src/services/configSeedService.js';
import { extractSyllabusDocument } from '../src/extractor/index.js';
import { validateSyllabus } from '../src/rules/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_PATH = path.resolve(__dirname, '../../fixtures/legacy/MCA-syllabus-2022-24-29.pdf');
const GOLDEN_JSON_PATH = path.resolve(__dirname, '../../fixtures/legacy/MCA-syllabus-2022-golden.json');

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tce_syllabus_db';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
  await seedRulesConfig();
});

describe('Golden Acceptance Test: MCA-syllabus-2022-24-29.pdf (Section 6.8)', () => {
  let extractionResult;
  let validationResult;
  let goldenSpec;

  beforeAll(async () => {
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    goldenSpec = JSON.parse(fs.readFileSync(GOLDEN_JSON_PATH, 'utf-8'));

    // Step 1: Run full PDF coordinate and entity extraction
    extractionResult = await extractSyllabusDocument(pdfBuffer);
    expect(extractionResult.courses.length).toBeGreaterThan(0);

    const caCourse = extractionResult.courses.find(c => c.courseCode.includes('22CA120')) || extractionResult.courses[0];
    expect(caCourse).toBeDefined();

    // Step 2: Validate under Strict Profile for a CA Department faculty user
    validationResult = await validateSyllabus(caCourse.extractedFields, {
      profile: 'REG2026_STRICT',
      userDept: 'CA',
      courseType: 'Theory',
      courseNature: 'Core',
      locations: caCourse.locations
    });
  });

  it('contains all golden findings with expected pass/fail/warn statuses', () => {
    const findings = validationResult.findings;

    for (const expected of goldenSpec.expectedFindings) {
      const match = findings.find(f => f.ruleId === expected.ruleId);
      expect(match, `Expected rule ${expected.ruleId} to be evaluated`).toBeDefined();
      expect(
        match.status,
        `Rule ${expected.ruleId} expected status '${expected.status}' but got '${match.status}' (Reason: ${match.reason})`
      ).toBe(expected.status);
    }
  });

  it('specifically validates Section 6.8 acceptance assertions', () => {
    const findings = validationResult.findings;
    const findRule = (id) => findings.find(f => f.ruleId === id);

    // 1. Course Code
    expect(findRule('THEORY-CODE-DEPT').status).toBe('pass'); // AA=CA matches dept CA
    expect(findRule('THEORY-CODE-REG').status).toBe('fail');   // RR=22 != 26
    expect(findRule('THEORY-CODE-UV').status).toBe('fail');    // 120 != C U V

    // 2. Course Name
    expect(findRule('THEORY-NAME-CASE').status).toBe('warn');  // ALL CAPS
    expect(findRule('THEORY-NAME-LEN').status).toBe('pass');   // Length 32 <= 60
    expect(findRule('THEORY-NAME-CHARS').status).toBe('pass'); // No disallowed special chars

    // 3. Credits & L-T-P
    expect(findRule('THEORY-CREDITS-MATH').status).toBe('pass'); // 3 + 1 + 0 = 4

    // 4. Preamble
    expect(findRule('THEORY-PREAMBLE-WORDS').status).toBe('warn');   // ~42 words < 60
    expect(findRule('THEORY-PREAMBLE-GENERIC').status).toBe('warn'); // Generic opener detected
    expect(findRule('THEORY-PREAMBLE-LINES').status).toBe('pass');   // 3 lines

    // 5. Course Outcomes
    expect(findRule('THEORY-CO-COUNT').status).toBe('pass');            // 6 COs
    expect(findRule('THEORY-CO-FORMAT-TPS').status).toBe('fail');        // Missing TPS column
    expect(findRule('THEORY-CO-FORMAT-PI').status).toBe('fail');         // Missing PI column
    expect(findRule('THEORY-CO-FORMAT-WEIGHTAGE').status).toBe('fail');  // Missing Weightage column
    expect(findRule('THEORY-CO-FORMAT-SDG').status).toBe('fail');        // Missing SDG column
    expect(findRule('THEORY-CO-TPS-RATIO').status).toBe('pass');         // 100% at TPS 3 or above (Apply)
    expect(findRule('THEORY-CO-VERB-MATCH').status).toBe('warn');        // Unlisted verbs (Manipulate, Illustrate, etc.)

    // 6. Assessment Pattern
    expect(findRule('THEORY-ASSESS-LAYOUT').status).toBe('fail');     // Bloom-wise instead of CO-wise
    expect(findRule('THEORY-ASSESS-COLS-SUM').status).toBe('pass');   // CAT1, CAT2, CAT3, Terminal = 100
    expect(findRule('THEORY-ASSESS-BLOOM-70').status).toBe('warn');   // CAT1 & CAT2 = 60% < 70%

    // 7. Books
    expect(findRule('THEORY-BOOKS-SPLIT').status).toBe('fail');   // 3 books in one list
    expect(findRule('THEORY-BOOKS-YEAR').status).toBe('pass');    // Years 2007, 2012, 2015 present
    expect(findRule('THEORY-BOOKS-EDITION').status).toBe('warn'); // Weiss entry missing edition
    expect(findRule('THEORY-BOOKS-RECENCY').status).toBe('pass'); // Info for core course

    // 8. Lecture Schedule
    expect(findRule('THEORY-SCHEDULE-PERIODS').status).toBe('fail'); // Stated 45 vs Required 48 (4*12)

    // 9. Course Designers
    expect(findRule('THEORY-DESIGNER-EMAIL').status).toBe('pass'); // psaca@tce.edu
    expect(findRule('THEORY-DESIGNER-DEPT').status).toBe('warn');  // Missing designation & dept

    // 10. Informational legacy sections
    expect(findRule('LEGACY-OBSOLETE-SECTIONS').status).toBe('pass');
  });

  it('does NOT report extraction layer artifacts as faculty errors', () => {
    const errorReasons = validationResult.findings
      .filter(f => f.severity === 'error')
      .map(f => f.reason)
      .join(' ');

    for (const disallowed of goldenSpec.disallowedStringsInReasons) {
      expect(errorReasons).not.toContain(disallowed);
    }
  });

  it('downgrades format gaps to warnings under LEGACY_COMPAT profile', async () => {
    const caCourse = extractionResult.courses.find(c => c.courseCode.includes('22CA120')) || extractionResult.courses[0];
    const legacyResult = await validateSyllabus(caCourse.extractedFields, {
      profile: 'LEGACY_COMPAT',
      userDept: 'CA',
      courseType: 'Theory',
      courseNature: 'Core',
      locations: caCourse.locations
    });

    const findLegacyRule = (id) => legacyResult.findings.find(f => f.ruleId === id);

    // Gaps downgraded to warning in LEGACY_COMPAT
    expect(findLegacyRule('THEORY-CODE-REG').status).toBe('warn');
    expect(findLegacyRule('THEORY-CODE-UV').status).toBe('warn');
    expect(findLegacyRule('THEORY-CO-FORMAT-TPS').status).toBe('warn');
    expect(findLegacyRule('THEORY-CO-FORMAT-PI').status).toBe('warn');
    expect(findLegacyRule('THEORY-ASSESS-LAYOUT').status).toBe('warn');
    expect(findLegacyRule('THEORY-BOOKS-SPLIT').status).toBe('warn');
  });
});
