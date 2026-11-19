const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bull: '•',
  middot: '·',
}

/** Decodes numeric entities and the named ones job boards use. Unknown names stay as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity
  })
}

const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|section|article|header|footer|blockquote)\b[^>]*>/gi

/**
 * Plain text from a posting's HTML: block elements become line breaks, other tags are dropped,
 * entities are decoded and runs of spaces collapse. It isn't a full HTML parser; it only has to
 * keep sentences readable for the detector.
 */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(BLOCK_TAGS, '\n')
    .replace(/<[^>]*>/g, ' ')
  return normalizeText(decodeEntities(text))
}

/** Non-breaking spaces become spaces, spaces collapse, and blank lines go away. */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')
}

/**
 * Words whose final period doesn't end a sentence. Single capital letters cover initials and the
 * "U." of "U. S.", so "a U.S. person" stays in one sentence.
 */
const ABBREVIATION =
  /(?:\b(?:U\.\s?S|U\.\s?S\.\s?A|e\.g|i\.e|etc|Inc|Corp|Co|Ltd|LLC|Jr|Sr|Dr|Mr|Mrs|Ms|No|St|vs|approx|Dept|Sec|Pub|Ref)|\b[A-Za-z]|\(\w{1,4}\))\.$/

/** Sentences of a text, line by line. Each one is trimmed and never empty. */
export function splitSentences(text: string): string[] {
  const sentences: string[] = []
  for (const line of text.split('\n')) {
    let start = 0
    for (const match of line.matchAll(/[.!?]+(?=\s|$)/g)) {
      const end = match.index + match[0].length
      const candidate = line.slice(start, end)
      if (match[0] === '.' && ABBREVIATION.test(candidate.slice(-12))) continue
      const sentence = candidate.trim()
      if (sentence !== '') sentences.push(sentence)
      start = end
    }
    const rest = line.slice(start).trim()
    if (rest !== '') sentences.push(rest)
  }
  return sentences
}
