import { sanitizeText } from '../textSanitizer.js';

const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;

/**
 * Parses Course Designers section.
 * Extracts: name, designation, department, email.
 */
export function parseCourseDesigners(lines) {
  if (!lines || lines.length === 0) return [];

  const designers = [];

  for (const line of lines) {
    const raw = sanitizeText(line.text.trim());
    if (!raw) continue;

    const emailMatch = raw.match(EMAIL_REGEX);
    const email = emailMatch ? emailMatch[1].trim() : '';

    // Strip leading number (e.g. "1. P.Sharmila psaca@tce.edu" -> "P.Sharmila psaca@tce.edu")
    let withoutNum = raw.replace(/^\d+[\.\)]\s*/, '').trim();

    // Strip email from line to get text tokens
    let textPortion = withoutNum.replace(EMAIL_REGEX, '').trim();

    // Check if comma-separated: Name, Designation, Department
    const parts = textPortion.split(',').map(p => p.trim()).filter(Boolean);
    const name = parts[0] || textPortion || 'Unknown';
    const designation = parts[1] || '';
    const department = parts[2] || '';

    designers.push({
      name,
      designation,
      department,
      email,
      raw,
      location: { page: line.pageNumber, bbox: line.bbox }
    });
  }

  return designers;
}
