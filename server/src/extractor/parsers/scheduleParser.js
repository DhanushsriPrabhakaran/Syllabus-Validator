import { sanitizeText } from '../textSanitizer.js';

/**
 * Parses Lecture Schedule table.
 * Handles hierarchical numbering (1, 1.0, 1.1, 2.4.1), leaf hours calculation, and stated total.
 */
export function parseLectureSchedule(lines) {
  if (!lines || lines.length === 0) {
    return {
      rows: [],
      leafRows: [],
      leafHoursSum: 0,
      statedTotalHours: 0,
      location: null
    };
  }

  const rows = [];
  let statedTotalHours = null;

  for (const line of lines) {
    const raw = sanitizeText(line.text.trim());

    // Check for Total line (e.g. "Total No of Hours 45", "Total Periods 48")
    const totalMatch = raw.match(/Total\s+(?:No\.?\s+of\s+)?(?:Hours|Periods|Lectures)\s*:?\s*(\d+)/i);
    if (totalMatch) {
      statedTotalHours = parseInt(totalMatch[1], 10);
      continue;
    }

    // Check for hierarchical row number (e.g., "1", "1.0", "1.1", "2.4.1")
    const numMatch = raw.match(/^(\d+(?:\.\d+)*)\s+(.*)/);
    if (numMatch) {
      const moduleNo = numMatch[1];
      const rest = numMatch[2].trim();

      // Check if last token is periods count integer
      const periodsMatch = rest.match(/(\d+)\s*$/);
      const periods = periodsMatch ? parseInt(periodsMatch[1], 10) : 0;
      const topics = periodsMatch ? rest.substring(0, periodsMatch.index).trim() : rest;

      const isModuleHeader = !moduleNo.includes('.'); // Integer only (1, 2, 3)

      rows.push({
        moduleNo,
        topics,
        periods: isModuleHeader ? 0 : periods,
        isModuleHeader,
        isLeaf: !isModuleHeader,
        rawText: raw,
        location: { page: line.pageNumber, bbox: line.bbox }
      });
    }
  }

  const leafRows = rows.filter(r => r.isLeaf);
  const leafHoursSum = leafRows.reduce((sum, r) => sum + r.periods, 0);

  return {
    rows,
    leafRows,
    leafHoursSum,
    statedTotalHours: statedTotalHours ?? leafHoursSum,
    location: lines[0] ? { page: lines[0].pageNumber, bbox: lines[0].bbox } : null
  };
}
