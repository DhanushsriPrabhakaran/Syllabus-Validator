import { sanitizeText } from '../textSanitizer.js';

const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

/**
 * Parses Assessment Pattern section.
 * Detects whether layout is CO-wise (2026 requirement) or Bloom-wise (legacy format).
 */
export function parseAssessmentPattern(lines) {
  if (!lines || lines.length === 0) {
    return {
      type: 'NOT_FOUND',
      rows: [],
      columnSums: {},
      location: null
    };
  }

  const sanitizedLines = lines.map(l => ({
    ...l,
    text: sanitizeText(l.text)
  }));

  // Check if rows correspond to Bloom levels
  const bloomRows = [];
  let isBloomWise = false;

  for (const line of sanitizedLines) {
    for (const bLevel of BLOOM_LEVELS) {
      const regex = new RegExp(`^${bLevel}\\b`, 'i');
      if (regex.test(line.text.trim())) {
        isBloomWise = true;
        // Extract numbers from the line
        const numbers = (line.text.match(/\b\d+\b/g) || []).map(n => parseInt(n, 10));
        bloomRows.push({
          level: bLevel,
          cat1: numbers[0] ?? 0,
          cat2: numbers[1] ?? 0,
          cat3: numbers[2] ?? 0,
          terminal: numbers[3] ?? 0,
          rawText: line.text,
          location: { page: line.pageNumber, bbox: line.bbox }
        });
        break;
      }
    }
  }

  if (isBloomWise && bloomRows.length > 0) {
    // Calculate column totals
    const cat1Total = bloomRows.reduce((sum, r) => sum + r.cat1, 0);
    const cat2Total = bloomRows.reduce((sum, r) => sum + r.cat2, 0);
    const cat3Total = bloomRows.reduce((sum, r) => sum + r.cat3, 0);
    const terminalTotal = bloomRows.reduce((sum, r) => sum + r.cat4 || sum + r.terminal, 0);

    const byBloom = {};
    for (const r of bloomRows) {
      byBloom[r.level] = {
        CAT1: r.cat1,
        CAT2: r.cat2,
        CAT3: r.cat3,
        Terminal: r.terminal
      };
    }

    return {
      type: 'BLOOM_WISE',
      rows: bloomRows,
      byBloom,
      columnSums: {
        CAT1: cat1Total,
        CAT2: cat2Total,
        CAT3: cat3Total,
        Terminal: terminalTotal
      },
      columns: ['CAT1', 'CAT2', 'CAT3', 'Terminal'],
      location: {
        page: lines[0].pageNumber,
        bbox: lines[0].bbox
      }
    };
  }

  // Check for CO-wise layout (CO1..CO8)
  const coRows = [];
  for (const line of sanitizedLines) {
    const coMatch = line.text.match(/^(CO\d+)\b/i);
    if (coMatch) {
      const numbers = (line.text.match(/\b\d+(?:\.\d+)?\b/g) || []).map(Number);
      coRows.push({
        coId: coMatch[1].toUpperCase(),
        values: numbers,
        rawText: line.text,
        location: { page: line.pageNumber, bbox: line.bbox }
      });
    }
  }

  return {
    type: coRows.length > 0 ? 'CO_WISE' : 'UNKNOWN',
    rows: coRows,
    columnSums: {},
    columns: ['CAT1', 'Assignment 1', 'CAT2', 'Assignment 2', 'Terminal Exam'],
    location: {
      page: lines[0].pageNumber,
      bbox: lines[0].bbox
    }
  };
}
