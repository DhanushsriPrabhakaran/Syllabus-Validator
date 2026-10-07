import { GoogleGenerativeAI } from '@google/generative-ai';
import pino from 'pino';

const logger = pino({ name: 'llmFallback' });

/**
 * Optional LLM structured extraction fallback (active only when ENABLE_LLM_EXTRACTION === 'true')
 * Never decides pass/fail — only extracts structured JSON fields when table geometry parsing fails.
 */
export async function extractSectionWithLlm(sectionName, sectionRawText) {
  if (process.env.ENABLE_LLM_EXTRACTION !== 'true') {
    return null;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn('ENABLE_LLM_EXTRACTION is true but GEMINI_API_KEY is not set');
    return null;
  }

  try {
    logger.info({ sectionName }, 'Triggering Gemini extraction fallback for section');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });

    const prompt = `You are a strict data extraction parser for course syllabus text.
Extract the structured fields from the following syllabus section: "${sectionName}".
Return ONLY a valid JSON object. Do not evaluate rules or decide compliance.

Section Text:
${sectionRawText}
`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    return {
      source: 'llm',
      data: parsed
    };
  } catch (err) {
    logger.error({ err, sectionName }, 'LLM extraction fallback failed');
    return null;
  }
}
