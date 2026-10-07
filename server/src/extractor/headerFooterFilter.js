/**
 * Detects and strips recurring headers and footers across pages.
 * Recurring patterns (e.g. "MCA– Degree Programme 2022 - 2023", "BOS meeting approved...")
 * appear in top/bottom margins on >= 40% of pages.
 */
export function filterHeadersAndFooters(pages) {
  if (!pages || pages.length <= 1) {
    return pages.map(p => ({
      ...p,
      filteredLines: p.lines,
      strippedHeaders: [],
      strippedFooters: []
    }));
  }

  // Count occurrences of normalized text strings in margin zones
  const marginLineCounts = new Map();

  for (const page of pages) {
    const topMarginCutoff = page.height * 0.12;
    const bottomMarginCutoff = page.height * 0.88;

    for (const line of page.lines) {
      const isTopMargin = line.y <= topMarginCutoff;
      const isBottomMargin = line.y >= bottomMarginCutoff;

      if (isTopMargin || isBottomMargin) {
        const norm = normalizeMarginText(line.text);
        if (norm.length > 5) {
          marginLineCounts.set(norm, (marginLineCounts.get(norm) || 0) + 1);
        }
      }
    }
  }

  const thresholdCount = Math.max(2, Math.floor(pages.length * 0.35));

  return pages.map(page => {
    const topMarginCutoff = page.height * 0.12;
    const bottomMarginCutoff = page.height * 0.88;

    const filteredLines = [];
    const strippedHeaders = [];
    const strippedFooters = [];

    for (const line of page.lines) {
      const norm = normalizeMarginText(line.text);
      const isRecurring = norm.length > 5 && (marginLineCounts.get(norm) || 0) >= thresholdCount;
      const isTop = line.y <= topMarginCutoff;
      const isBottom = line.y >= bottomMarginCutoff;

      if (isRecurring && isTop) {
        strippedHeaders.push(line);
      } else if (isRecurring && isBottom) {
        strippedFooters.push(line);
      } else {
        filteredLines.push(line);
      }
    }

    return {
      ...page,
      filteredLines,
      strippedHeaders,
      strippedFooters
    };
  });
}

function normalizeMarginText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[–—\-\s\d\.:,\/]/g, '')
    .trim();
}
