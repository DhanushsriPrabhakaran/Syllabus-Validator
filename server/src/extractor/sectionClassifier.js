/**
 * Section headings and anchor definitions.
 * Tolerates numbering (e.g., "1. Preamble", "6. Learning Resources", "Course Outcomes:")
 */
const SECTION_ANCHORS = [
  { key: 'preamble', patterns: [/^(?:\d+[\.\s]*)?Preamble\b/i] },
  { key: 'prerequisite', patterns: [/^(?:\d+[\.\s]*)?Prerequisites?\b/i] },
  { key: 'courseOutcomes', patterns: [/^(?:\d+[\.\s]*)?Course\s+Outcomes\b/i] },
  { key: 'coPoMapping', patterns: [/^(?:\d+[\.\s]*)?Mapping\s+with\s+Programme\s+Outcomes/i, /^COs?\s+PO1\s+PO2/i] },
  { key: 'assessmentPattern', patterns: [/^(?:\d+[\.\s]*)?Assessment\s+Pattern(?::\s*Cognitive\s+Domain)?\b/i] },
  { key: 'assessmentQuestions', patterns: [/^(?:\d+[\.\s]*)?Course\s+Level\s+Assessment\s+Questions\b/i] },
  { key: 'conceptMap', patterns: [/^(?:\d+[\.\s]*)?Concept\s+Map\b/i] },
  { key: 'syllabus', patterns: [/^(?:\d+[\.\s]*)?Syllabus\b/i] },
  { key: 'learningResources', patterns: [/^(?:\d+[\.\s]*)?Learning\s+Resources\b/i, /^(?:\d+[\.\s]*)?Text\s+Books?\b/i] },
  { key: 'sdgAlignment', patterns: [/^(?:\d+[\.\s]*)?SDG\s+Alignment\b/i, /^(?:\d+[\.\s]*)?Sustainable\s+Development\s+Goals\b/i] },
  { key: 'lectureSchedule', patterns: [/^(?:\d+[\.\s]*)?Course\s+Contents\s+and\s+Lecture\s+Schedule\b/i, /^(?:\d+[\.\s]*)?Lecture\s+Schedule\b/i] },
  { key: 'experiments', patterns: [/^(?:\d+[\.\s]*)?List\s+of\s+Experiments\b/i, /^(?:\d+[\.\s]*)?Laboratory\s+Exercises\b/i] },
  { key: 'courseDesigners', patterns: [/^(?:\d+[\.\s]*)?Course\s+Designers?:?\b/i] }
];

export function classifySections(courseLines) {
  const sectionBuckets = {
    headerInfo: [],
    preamble: [],
    prerequisite: [],
    courseOutcomes: [],
    coPoMapping: [],
    assessmentPattern: [],
    assessmentQuestions: [],
    conceptMap: [],
    syllabus: [],
    learningResources: [],
    sdgAlignment: [],
    lectureSchedule: [],
    experiments: [],
    courseDesigners: [],
    unclassified: []
  };

  const sectionLocations = {};
  let currentSection = 'headerInfo';

  for (const line of courseLines) {
    const text = line.text.trim();

    // Check if line matches a new section anchor
    let matchedSection = null;
    for (const anchor of SECTION_ANCHORS) {
      if (anchor.patterns.some(p => p.test(text))) {
        matchedSection = anchor.key;
        break;
      }
    }

    if (matchedSection) {
      currentSection = matchedSection;
      if (!sectionLocations[currentSection]) {
        sectionLocations[currentSection] = {
          page: line.pageNumber,
          bbox: line.bbox
        };
      }
      continue; // Skip heading line itself
    }

    sectionBuckets[currentSection].push(line);
  }

  return { sectionBuckets, sectionLocations };
}
