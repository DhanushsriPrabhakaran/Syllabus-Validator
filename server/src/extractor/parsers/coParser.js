import { sanitizeText } from '../textSanitizer.js';

const BLOOM_WORDS = ['remember', 'understand', 'apply', 'analyze', 'analyse', 'evaluate', 'create'];

/**
 * Parses Course Outcomes from classified section lines.
 * Handles both:
 * 1. Legacy tables where statement first line precedes vertically-centered CO identifier
 * 2. Standard 2026 format with columns (TPS, PI, Weightage, SDG)
 */
export function parseCourseOutcomes(lines) {
  if (!lines || lines.length === 0) return [];

  // Filter out introductory headers
  const contentLines = lines.filter(l => {
    const t = l.text.trim();
    return !/^On\s+the\s+successful\s+completion/i.test(t) &&
           !/^Course\s+Outcomes/i.test(t);
  });

  if (contentLines.length === 0) return [];

  // Locate all CO marker lines (lines containing CO1, CO2, etc.)
  const coMarkers = [];
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const match = line.text.match(/\b(CO\s*\d+)\b/i);
    if (match) {
      coMarkers.push({
        index: i,
        id: match[1].replace(/\s+/g, '').toUpperCase(),
        line
      });
    }
  }

  // If we found numbered CO markers (e.g. CO1..CO6)
  if (coMarkers.length > 0) {
    const coRows = [];

    for (let k = 0; k < coMarkers.length; k++) {
      const curMarker = coMarkers[k];
      const prevMarker = k > 0 ? coMarkers[k - 1] : null;
      const nextMarker = k + 1 < coMarkers.length ? coMarkers[k + 1] : null;

      // Determine y-band for this CO row
      // Lower bound is midway from prevMarker (or first line before curMarker)
      const prevY = prevMarker ? prevMarker.line.y : 0;
      const curY = curMarker.line.y;
      const nextY = nextMarker ? nextMarker.line.y : Infinity;

      const yStart = prevMarker ? (prevY + curY) / 2 : curY - 18;
      const yEnd = nextMarker ? (curY + nextY) / 2 : curY + 25;

      // Collect all lines that fall within [yStart, yEnd]
      const rowLines = contentLines.filter(l => l.y >= yStart && l.y < yEnd);

      // Separate statement items vs Bloom label items vs CO ID
      const statementFragments = [];
      let bloomLabel = null;
      let tpsLevel = null;
      let pi = null;
      let coWeightage = null;

      for (const rLine of rowLines) {
        // Collect items
        for (const item of rLine.items) {
          const str = item.str.trim();
          if (!str) continue;

          // Check if this is the CO identifier
          if (new RegExp(`^${curMarker.id}\\.?$`, 'i').test(str)) {
            continue;
          }

          // Check if this is a Bloom level word in the right column (x >= 450)
          const lowerStr = str.toLowerCase();
          if (BLOOM_WORDS.includes(lowerStr) && item.x >= 450) {
            bloomLabel = capitalize(lowerStr);
            continue;
          }

          // Check for TPS, PI, or weightage tokens
          const tpsMatch = str.match(/\bTPS\s*([1-5])\b/i);
          if (tpsMatch) {
            tpsLevel = parseInt(tpsMatch[1], 10);
            continue;
          }

          const piMatch = str.match(/\b(\d+\.\d+\.\d+)\b/);
          if (piMatch) {
            pi = piMatch[1];
            continue;
          }

          const weightMatch = str.match(/\b(\d{1,2}(?:\.\d+)?)\s*%/);
          if (weightMatch) {
            coWeightage = parseFloat(weightMatch[1]);
            continue;
          }

          statementFragments.push(item);
        }
      }

      // Reconstruct statement sorted by y then x
      statementFragments.sort((a, b) => {
        if (Math.abs(a.y - b.y) <= 4.0) {
          return a.x - b.x;
        }
        return a.y - b.y;
      });

      let rawStatement = '';
      for (let i = 0; i < statementFragments.length; i++) {
        const cur = statementFragments[i];
        if (i === 0) {
          rawStatement += cur.str;
        } else {
          const prev = statementFragments[i - 1];
          const gap = cur.x - (prev.x + prev.width);
          if (Math.abs(cur.y - prev.y) > 4.0 || gap > 1.8) {
            rawStatement += ' ' + cur.str;
          } else {
            rawStatement += cur.str;
          }
        }
      }

      const cleanStatement = sanitizeText(rawStatement.replace(/\s+/g, ' ').trim());

      // Extract first action verb
      const firstWordMatch = cleanStatement.match(/^[A-Za-z]+/);
      const firstVerb = firstWordMatch ? capitalize(firstWordMatch[0].toLowerCase()) : '';

      const minX = Math.min(...rowLines.map(l => l.bbox[0]));
      const minY = Math.min(...rowLines.map(l => l.bbox[1]));
      const maxX = Math.max(...rowLines.map(l => l.bbox[0] + l.bbox[2]));
      const maxY = Math.max(...rowLines.map(l => l.bbox[1] + l.bbox[3]));

      coRows.push({
        id: curMarker.id,
        statement: cleanStatement,
        firstVerb,
        bloomLabel,
        tpsLevel,
        pi,
        coWeightage,
        sdg: null,
        sdgLevel: null,
        location: {
          page: curMarker.line.pageNumber,
          bbox: [
            Math.round(minX * 10) / 10,
            Math.round(minY * 10) / 10,
            Math.round((maxX - minX) * 10) / 10,
            Math.round((maxY - minY) * 10) / 10
          ]
        }
      });
    }

    return coRows;
  }

  // Fallback linear parser
  return [];
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
