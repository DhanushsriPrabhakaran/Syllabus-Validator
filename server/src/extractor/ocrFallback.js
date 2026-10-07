import { createWorker } from 'tesseract.js';
import pino from 'pino';

const logger = pino({ name: 'ocrService' });

/**
 * Fallback OCR for pages without digital text layer.
 */
export async function performOcrOnImageBuffer(imageBuffer) {
  try {
    logger.info('Performing OCR fallback on page image');
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imageBuffer);
    await worker.terminate();

    return {
      text: ret.data.text,
      confidence: ret.data.confidence / 100,
      lines: ret.data.lines.map(l => ({
        text: l.text,
        bbox: [l.bbox.x0, l.bbox.y0, l.bbox.x1 - l.bbox.x0, l.bbox.y1 - l.bbox.y0]
      }))
    };
  } catch (err) {
    logger.error({ err }, 'OCR processing failed');
    return { text: '', confidence: 0, lines: [] };
  }
}
