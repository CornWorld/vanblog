// Normalize LaTeX-style math delimiters into $...$ / $$...$$ that KaTeX/marked can render.
//
// Ported from upstream vanblog:
// refs/xxddccaa-fork/repo/packages/admin/src/components/Editor/plugins/normalizeMathDelimiters.ts
//
// Why: users pasting from Word/Notion/Notion-equivalent tools often get \(...\) / \[...\]
// delimiters, which bytemd's math plugin does not recognize. This rewrites them to
// inline `$...$` and block `$$...$$` before rendering, while skipping code spans,
// fenced code blocks, indented code, HTML raw blocks, and HTML comments.

const RAW_HTML_TAG_NAMES = ['code', 'pre', 'script', 'style', 'textarea'];
const FENCED_CODE_REGEXP = /^\s{0,3}(`{3,}|~{3,})/;
const INDENTED_CODE_REGEXP = /^(?: {4,}|\t)/;

function isLineStart(source: string, index: number) {
  return index === 0 || source[index - 1] === '\n';
}

function countLeadingBackslashes(source: string, index: number) {
  let count = 0;

  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    count += 1;
  }

  return count;
}

function isEscaped(source: string, index: number) {
  return countLeadingBackslashes(source, index) % 2 === 1;
}

function findUnescapedDelimiter(source: string, start: number, delimiter: string) {
  let index = start;

  while (index < source.length) {
    const matchIndex = source.indexOf(delimiter, index);

    if (matchIndex === -1) {
      return -1;
    }

    if (!isEscaped(source, matchIndex)) {
      return matchIndex;
    }

    index = matchIndex + delimiter.length;
  }

  return -1;
}

function getFenceMarker(line: string) {
  const match = line.match(FENCED_CODE_REGEXP);
  return match?.[1] || null;
}

function isFenceClose(line: string, marker: string) {
  const currentMarker = getFenceMarker(line);

  return Boolean(
    currentMarker &&
      currentMarker[0] === marker[0] &&
      currentMarker.length >= marker.length,
  );
}

function getLineEnd(source: string, index: number) {
  const lineEnd = source.indexOf('\n', index);
  return lineEnd === -1 ? source.length : lineEnd + 1;
}

function normalizeBlockFormulaContent(content: string) {
  return content.replace(/^\n+/, '').replace(/\n+$/, '');
}

export function normalizeMathDelimiters(source = '') {
  if (!source.includes('\\(') && !source.includes('\\[')) {
    return source;
  }

  let normalized = '';
  let index = 0;
  let activeFenceMarker: string | null = null;

  while (index < source.length) {
    if (isLineStart(source, index)) {
      const lineEnd = getLineEnd(source, index);
      const line = source.slice(index, lineEnd);

      if (activeFenceMarker) {
        normalized += line;
        if (isFenceClose(line, activeFenceMarker)) {
          activeFenceMarker = null;
        }
        index = lineEnd;
        continue;
      }

      const openingFenceMarker = getFenceMarker(line);
      if (openingFenceMarker) {
        activeFenceMarker = openingFenceMarker;
        normalized += line;
        index = lineEnd;
        continue;
      }

      if (INDENTED_CODE_REGEXP.test(line) && line.trim() !== '') {
        normalized += line;
        index = lineEnd;
        continue;
      }
    }

    if (source.startsWith('<!--', index)) {
      const commentEnd = source.indexOf('-->', index + 4);

      if (commentEnd === -1) {
        normalized += source.slice(index);
        break;
      }

      normalized += source.slice(index, commentEnd + 3);
      index = commentEnd + 3;
      continue;
    }

    const rawHtmlStart = source.slice(index).match(/^<([A-Za-z][\w-]*)\b[^>]*>/);
    if (rawHtmlStart) {
      const tagName = rawHtmlStart[1].toLowerCase();
      const openingTag = rawHtmlStart[0];

      if (
        RAW_HTML_TAG_NAMES.includes(tagName) &&
        !openingTag.endsWith('/>')
      ) {
        const closeTagRegExp = new RegExp(`</${tagName}\\s*>`, 'i');
        const blockStart = index + openingTag.length;
        const closeMatch = source.slice(blockStart).match(closeTagRegExp);

        if (closeMatch && closeMatch.index !== undefined) {
          const blockEnd = blockStart + closeMatch.index + closeMatch[0].length;
          normalized += source.slice(index, blockEnd);
          index = blockEnd;
          continue;
        }
      }
    }

    if (source[index] === '`') {
      const tickRun = source.slice(index).match(/^`+/)?.[0] || '`';
      const closeTickIndex = source.indexOf(tickRun, index + tickRun.length);

      if (closeTickIndex === -1) {
        normalized += source.slice(index);
        break;
      }

      normalized += source.slice(index, closeTickIndex + tickRun.length);
      index = closeTickIndex + tickRun.length;
      continue;
    }

    if (source.startsWith('\\[', index) && !isEscaped(source, index)) {
      const closeIndex = findUnescapedDelimiter(source, index + 2, '\\]');

      if (closeIndex !== -1) {
        const formulaContent = normalizeBlockFormulaContent(source.slice(index + 2, closeIndex));
        normalized += `$$\n${formulaContent}\n$$`;
        index = closeIndex + 2;
        continue;
      }
    }

    if (source.startsWith('\\(', index) && !isEscaped(source, index)) {
      const closeIndex = findUnescapedDelimiter(source, index + 2, '\\)');

      if (closeIndex !== -1) {
        const formulaContent = source.slice(index + 2, closeIndex);

        if (!formulaContent.includes('\n')) {
          normalized += `$${formulaContent}$`;
          index = closeIndex + 2;
          continue;
        }
      }
    }

    normalized += source[index];
    index += 1;
  }

  return normalized;
}
