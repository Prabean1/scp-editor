// Syntactic bracket-matching heuristic for flagging unclosed/orphaned/
// crossed Wikidot [[tag]]/[[/tag]] pairs in the editor — NOT a Wikidot
// parser. ftml remains the only thing that understands Wikidot semantics;
// this only pattern-matches on tag syntax, closer to how editors highlight
// unmatched parens than to real parsing. Validated against real-shaped SCP
// source (with ftml itself as ground truth) in spike/prototype-unclosed-tags/
// — see docs/adr/0003-unclosed-tag-highlighting-heuristic.md for the
// reasoning behind the choices below, especially the [[module ...]] rule.

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

// Tags whose body is literal text, not markup — [[code]] is the
// well-established case ftml itself treats as raw, so a syntax example
// like "here's what an opening tag looks like: [[collapsible ...]]"
// inside a [[code]] block must not be scanned as a real tag.
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
    // Skip matches that are actually part of a triple-bracket wiki link
    // ([[[SCP-999]]], [[[SCP-1000|display]]]) — those contain a
    // valid-looking double-bracket substring starting one character in.
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

// [[module ...]] can't be classified by tag name alone: [[module Rate]] is
// self-closing (the standard rating widget — appears bare on nearly every
// real article, and wikidot-presubstitute.ts's MODULE_RATE_RE already
// carves it out for the exact same reason), but [[module ListPages]]...
// [[/module]] and most other modules are paired. Defaulting "module" to
// paired and exempting only Rate keeps the overwhelmingly common case
// (Rate) silent while still catching a genuinely unclosed ListPages/
// Watchers/etc. block — the opposite default would silently miss those
// instead, which is the worse failure mode for a feature whose whole job
// is catching forgotten close tags.
function isSelfClosing(tok: TagToken): boolean {
  if (tok.name === 'module') {
    const firstArg = tok.params.trim().split(/\s+/)[0] ?? ''
    return firstArg.toLowerCase() === 'rate'
  }
  return SELF_CLOSING.has(tok.name)
}

// Used by smart-quotes.ts to suppress curly-quote conversion inside a
// [[code]] literal body. Deliberately backward-only (only looks at
// `source.slice(0, pos)`, never past it) rather than a reuse of
// findUnclosedTags's forward-looking stack: that matcher needs a tag's
// closing [[/code]] to already exist to recognize the block, which would
// miss the exact moment this needs to catch — the user still typing inside
// a code block they haven't closed yet. No stack is needed either: Wikidot
// doesn't nest [[code]] blocks (anything inside is literal text, not real
// markup, so the first [[/code]] after an opener always ends it), so the
// last code-related token seen is enough to know the current state.
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

export function findUnclosedTags(source: string): TagFinding[] {
  const tokens = scanTags(source)
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
    // Nearest-to-top match, not outermost — with repeated tag names
    // (e.g. a div nested inside a div), the closest matching open is the
    // one this close tag is actually resolving.
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
