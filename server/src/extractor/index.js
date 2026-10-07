import { extractPdfPagesWithCoordinates } from './pdfTextExtractor.js';
import { filterHeadersAndFooters } from './headerFooterFilter.js';
import { segmentCourses } from './courseSegmenter.js';
import { classifySections } from './sectionClassifier.js';
import { parseCourseOutcomes } from './parsers/coParser.js';
import { parseAssessmentPattern } from './parsers/assessmentParser.js';
import { parseSyllabusModules } from './parsers/syllabusModuleParser.js';
import { parseBooks } from './parsers/booksParser.js';
import { parseLectureSchedule } from './parsers/scheduleParser.js';
import { parseCourseDesigners } from './parsers/designerParser.js';
import { sanitizeText } from './textSanitizer.js';
import pino from 'pino';

const logger = pino({ name: 'extractor' });

/**
 * Main extractor pipeline:
 * Extracts coordinates, strips headers/footers, segments courses,
 * and executes per-section entity parsers.
 */
export async function extractSyllabusDocument(pdfBuffer) {
  logger.info('Starting full PDF extraction and entity parsing pipeline');

  // 1. Coordinate extraction
  const { totalPages, pages } = await extractPdfPagesWithCoordinates(pdfBuffer);

  // 2. Filter recurring headers & footers
  const processedPages = filterHeadersAndFooters(pages);

  // 3. Segment into courses
  const rawSegments = segmentCourses(processedPages);

  // 4. Parse sections and structured entities per course
  const courses = rawSegments.map(segment => {
    const { sectionBuckets, sectionLocations } = classifySections(segment.lines);

    // Preamble parsing
    const preambleLines = sectionBuckets.preamble || [];
    const preambleText = preambleLines.map(l => sanitizeText(l.text)).join(' ').replace(/\s+/g, ' ').trim();
    const preambleWordCount = preambleText ? preambleText.split(/\s+/).filter(Boolean).length : 0;
    const preambleLineCount = preambleLines.length;

    // Prerequisites parsing
    const prereqLines = sectionBuckets.prerequisite || [];
    const prerequisites = prereqLines
      .map(l => sanitizeText(l.text).replace(/^Nil\b/i, '').trim())
      .filter(Boolean);

    // Course Outcomes
    const courseOutcomes = parseCourseOutcomes(sectionBuckets.courseOutcomes || []);

    // Assessment Pattern
    const assessmentPattern = parseAssessmentPattern(sectionBuckets.assessmentPattern || []);

    // Syllabus Modules
    const modules = parseSyllabusModules(sectionBuckets.syllabus || []);

    // Learning Resources (Books)
    const books = parseBooks(sectionBuckets.learningResources || []);

    // Lecture Schedule
    const lectureSchedule = parseLectureSchedule(sectionBuckets.lectureSchedule || []);

    // Course Designers
    const courseDesigners = parseCourseDesigners(sectionBuckets.courseDesigners || []);

    // Informational sections
    const conceptMapPresent = (sectionBuckets.conceptMap || []).length > 0;
    const assessmentQuestionsCount = (sectionBuckets.assessmentQuestions || [])
      .map(l => l.text)
      .join(' ')
      .match(/\b\d+\.\s+[A-Z]/g)?.length || 0;

    const extractedFields = {
      courseCode: segment.courseCode,
      courseName: segment.courseName,
      category: segment.category,
      L: segment.L,
      T: segment.T,
      P: segment.P,
      credits: segment.credits,
      courseType: segment.courseType,
      formatEra: segment.formatEra,
      preamble: {
        text: preambleText,
        wordCount: preambleWordCount,
        lineCount: preambleLineCount
      },
      prerequisites,
      courseOutcomes,
      assessmentPattern,
      assessmentPatternType: assessmentPattern.type,
      assessmentPatternByBloom: assessmentPattern.byBloom,
      modules,
      textBooks: books.textBooks,
      referenceBooks: books.referenceBooks,
      allBooks: books.allBooks,
      booksSplit: books.booksSplit,
      lectureSchedule: lectureSchedule.rows,
      leafHoursSum: lectureSchedule.leafHoursSum,
      totalPeriodsStated: lectureSchedule.statedTotalHours,
      courseDesigners,
      conceptMapPresent,
      assessmentQuestionsCount,
      lineCount: segment.lines.length
    };

    const locations = {
      courseCode: segment.codeLocation,
      courseName: segment.nameLocation,
      preamble: preambleLines[0] ? { page: preambleLines[0].pageNumber, bbox: preambleLines[0].bbox } : null,
      courseOutcomes: sectionLocations.courseOutcomes,
      assessmentPattern: assessmentPattern.location,
      syllabus: sectionLocations.syllabus,
      learningResources: sectionLocations.learningResources,
      lectureSchedule: lectureSchedule.location,
      courseDesigners: sectionLocations.courseDesigners
    };

    const extractionConfidence = {
      header: 0.98,
      preamble: preambleText.length > 20 ? 0.95 : 0.60,
      courseOutcomes: courseOutcomes.length >= 6 ? 0.95 : 0.70,
      assessmentPattern: assessmentPattern.type !== 'NOT_FOUND' ? 0.90 : 0.50,
      books: books.allBooks.length > 0 ? 0.90 : 0.60,
      lectureSchedule: lectureSchedule.rows.length > 0 ? 0.92 : 0.50,
      overall: 0.94
    };

    return {
      courseCode: segment.courseCode,
      courseName: segment.courseName,
      category: segment.category,
      L: segment.L,
      T: segment.T,
      P: segment.P,
      credits: segment.credits,
      courseType: segment.courseType,
      formatEra: segment.formatEra,
      pageStart: segment.pageStart,
      pageEnd: segment.pageEnd,
      codeLocation: segment.codeLocation,
      nameLocation: segment.nameLocation,
      sectionBuckets,
      extractedFields,
      locations,
      extractionConfidence
    };
  });

  return {
    totalPages,
    courses,
    pages: processedPages
  };
}
