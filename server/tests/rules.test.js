import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Submission } from '../src/models/Submission.js';
import { Version } from '../src/models/Version.js';
import { RulesConfig } from '../src/models/RulesConfig.js';
import { seedRulesConfig, getActiveRulesConfig } from '../src/services/configSeedService.js';
import { validateSyllabus } from '../src/rules/index.js';

let app;

beforeAll(async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tce_syllabus_db';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
  await seedRulesConfig();
  app = createApp();
});

describe('Phase 5: Deterministic Rule Engine Unit Tests', () => {
  it('loads active rules config with defaults', async () => {
    const config = await getActiveRulesConfig();
    expect(config).toBeDefined();
    expect(config.currentRegulation).toBe('26');
    expect(config.thresholds.coCountTheoryMin).toBe(6);
    expect(config.thresholds.coCountTheoryMax).toBe(8);
  });

  describe('Theory Rules Unit Tests', () => {
    it('THEORY-CODE-*: passes for valid 26CSCA0 matching CS faculty', async () => {
      const fields = {
        courseCode: '26CSCA0',
        courseName: 'Data Structures and Algorithms',
        L: 3, T: 1, P: 0, credits: 4,
        preamble: { text: 'Valid engineering preamble '.repeat(15), wordCount: 75, lineCount: 3 },
        courseOutcomes: [
          { id: 'CO1', statement: 'Explain linear structures', firstVerb: 'explain', tpsLevel: 2, pi: '1.4.1', coWeightage: 15, sdg: 9 },
          { id: 'CO2', statement: 'Demonstrate stack operations', firstVerb: 'demonstrate', tpsLevel: 3, pi: '1.4.2', coWeightage: 15, sdg: 9 },
          { id: 'CO3', statement: 'Solve tree balancing problems', firstVerb: 'solve', tpsLevel: 3, pi: '2.1.1', coWeightage: 20, sdg: 9 },
          { id: 'CO4', statement: 'Analyze graph traversal algorithms', firstVerb: 'analyze', tpsLevel: 4, pi: '2.2.1', coWeightage: 20, sdg: 9 },
          { id: 'CO5', statement: 'Evaluate hashing collisions', firstVerb: 'evaluate', tpsLevel: 5, pi: '3.1.1', coWeightage: 15, sdg: 9 },
          { id: 'CO6', statement: 'Apply greedy paradigms', firstVerb: 'apply', tpsLevel: 3, pi: '3.2.1', coWeightage: 15, sdg: 9 }
        ],
        assessmentPatternType: 'CO_WISE',
        booksSplit: true,
        textBooks: [{ title: 'Algorithms', year: 2022, edition: '4th Edition' }],
        referenceBooks: [{ title: 'Data Structures', year: 2020, edition: '2nd Edition' }],
        totalPeriodsStated: 48,
        courseDesigners: [{ name: 'Dr. Faculty', designation: 'Professor', department: 'CS', email: 'faculty@tce.edu' }]
      };

      const result = await validateSyllabus(fields, {
        userDept: 'CS',
        profile: 'REG2026_STRICT',
        courseType: 'Theory'
      });

      const deptRule = result.findings.find(f => f.ruleId === 'THEORY-CODE-DEPT');
      expect(deptRule.status).toBe('pass');

      const regRule = result.findings.find(f => f.ruleId === 'THEORY-CODE-REG');
      expect(regRule.status).toBe('pass');

      const uvRule = result.findings.find(f => f.ruleId === 'THEORY-CODE-UV');
      expect(uvRule.status).toBe('pass');
    });

    it('THEORY-NAME-*: catches special characters, excessive length, and ALL CAPS', async () => {
      const fields = {
        courseCode: '26CSCA0',
        courseName: 'ADVANCED DATA STRUCTURES & ALGORITHMS (SPECIAL EDITION) WHICH IS EXTREMELY LONG AND EXCEEDS SIXTY CHARACTERS',
        L: 3, T: 0, P: 0, credits: 3
      };

      const result = await validateSyllabus(fields, { userDept: 'CS' });

      const charRule = result.findings.find(f => f.ruleId === 'THEORY-NAME-CHARS');
      expect(charRule.status).toBe('fail'); // & and ()

      const lenRule = result.findings.find(f => f.ruleId === 'THEORY-NAME-LEN');
      expect(lenRule.status).toBe('fail');

      const caseRule = result.findings.find(f => f.ruleId === 'THEORY-NAME-CASE');
      expect(caseRule.status).toBe('warn');
    });

    it('THEORY-CREDITS-MATH: flags arithmetic mismatch (e.g. 2-1-0 with 4 credits)', async () => {
      const fields = {
        courseCode: '26CSCA0',
        courseName: 'Operating Systems',
        L: 2, T: 1, P: 0, credits: 4 // Expected 3
      };

      const result = await validateSyllabus(fields, { userDept: 'CS' });
      const credRule = result.findings.find(f => f.ruleId === 'THEORY-CREDITS-MATH');
      expect(credRule.status).toBe('fail');
      expect(credRule.reason).toContain('credits should be 3');
    });

    it('THEORY-CO-*: flags insufficient CO count (<6) and forbidden TPS 1', async () => {
      const fields = {
        courseCode: '26CSCA0',
        courseName: 'Cloud Computing',
        L: 3, T: 0, P: 0, credits: 3,
        courseOutcomes: [
          { id: 'CO1', statement: 'Recall virtualization types', firstVerb: 'recall', tpsLevel: 1, pi: '1.1.1' },
          { id: 'CO2', statement: 'Explain containerization', firstVerb: 'explain', tpsLevel: 2, pi: '1.2.1' }
        ]
      };

      const result = await validateSyllabus(fields, { userDept: 'CS' });
      const countRule = result.findings.find(f => f.ruleId === 'THEORY-CO-COUNT');
      expect(countRule.status).toBe('fail');
    });
  });

  describe('Laboratory Rules Unit Tests', () => {
    it('LAB-CREDITS-P: validates L=0, T=0, credits = P/2', async () => {
      const validLab = {
        courseCode: '26CSLA0',
        courseName: 'Data Structures Laboratory',
        L: 0, T: 0, P: 3, credits: 1.5,
        courseOutcomes: new Array(6).fill({ id: 'CO1', statement: 'Implement list', tpsLevel: 3 }),
        experiments: new Array(11).fill({ slNo: 1, name: 'Exp', level: 2, cos: ['CO1'] })
      };

      const result = await validateSyllabus(validLab, { courseType: 'Practical' });
      const credRule = result.findings.find(f => f.ruleId === 'LAB-CREDITS-P');
      expect(credRule.status).toBe('pass');

      const expRule = result.findings.find(f => f.ruleId === 'LAB-EXP-COUNT');
      expect(expRule.status).toBe('pass');
    });
  });

  describe('Theory cum Practical (TCP) Rules Unit Tests', () => {
    it('TCP-CREDITS-MATH: requires both L>0 and P>0 with L+T+P/2', async () => {
      const validTcp = {
        courseCode: '26CSTA0',
        courseName: 'Web Technology',
        L: 2, T: 0, P: 2, credits: 3, // 2 + 0 + 2/2 = 3
        totalPeriodsStated: 48, // (2 + 2) * 12 = 48
        experiments: [{ slNo: 1, name: 'DOM manipulation', level: 2, cos: ['CO1'] }]
      };

      const result = await validateSyllabus(validTcp, { courseType: 'Theory cum Practical' });
      const tcpMath = result.findings.find(f => f.ruleId === 'TCP-CREDITS-MATH');
      expect(tcpMath.status).toBe('pass');

      const tcpPeriods = result.findings.find(f => f.ruleId === 'TCP-PERIODS-TOTAL');
      expect(tcpPeriods.status).toBe('pass');
    });
  });

  describe('POST /api/submissions/:id/versions/:v/validate endpoint', () => {
    it('executes validation and updates version report in database', async () => {
      // Create user
      const user = await User.create({
        googleId: 'google-test-val-' + Date.now(),
        email: `staff.val${Date.now()}@tce.edu`,
        name: 'Validation Tester',
        department: 'CS',
        role: 'staff'
      });

      // Login dev
      const loginRes = await request(app)
        .post('/api/auth/dev-login')
        .send({ email: user.email, name: user.name, department: 'CS' });
      const cookie = loginRes.headers['set-cookie'];

      // Create dummy submission & version
      const sub = await Submission.create({
        owner: user._id,
        sourceFilename: 'test.pdf',
        storagePath: 'dummy.pdf',
        fileSize: 1000,
        fileHash: 'dummyhash',
        totalPages: 2,
        courses: [{
          courseCode: '26CSCA0',
          courseName: 'Sample Course',
          courseType: 'Theory',
          courseNature: 'Core',
          formatProfile: 'REG2026_STRICT',
          currentVersionNo: 1,
          versions: []
        }]
      });

      const ver = await Version.create({
        submissionId: sub._id,
        courseCode: '26CSCA0',
        versionNo: 1,
        originalFilename: 'test.pdf',
        pdfPath: 'dummy.pdf',
        extractedFields: {
          courseCode: '26CSCA0',
          courseName: 'Sample Course',
          L: 3, T: 0, P: 0, credits: 3
        }
      });

      sub.courses[0].versions.push(ver._id);
      await sub.save();

      // Call validate endpoint
      const res = await request(app)
        .post(`/api/submissions/${sub._id}/versions/1/validate`)
        .set('Cookie', cookie)
        .send({ profile: 'REG2026_STRICT' });

      expect(res.status).toBe(200);
      expect(res.body.report).toBeDefined();
      expect(res.body.report.summary.status).toBeDefined();
      expect(Array.isArray(res.body.report.findings)).toBe(true);

      // Verify persisted version
      const updatedVer = await Version.findById(ver._id);
      expect(updatedVer.report.summary.status).toBeDefined();
    });
  });
});
