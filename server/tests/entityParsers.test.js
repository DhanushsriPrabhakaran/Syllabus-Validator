import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { extractSyllabusDocument } from '../src/extractor/index.js';
import { User } from '../src/models/User.js';
import { Submission } from '../src/models/Submission.js';
import { Version } from '../src/models/Version.js';

const SAMPLE_PDF_PATH = path.resolve('..', 'fixtures', 'legacy', 'MCA-syllabus-2022-24-29.pdf');

describe('Phase 4: Table Parsers and Per-Type Field Extraction', () => {
  let app;
  let authCookie;
  let sampleBuffer;
  let extractedResult;

  beforeAll(async () => {
    app = createApp();
    await connectDB();
    sampleBuffer = fs.readFileSync(SAMPLE_PDF_PATH);
    extractedResult = await extractSyllabusDocument(sampleBuffer);
  });

  beforeEach(async () => {
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({
        email: 'psaca@tce.edu',
        name: 'Dr. P. Sharmila',
        department: 'CA',
        role: 'staff'
      });
    authCookie = loginRes.headers['set-cookie'];
  });

  afterAll(async () => {
    await Submission.deleteMany({});
    await Version.deleteMany({});
    await User.deleteMany({});
    await disconnectDB();
  });

  describe('Specialized Entity Parsers against 22CA120', () => {
    it('extracts all 6 Course Outcomes with Bloom labels and action verbs', () => {
      const course = extractedResult.courses[0];
      const cos = course.extractedFields.courseOutcomes;

      expect(cos.length).toBe(6);
      expect(cos.map(c => c.id)).toEqual(['CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6']);

      // All 6 COs have Bloom label "Apply"
      cos.forEach(co => {
        expect(co.bloomLabel).toBe('Apply');
        expect(co.tpsLevel).toBeNull(); // Missing in legacy, not invented
      });

      // Verify extracted first action verbs
      const verbs = cos.map(c => c.firstVerb);
      expect(verbs).toContain('Apply');
      expect(verbs).toContain('Illustrate');
      expect(verbs).toContain('Choose');
      expect(verbs).toContain('Manipulate');
      expect(verbs).toContain('Demonstrate');
      expect(verbs).toContain('Show');
    });

    it('parses Bloom-wise assessment pattern with correct column totals (100, 100, 100, 100)', () => {
      const course = extractedResult.courses[0];
      const assess = course.extractedFields.assessmentPattern;

      expect(assess.type).toBe('BLOOM_WISE');
      expect(assess.rows.length).toBe(6);

      const applyRow = assess.rows.find(r => r.level === 'Apply');
      expect(applyRow).toBeDefined();
      expect(applyRow.cat1).toBe(60);
      expect(applyRow.cat2).toBe(60);
      expect(applyRow.cat3).toBe(80);
      expect(applyRow.terminal).toBe(80);

      // Verify column sums
      expect(assess.columnSums.CAT1).toBe(100);
      expect(assess.columnSums.CAT2).toBe(100);
      expect(assess.columnSums.CAT3).toBe(100);
      expect(assess.columnSums.Terminal).toBe(100);
    });

    it('extracts all 3 books, detects un-split list, publication years, and Weiss missing edition', () => {
      const course = extractedResult.courses[0];
      const fields = course.extractedFields;

      expect(fields.booksSplit).toBe(false);
      expect(fields.allBooks.length).toBe(3);

      const [b1, b2, b3] = fields.allBooks;

      // Book 1: Weiss
      expect(b1.authors).toContain('MarkAllenWeiss');
      expect(b1.year).toBe(2007);
      expect(b1.edition).toBeNull(); // Weiss entry has no edition

      // Book 2: Drozdek
      expect(b2.authors).toContain('Adam Drozdek');
      expect(b2.year).toBe(2012);
      expect(b2.edition).toContain('4th Edition');

      // Book 3: Langsam
      expect(b3.authors).toContain('Langsam');
      expect(b3.year).toBe(2015);
      expect(b3.edition).toContain('2nd Edition');
    });

    it('calculates lecture schedule leaf hours (45) and matches stated total (45)', () => {
      const course = extractedResult.courses[0];
      const fields = course.extractedFields;

      expect(fields.leafHoursSum).toBe(45);
      expect(fields.totalPeriodsStated).toBe(45);
      expect(fields.lectureSchedule.length).toBeGreaterThan(15);
    });

    it('parses course designer with valid email domain', () => {
      const course = extractedResult.courses[0];
      const designers = course.extractedFields.courseDesigners;

      expect(designers.length).toBe(1);
      expect(designers[0].name).toContain('P.Sharmila');
      expect(designers[0].email).toBe('psaca@tce.edu');
      expect(designers[0].designation).toBe(''); // Missing in sample
    });
  });

  describe('Version & Review APIs', () => {
    let submissionId;

    beforeEach(async () => {
      const uploadRes = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookie)
        .attach('file', SAMPLE_PDF_PATH);

      submissionId = uploadRes.body.submission.id;
    });

    it('GET /api/submissions/:id/versions/1 returns full extracted fields and coordinates', async () => {
      const res = await request(app)
        .get(`/api/submissions/${submissionId}/versions/1`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body.version).toBeDefined();
      expect(res.body.version.extractedFields.courseCode).toBe('22CA120');
      expect(res.body.version.extractedFields.courseOutcomes.length).toBe(6);
      expect(res.body.version.extractionConfidence.overall).toBeGreaterThan(0.9);
      expect(res.body.version.locations.courseCode).toBeDefined();
    });

    it('PUT /api/submissions/:id/versions/1/fields saves faculty corrections', async () => {
      const corrections = {
        courseName: 'Data Structures and Applications', // Faculty corrected Title Case
        preamble: { text: 'Updated comprehensive preamble for data structures...', wordCount: 75 }
      };

      const res = await request(app)
        .put(`/api/submissions/${submissionId}/versions/1/fields`)
        .set('Cookie', authCookie)
        .send({ editedFields: corrections });

      expect(res.status).toBe(200);
      expect(res.body.version.editedFields.courseName).toBe('Data Structures and Applications');

      // Verify in DB
      const v = await Version.findById(res.body.version._id);
      expect(v.editedFields.courseName).toBe('Data Structures and Applications');
    });
  });
});
