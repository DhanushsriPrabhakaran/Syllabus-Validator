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

describe('Phase 3: PDF Text Extraction, Coordinate Tracking, and Section Splitting', () => {
  let app;
  let authCookie;
  let sampleBuffer;

  beforeAll(async () => {
    app = createApp();
    await connectDB();
    sampleBuffer = fs.readFileSync(SAMPLE_PDF_PATH);
  });

  beforeEach(async () => {
    // Ensure active user session exists for each integration test
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

  describe('Unit: Pure Extractor on MCA-syllabus-2022-24-29.pdf', () => {
    it('correctly reads all 6 pages with bounding box coordinates', async () => {
      const result = await extractSyllabusDocument(sampleBuffer);

      expect(result.totalPages).toBe(6);
      expect(result.courses).toBeDefined();
      expect(result.courses.length).toBeGreaterThanOrEqual(1);

      // Verify page 1 coordinates
      const page1 = result.pages[0];
      expect(page1.pageNumber).toBe(1);
      expect(page1.width).toBeGreaterThan(500);
      expect(page1.height).toBeGreaterThan(700);

      const firstLine = page1.filteredLines[0];
      expect(firstLine).toBeDefined();
      expect(Array.isArray(firstLine.bbox)).toBe(true);
      expect(firstLine.bbox.length).toBe(4); // [x, y, w, h]
    });

    it('identifies and strips repeating header and footer lines', async () => {
      const result = await extractSyllabusDocument(sampleBuffer);

      // Verify that pages have strippedHeaders / strippedFooters identified
      const page2 = result.pages[1];
      const hasStrippedHeader = page2.strippedHeaders.some(h => h.text.includes('Degree Programme'));
      const hasStrippedFooter = page2.strippedFooters.some(f => f.text.includes('BOS meeting approved') || f.text.includes('Academic Council'));

      expect(hasStrippedHeader).toBe(true);
      expect(hasStrippedFooter).toBe(true);
    });

    it('segments course 22CA120 and parses course title and credits row', async () => {
      const result = await extractSyllabusDocument(sampleBuffer);
      const course = result.courses[0];

      expect(course.courseCode).toBe('22CA120');
      expect(course.courseName).toContain('DATA STRUCTURES AND APPLICATIONS');
      expect(course.category).toBe('PC');
      expect(course.L).toBe(3);
      expect(course.T).toBe(1);
      expect(course.P).toBe(0);
      expect(course.credits).toBe(4);
      expect(course.formatEra).toBe('2022_LEGACY');

      // Verify code and name bounding box locations
      expect(course.codeLocation.page).toBe(1);
      expect(course.codeLocation.bbox.length).toBe(4);
      expect(course.nameLocation.page).toBe(1);
    });

    it('splits lines into all required section anchors', async () => {
      const result = await extractSyllabusDocument(sampleBuffer);
      const course = result.courses[0];
      const sections = course.sectionBuckets;

      // Preamble
      expect(sections.preamble.length).toBeGreaterThan(0);
      const preambleText = sections.preamble.map(l => l.text).join(' ');
      expect(preambleText).toContain('This course will cover various data structures');

      // Prerequisite
      expect(sections.prerequisite.length).toBeGreaterThan(0);
      expect(sections.prerequisite.map(l => l.text).join(' ')).toContain('Nil');

      // Course Outcomes
      expect(sections.courseOutcomes.length).toBeGreaterThan(0);
      const coText = sections.courseOutcomes.map(l => l.text).join(' ');
      expect(coText).toContain('CO1');
      expect(coText).toContain('CO6');

      // Legacy CO-PO Map
      expect(sections.coPoMapping.length).toBeGreaterThan(0);

      // Assessment Pattern
      expect(sections.assessmentPattern.length).toBeGreaterThan(0);
      const assessText = sections.assessmentPattern.map(l => l.text).join(' ');
      expect(assessText).toContain('Remember');
      expect(assessText).toContain('Understand');
      expect(assessText).toContain('Apply');

      // Syllabus
      expect(sections.syllabus.length).toBeGreaterThan(0);

      // Learning Resources (Books)
      expect(sections.learningResources.length).toBeGreaterThan(0);
      const booksText = sections.learningResources.map(l => l.text).join(' ');
      expect(booksText).toContain('MarkAllenWeiss');
      expect(booksText).toContain('Adam Drozdek');

      // Course Contents and Lecture Schedule
      expect(sections.lectureSchedule.length).toBeGreaterThan(0);
      const schedText = sections.lectureSchedule.map(l => l.text).join(' ');
      expect(schedText).toContain('Introduction to Abstract Data Types');
      expect(schedText).toContain('Total No of Hours');

      // Course Designers
      expect(sections.courseDesigners.length).toBeGreaterThan(0);
      const designersText = sections.courseDesigners.map(l => l.text).join(' ');
      expect(designersText).toContain('P.Sharmila');
      expect(designersText).toContain('psaca@tce.edu');
    });
  });

  describe('Integration: POST /api/submissions Endpoint', () => {
    it('uploads sample PDF, segments courses, and creates Version 1 in DB', async () => {
      const res = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookie)
        .attach('file', SAMPLE_PDF_PATH)
        .field('courseNature', 'Core')
        .field('formatProfile', 'REG2026_STRICT');

      expect(res.status).toBe(201);
      expect(res.body.submission).toBeDefined();
      expect(res.body.submission.courses.length).toBe(1);

      const course = res.body.submission.courses[0];
      expect(course.courseCode).toBe('22CA120');
      expect(course.courseName).toContain('DATA STRUCTURES AND APPLICATIONS');
      expect(course.formatEra).toBe('2022_LEGACY');

      // Verify records in MongoDB
      const subInDb = await Submission.findById(res.body.submission.id);
      expect(subInDb).not.toBeNull();
      expect(subInDb.totalPages).toBe(6);

      const versionInDb = await Version.findById(course.versions[0]);
      expect(versionInDb).not.toBeNull();
      expect(versionInDb.versionNo).toBe(1);
      expect(versionInDb.extractedFields.courseCode).toBe('22CA120');
      expect(versionInDb.locations.courseCode).toBeDefined();
    });

    it('rejects uploads without PDF magic number', async () => {
      const fakePdfBuffer = Buffer.from('NOT_A_REAL_PDF_FILE');
      const res = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookie)
        .attach('file', fakePdfBuffer, 'fake.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('missing %PDF- header');
    });

    it('GET /api/submissions lists user submissions', async () => {
      const res = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.submissions)).toBe(true);
      expect(res.body.submissions.length).toBeGreaterThan(0);
      expect(res.body.submissions[0].courses[0].courseCode).toBe('22CA120');
    });
  });
});
