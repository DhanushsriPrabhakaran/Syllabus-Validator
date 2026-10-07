import { sanitizeText } from '../textSanitizer.js';

/**
 * Parses Learning Resources section.
 * Detects whether books are split into Text Books and Reference Books or in a single numbered list.
 * Extracts: authors, title, publisher, edition, year, raw.
 */
export function parseBooks(lines) {
  if (!lines || lines.length === 0) {
    return {
      textBooks: [],
      referenceBooks: [],
      allBooks: [],
      booksSplit: false
    };
  }

  const rawTextLines = lines.map(l => ({
    ...l,
    text: sanitizeText(l.text)
  }));

  let hasTextHeader = false;
  let hasRefHeader = false;
  let currentGroup = 'all';

  const textBookLines = [];
  const refBookLines = [];
  const singleListLines = [];

  for (const line of rawTextLines) {
    const t = line.text.trim();
    if (/^Text\s*Books?:?/i.test(t)) {
      hasTextHeader = true;
      currentGroup = 'text';
      continue;
    }
    if (/^Reference\s*Books?:?/i.test(t)) {
      hasRefHeader = true;
      currentGroup = 'ref';
      continue;
    }

    if (currentGroup === 'text') {
      textBookLines.push(line);
    } else if (currentGroup === 'ref') {
      refBookLines.push(line);
    } else {
      singleListLines.push(line);
    }
  }

  const booksSplit = hasTextHeader && hasRefHeader;

  const parseNumberedList = (lineList) => {
    const bookEntries = [];
    let currentEntry = null;

    for (const line of lineList) {
      const t = line.text.trim();
      const numMatch = t.match(/^(\d+)[\.\)]\s*(.*)/);

      if (numMatch) {
        if (currentEntry) {
          bookEntries.push(currentEntry);
        }
        currentEntry = {
          num: parseInt(numMatch[1], 10),
          rawLines: [numMatch[2]],
          lines: [line]
        };
      } else if (currentEntry) {
        currentEntry.rawLines.push(t);
        currentEntry.lines.push(line);
      }
    }

    if (currentEntry) {
      bookEntries.push(currentEntry);
    }

    return bookEntries.map(b => parseBookString(b.rawLines.join(' '), b.lines));
  };

  if (booksSplit) {
    const textBooks = parseNumberedList(textBookLines);
    const referenceBooks = parseNumberedList(refBookLines);
    return {
      textBooks,
      referenceBooks,
      allBooks: [...textBooks, ...referenceBooks],
      booksSplit: true
    };
  } else {
    const allBooks = parseNumberedList(singleListLines.length > 0 ? singleListLines : rawTextLines);
    return {
      textBooks: [],
      referenceBooks: [],
      allBooks,
      booksSplit: false
    };
  }
}

/**
 * Extracts structured book metadata from raw citation string:
 * "MarkAllenWeiss, “Data Structures and Algorithm Analysis in C++”,Pearson,2007"
 */
function parseBookString(rawString, sourceLines = []) {
  const clean = rawString.trim();

  // Extract Title (enclosed in quotes or smart quotes)
  const titleMatch = clean.match(/["“]([^"”]+)["”]/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract 4-digit publication year (e.g. 2007, 2012, 2015)
  const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  // Extract Edition (e.g. "4th Edition", "4 th Edition", "2nd Edition")
  const editionMatch = clean.match(/\b(\d+)?\s*(?:st|nd|rd|th)?\s*Edition\b/i) || clean.match(/\b(\d+(?:st|nd|rd|th)\s*Edition|[A-Za-z]+\s*Edition)\b/i);
  let edition = null;
  const numEditionMatch = clean.match(/\b(\d+)\s*(?:st|nd|rd|th)?\s*Edition\b/i);
  if (numEditionMatch) {
    const num = numEditionMatch[1];
    const suffix = num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th';
    edition = `${num}${suffix} Edition`;
  } else if (clean.match(/\b([A-Za-z]+\s*Edition)\b/i)) {
    edition = clean.match(/\b([A-Za-z]+\s*Edition)\b/i)[1].trim();
  }

  // Extract Authors (text preceding title quotes)
  let authors = '';
  if (titleMatch) {
    authors = clean.substring(0, titleMatch.index).replace(/[,;]+$/, '').trim();
  }

  // Extract Publisher (text following title)
  let publisher = '';
  if (titleMatch) {
    let afterTitle = clean.substring(titleMatch.index + titleMatch[0].length).replace(/^[,;\s]+/, '').trim();
    if (yearMatch) {
      afterTitle = afterTitle.replace(yearMatch[0], '').replace(/[,;\s]+$/, '').trim();
    }
    if (editionMatch) {
      afterTitle = afterTitle.replace(editionMatch[0], '').replace(/[,;\s]+$/, '').trim();
    }
    publisher = afterTitle.replace(/^[,;\s]+|[,;\s]+$/g, '').trim();
  }

  const firstLine = sourceLines[0];

  return {
    authors,
    title: title || clean,
    publisher,
    edition,
    year,
    raw: clean,
    location: firstLine ? { page: firstLine.pageNumber, bbox: firstLine.bbox } : null
  };
}
