import { getActiveRulesConfig } from '../services/configSeedService.js';
import { validateTheoryRules } from './groups/theoryRules.js';
import { validateLabRules } from './groups/labRules.js';
import { validateTcpRules } from './groups/tcpRules.js';
import { validateLegacyRules } from './groups/legacyRules.js';

/**
 * Deterministic Syllabus Validation Engine
 *
 * Evaluates extracted/edited fields against data-driven RulesConfig.
 * Returns structured findings and high-level audit summary.
 */
export async function validateSyllabus(fields, options = {}) {
  // Load data-driven rules configuration if not provided
  const config = options.config || await getActiveRulesConfig();

  const context = {
    config,
    userDept: options.userDept || null,
    uploaderEmail: options.uploaderEmail || null,
    profile: options.profile || 'REG2026_STRICT',
    courseType: options.courseType || 'Theory',
    courseNature: options.courseNature || 'Core',
    isCommonCourse: Boolean(options.isCommonCourse),
    locations: options.locations || fields?.locations || {}
  };

  const findings = [];

  // 1. Run type-specific rule sets
  const type = (context.courseType || 'Theory').toLowerCase();

  if (type.includes('practical') && !type.includes('theory')) {
    // Pure Laboratory / Practical course
    const labFindings = validateLabRules(fields, context);
    findings.push(...labFindings);
  } else if (type.includes('cum') || (type.includes('theory') && type.includes('practical'))) {
    // Theory cum Practical (TCP) course
    const theoryFindings = validateTheoryRules(fields, context);
    const tcpFindings = validateTcpRules(fields, context);
    findings.push(...theoryFindings, ...tcpFindings);
  } else {
    // Pure Theory course (default)
    const theoryFindings = validateTheoryRules(fields, context);
    findings.push(...theoryFindings);
  }

  // 2. Run legacy format checks & modernization hints
  const legacyFindings = validateLegacyRules(fields, context);
  findings.push(...legacyFindings);

  // 3. Compute executive summary statistics
  let errorCount = 0;
  let warningCount = 0;
  let notVerifiableCount = 0;
  let passCount = 0;

  for (const f of findings) {
    if (f.status === 'fail' || f.severity === 'error') {
      errorCount++;
    } else if (f.status === 'warn' || f.severity === 'warning') {
      warningCount++;
    } else if (f.status === 'not_verifiable') {
      notVerifiableCount++;
    } else if (f.status === 'pass') {
      passCount++;
    }
  }

  let status = 'Compliant';
  if (errorCount > 0) {
    status = 'Has Errors';
  } else if (warningCount > 0) {
    status = 'Warnings only';
  }

  return {
    summary: {
      status,
      errorCount,
      warningCount,
      notVerifiableCount,
      passCount
    },
    findings,
    rulesConfigVersion: config?.version || 1
  };
}
