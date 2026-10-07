import pino from 'pino';

const logger = pino({ name: 'courseSegmenter' });

// Matches standard 2026 codes (e.g. 26CSCA0) and legacy codes (e.g. 22CA120)
const COURSE_CODE_REGEX = /\b(\d{2}[A-Z]{2}[A-Z0-9]{3,5})\b/;
const CATEGORY_ROW_REGEX = /CATEGORY\s+L\s+T\s+P\s+CREDIT/i;
const CREDITS_VAL_REGEX = /\b([A-Z]{1,3})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\b/;

/**
 * Segments a PDF document into individual course modules.
 * Handles both single-course uploads and multi-course curriculum booklets.
 */
export function segmentCourses(processedPages) {
  // Flatten all lines across pages with page context
  const allLines = [];
  processedPages.forEach(p => {
    p.filteredLines.forEach(l => {
      allLines.push({
        ...l,
        pageNumber: p.pageNumber,
        pageWidth: p.width,
        pageHeight: p.height
      });
    });
  });

  const courseStartIndices = [];

  for (let i = 0; i < allLines.length; i++) {
    const lineText = allLines[i].text.trim();
    const codeMatch = lineText.match(COURSE_CODE_REGEX);

    if (codeMatch) {
      const detectedCode = codeMatch[1];

      // Look in a neighborhood of [-2, +6] lines around this line for:
      // 1. CATEGORY L T P CREDIT
      // 2. The credits row (e.g. "PC 3 1 0 4")
      const windowStart = Math.max(0, i - 3);
      const windowEnd = Math.min(allLines.length, i + 8);
      const windowLines = allLines.slice(windowStart, windowEnd);

      let hasCategoryHeader = false;
      let category = 'PC';
      let L = 3, T = 0, P = 0, credits = 3;
      let foundCredits = false;

      for (const wLine of windowLines) {
        if (CATEGORY_ROW_REGEX.test(wLine.text)) {
          hasCategoryHeader = true;
        }
        const valMatch = wLine.text.match(CREDITS_VAL_REGEX);
        if (valMatch) {
          category = valMatch[1];
          L = parseInt(valMatch[2], 10);
          T = parseInt(valMatch[3], 10);
          P = parseInt(valMatch[4], 10);
          credits = parseInt(valMatch[5], 10);
          foundCredits = true;
        }
      }

      // If we found either CATEGORY header or a valid credits row, this is definitely a course start
      if (hasCategoryHeader || foundCredits) {
        // Now parse the course title:
        // Extract title fragments from lines between the code line and the Preamble / Credits row
        const titleFragments = [];

        // In the code line itself, everything after the course code is title part 1:
        const afterCode = lineText.replace(detectedCode, '').trim();
        if (afterCode.length > 0) {
          titleFragments.push(afterCode);
        }

        // In subsequent 1-3 lines before Preamble, collect title tokens:
        for (let j = i + 1; j < Math.min(i + 5, allLines.length); j++) {
          const lText = allLines[j].text.trim();
          if (/^Preamble\b/i.test(lText) || CATEGORY_ROW_REGEX.test(lText)) {
            break;
          }

          // Strip category values if present on same line (e.g. "APPLICATIONS PC 3 1 0 4" -> "APPLICATIONS")
          let cleaned = lText.replace(CREDITS_VAL_REGEX, '').replace(CATEGORY_ROW_REGEX, '').trim();
          if (cleaned.length > 0) {
            titleFragments.push(cleaned);
          }
        }

        const courseName = titleFragments.join(' ').replace(/\s+/g, ' ').trim() || 'UNTITLED COURSE';

        courseStartIndices.push({
          startIndex: i,
          courseCode: detectedCode,
          courseName,
          category,
          L,
          T,
          P,
          credits,
          pageNumber: allLines[i].pageNumber,
          codeLocation: {
            page: allLines[i].pageNumber,
            bbox: allLines[i].bbox
          },
          nameLocation: {
            page: allLines[i].pageNumber,
            bbox: allLines[i].bbox
          }
        });
      }
    }
  }

  // If no course code matching pattern found, fallback to whole document
  if (courseStartIndices.length === 0) {
    logger.warn('No standard course code header found, falling back to document course default');
    return [{
      courseCode: 'COURSE',
      courseName: 'Uploaded Course Syllabus',
      category: 'PC',
      L: 3, T: 0, P: 0, credits: 3,
      formatEra: '2026',
      lines: allLines,
      pageStart: 1,
      pageEnd: processedPages.length,
      codeLocation: { page: 1, bbox: [0, 0, 100, 20] },
      nameLocation: { page: 1, bbox: [0, 20, 200, 20] }
    }];
  }

  // Segment lines between courses
  const segments = [];
  for (let k = 0; k < courseStartIndices.length; k++) {
    const current = courseStartIndices[k];
    const nextStart = k + 1 < courseStartIndices.length ? courseStartIndices[k + 1].startIndex : allLines.length;

    const courseLines = allLines.slice(current.startIndex, nextStart);
    const pagesIncluded = [...new Set(courseLines.map(l => l.pageNumber))];

    // Determine format era from code prefix
    const formatEra = current.courseCode.startsWith('26') ? '2026' : '2022_LEGACY';

    // Auto-detect course type
    let courseType = 'Theory';
    if (current.P > 0 && current.L === 0) {
      courseType = 'Practical';
    } else if (current.P > 0 && current.L > 0) {
      courseType = 'Theory cum Practical';
    }

    segments.push({
      courseCode: current.courseCode,
      courseName: current.courseName,
      category: current.category,
      L: current.L,
      T: current.T,
      P: current.P,
      credits: current.credits,
      courseType,
      formatEra,
      lines: courseLines,
      pageStart: Math.min(...pagesIncluded),
      pageEnd: Math.max(...pagesIncluded),
      codeLocation: current.codeLocation,
      nameLocation: current.nameLocation
    });
  }

  return segments;
}
