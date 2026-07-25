// Syntactic bracket-matching heuristic for unclosed/orphaned/crossed
// [[tag]]/[[/tag]] pairs — not a Wikidot parser. Validated against real SCP
// source with ftml as ground truth (see the [[module ...]] handling below
// for how that validation shaped the paired/self-closing defaults).

export type TagFindingType = 'unclosed' | 'orphan-close' | 'mismatched-nesting'

export interface TagFinding {
  type: TagFindingType
  name: string
  index: number
  length: number
  expectedName?: string
  expectedOpenIndex?: number
}

// Single-bracket calls that never expect a matching [[/name]].
const SELF_CLOSING = new Set([
  'include',
  'image',
  '*image',
  '<image',
  '>image',
  '=image',
  'f<image',
  'f>image',
  'toc',
  'footnoteblock',
  'user',
  '*user',
  'date',
  'youtube',
  'gallery',
  'div_'
])

// [[code]]'s body is literal text ftml treats as raw — a syntax example like
// "[[collapsible ...]]" inside it must not be scanned as a real tag.
const LITERAL_BODY = new Set(['code'])

const TAG_TOKEN_RE = /\[\[(\/?)([*<>=]?[a-zA-Z][\w-]*)\b([^\]]*)\]\]/g

interface TagToken {
  index: number
  end: number
  closing: boolean
  name: string
  params: string
}

function scanTags(source: string): TagToken[] {
  const tokens: TagToken[] = []
  TAG_TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_TOKEN_RE.exec(source))) {
    // part of a [[[SCP-999]]]-style triple-bracket link, not a real tag
    if (source[m.index - 1] === '[') continue
    tokens.push({
      index: m.index,
      end: TAG_TOKEN_RE.lastIndex,
      closing: m[1] === '/',
      name: m[2].toLowerCase(),
      params: m[3]
    })
  }
  return tokens
}

// [[module Rate]] (the rating widget) is self-closing and appears bare on
// nearly every article; other modules like ListPages are paired. Defaults to
// paired, exempting only Rate, so a genuinely unclosed [[module ListPages]]
// block still gets caught instead of silently missed.
function isSelfClosing(tok: TagToken): boolean {
  if (tok.name === 'module') {
    const firstArg = tok.params.trim().split(/\s+/)[0] ?? ''
    return firstArg.toLowerCase() === 'rate'
  }
  return SELF_CLOSING.has(tok.name)
}

// Used by smart-quotes.ts to suppress curly quotes inside an unclosed
// [[code]] block. Backward-only (never looks past `pos`), since a
// forward-looking stack would need the closing [[/code]] to already exist —
// missing the exact case this needs to catch. No stack needed either:
// Wikidot doesn't nest [[code]], so the last code-related token seen is enough.
// `source` must already be escape-masked (see maskInlineEscapes below), or an
// @@[[code]]@@ literal reads as a real, permanently-unclosed open.
export function isInsideLiteralBody(source: string, pos: number): boolean {
  const textBefore = source.slice(0, pos)
  TAG_TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  let inside = false
  while ((m = TAG_TOKEN_RE.exec(textBefore))) {
    if (textBefore[m.index - 1] === '[') continue
    const name = m[2].toLowerCase()
    if (!LITERAL_BODY.has(name)) continue
    inside = m[1] !== '/'
  }
  return inside
}

// @@...@@ is Wikidot's inline escape — a [[tag]] inside it is literal text.
// Blanked rather than removed so reported finding offsets still point at the
// real source.
const INLINE_ESCAPE_RE = /@@[^@\n]*@@/g

export function maskInlineEscapes(source: string): string {
  return source.replace(INLINE_ESCAPE_RE, (match) => ' '.repeat(match.length))
}

export function findUnclosedTags(source: string): TagFinding[] {
  const tokens = scanTags(maskInlineEscapes(source))
  const findings: TagFinding[] = []
  const stack: { name: string; index: number; end: number }[] = []
  let literalUntil: string | null = null

  for (const tok of tokens) {
    if (literalUntil) {
      if (tok.closing && tok.name === literalUntil) {
        literalUntil = null
        stack.pop()
      }
      continue
    }

    if (!tok.closing) {
      if (isSelfClosing(tok)) continue
      stack.push({ name: tok.name, index: tok.index, end: tok.end })
      if (LITERAL_BODY.has(tok.name)) literalUntil = tok.name
      continue
    }

    if (isSelfClosing(tok)) {
      findings.push({
        type: 'orphan-close',
        name: tok.name,
        index: tok.index,
        length: tok.end - tok.index
      })
      continue
    }

    const topIdx = stack.length - 1
    if (topIdx < 0) {
      findings.push({
        type: 'orphan-close',
        name: tok.name,
        index: tok.index,
        length: tok.end - tok.index
      })
      continue
    }
    if (stack[topIdx].name === tok.name) {
      stack.pop()
      continue
    }
    // Nearest-to-top match, not outermost — with repeated tag names (nested
    // divs), the closest open tag is the one this close resolves.
    const matchIdx = stack.map((s) => s.name).lastIndexOf(tok.name)
    if (matchIdx === -1) {
      findings.push({
        type: 'orphan-close',
        name: tok.name,
        index: tok.index,
        length: tok.end - tok.index
      })
    } else {
      findings.push({
        type: 'mismatched-nesting',
        name: tok.name,
        index: tok.index,
        length: tok.end - tok.index,
        expectedName: stack[topIdx].name,
        expectedOpenIndex: stack[topIdx].index
      })
      stack.length = matchIdx
    }
  }

  for (const open of stack) {
    findings.push({
      type: 'unclosed',
      name: open.name,
      index: open.index,
      length: open.end - open.index
    })
  }

  findings.sort((a, b) => a.index - b.index)
  return findings
}
