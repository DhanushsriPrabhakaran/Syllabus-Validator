import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import pino from 'pino';
import { sanitizeText } from './textSanitizer.js';

const logger = pino({ name: 'pdfTextExtractor' });

/**
 * Extracts structured text items with exact page coordinates from a PDF buffer.
 * Coordinates are normalized to top-left origin: [x, y, width, height]
 */
export async function extractPdfPagesWithCoordinates(pdfBuffer) {
  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({
    data: uint8Array,
    useSystemFonts: true,
    disableFontFace: true
  });

  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;
  const pages = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const items = [];
    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue;

      // item.transform: [scaleX, skewY, skewX, scaleY, tx, ty]
      const tx = item.transform[4];
      const ty = item.transform[5];
      const width = item.width || 0;
      const height = item.height || Math.abs(item.transform[0]) || 10;

      // Convert from PDF bottom-left origin to top-left origin
      const x = Math.round(tx * 100) / 100;
      const y = Math.round((viewport.height - ty - height) * 100) / 100;

      items.push({
        str: item.str,
        fontName: item.fontName || '',
        bbox: [x, Math.max(0, y), Math.round(width * 100) / 100, Math.round(height * 100) / 100],
        x,
        y: Math.max(0, y),
        width,
        height
      });
    }

    // Reconstruct lines from items
    const lines = clusterItemsIntoLines(items, viewport.width, viewport.height);

    pages.push({
      pageNumber: pageNum,
      width: viewport.width,
      height: viewport.height,
      items,
      lines
    });
  }

  return { totalPages, pages };
}

/**
 * Clusters text items into ordered lines based on vertical alignment (y tolerance)
 */
function clusterItemsIntoLines(items, pageWidth, pageHeight) {
  if (!items || items.length === 0) return [];

  // Sort primarily by vertical y position, then horizontally by x
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  const Y_TOLERANCE = 4.0; // Points tolerance for same line

  for (const item of sorted) {
    let placed = false;
    for (const line of lines) {
      if (Math.abs(line.y - item.y) <= Y_TOLERANCE) {
        line.items.push(item);
        // Expand bounding box
        line.minX = Math.min(line.minX, item.x);
        line.maxX = Math.max(line.maxX, item.x + item.width);
        line.minY = Math.min(line.minY, item.y);
        line.maxY = Math.max(line.maxY, item.y + item.height);
        placed = true;
        break;
      }
    }

    if (!placed) {
      lines.push({
        y: item.y,
        minX: item.x,
        maxX: item.x + item.width,
        minY: item.y,
        maxY: item.y + item.height,
        items: [item]
      });
    }
  }

  // Finalize each line text and bounding box
  return lines.map(line => {
    line.items.sort((a, b) => a.x - b.x);

    let rawText = '';
    for (let i = 0; i < line.items.length; i++) {
      const cur = line.items[i];
      if (i === 0) {
        rawText += cur.str;
      } else {
        const prev = line.items[i - 1];
        const gap = cur.x - (prev.x + prev.width);
        // Typographic space threshold: gap > 1.8 points represents word boundary
        if (gap > 1.8) {
          rawText += ' ' + cur.str;
        } else {
          rawText += cur.str;
        }
      }
    }

    const text = sanitizeText(rawText.replace(/\s+/g, ' ').trim());
    const bbox = [
      Math.round(line.minX * 10) / 10,
      Math.round(line.minY * 10) / 10,
      Math.round((line.maxX - line.minX) * 10) / 10,
      Math.round((line.maxY - line.minY) * 10) / 10
    ];

    return {
      text,
      bbox,
      y: line.minY,
      items: line.items
    };
  }).filter(line => line.text.length > 0);
}
