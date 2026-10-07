import { sanitizeText } from '../textSanitizer.js';

/**
 * Parses Syllabus section into distinct modules.
 * Supports both "Module n:" blocks and run-in colon headings ("Linked Lists:", "Stack and Queue:").
 */
export function parseSyllabusModules(lines) {
  if (!lines || lines.length === 0) return [];

  const fullText = lines.map(l => sanitizeText(l.text)).join(' ').replace(/\s+/g, ' ').trim();
  const modules = [];

  // Check for formal "Module \d+:" headings
  const moduleBlockMatches = [...fullText.matchAll(/Module\s*(\d+)[:\s\-]+([^:]+?)(?=(?:Module\s*\d+[:]|$))/gi)];

  if (moduleBlockMatches.length > 0) {
    moduleBlockMatches.forEach(m => {
      const number = parseInt(m[1], 10);
      const content = m[2].trim();
      const titleSplit = content.split(/[\-\–]/);
      const title = titleSplit[0]?.trim() || `Module ${number}`;
      const topics = titleSplit.slice(1).join('-').trim() || content;

      modules.push({
        number,
        title,
        topics,
        location: { page: lines[0].pageNumber, bbox: lines[0].bbox }
      });
    });
    return modules;
  }

  // Handle run-in colon headings (Legacy paragraph format)
  // Look for patterns like "Introduction to Abstract Data Types and Analysis:", "Linked Lists:", etc.
  const regex = /([A-Z][A-Za-z0-9\s,\(\)\/\–\-]{3,45}):\s*([^:]+?)(?=(?:[A-Z][A-Za-z0-9\s,\(\)\/\–\-]{3,45}:|$))/g;
  const matches = [...fullText.matchAll(regex)];

  let modNum = 1;
  for (const match of matches) {
    const title = match[1].trim();
    const topics = match[2].trim();

    // Ignore short words or false colons
    if (title.length > 3 && !title.toLowerCase().startsWith('for example')) {
      modules.push({
        number: modNum++,
        title,
        topics,
        location: { page: lines[0].pageNumber, bbox: lines[0].bbox }
      });
    }
  }

  if (modules.length === 0 && fullText.length > 0) {
    modules.push({
      number: 1,
      title: 'General Syllabus',
      topics: fullText,
      location: { page: lines[0].pageNumber, bbox: lines[0].bbox }
    });
  }

  return modules;
}
