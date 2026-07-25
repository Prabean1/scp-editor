// PROTOTYPE — throwaway. Answers two questions:
//
// 1. Can pasted typographic artifacts (curly quotes, em/en dashes, ellipsis
//    — the Word/Google Docs autocorrect output the research doc calls out)
//    be normalized back to plain ASCII *without* the directional/mid-typing
//    guards smart-quotes.ts needs (isInsideTagBrackets)? That guard exists
//    there to stop CURLING a quote that's structurally part of `param="x"`
//    syntax. Paste-sanitize only ever moves curly -> straight, which is
//    always the syntactically safe direction, even mid-tag — sample
//    `mid-tag-paste` below checks this holds.
// 2. Does a paste-sanitizing extension need new coordination logic with the
//    existing image-paste handler (image-drop.ts), or does "only handle
//    paste when no image file is present" already make them mutually
//    exclusive by construction? See runPastePipeline + the stubs below.
//
// Pure, no I/O — sanitizeText/isInsideLiteralBody/sanitizePastedText are the
// part worth lifting into a real lib/paste-sanitize.ts if this validates.

const REPLACEMENTS = [
  ['“', '"'], // “
  ['”', '"'], // ”
  ['‘', "'"], // ‘
  ['’', "'"], // ’
  ['–', '-'], // – en dash
  ['—', '--'], // — em dash
  ['…', '...'] // … ellipsis
]

export function sanitizeText(text) {
  const changes = []
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const hit = REPLACEMENTS.find(([from]) => from === ch)
    if (hit) {
      changes.push({ index: i, char: ch, replacement: hit[1] })
      out += hit[1]
    } else {
      out += ch
    }
  }
  return { out, changes }
}

// Same backward-only tag-token walk as unclosed-tags.ts/smart-quotes'
// decide.mjs, narrowed to the [[code]] check — a paste lands at one cursor
// position, so unlike per-character typing this only needs to answer once
// per paste, not per character.
const TAG_TOKEN_RE = /\[\[(\/?)([*<>=]?[a-zA-Z][\w-]*)\b([^\]]*)\]\]/g

export function isInsideLiteralBody(docBefore) {
  TAG_TOKEN_RE.lastIndex = 0
  let m
  let inside = false
  while ((m = TAG_TOKEN_RE.exec(docBefore))) {
    if (docBefore[m.index - 1] === '[') continue
    const closing = m[1] === '/'
    const name = m[2].toLowerCase()
    if (name !== 'code') continue
    inside = !closing
  }
  return inside
}

// mode: 'always' | 'respect-literal-body'
export function sanitizePastedText(docBefore, pasted, mode) {
  if (mode === 'respect-literal-body' && isInsideLiteralBody(docBefore)) {
    return { out: pasted, changes: [], skipped: true }
  }
  return { ...sanitizeText(pasted), skipped: false }
}

// --- handler-ordering simulation -------------------------------------

export function imageDropHandlerStub(clipboard) {
  if (clipboard.hasImageFile) {
    return { handled: true, label: 'image-drop.ts: claimed paste (image file present)', text: '<local:image-marker>' }
  }
  return { handled: false }
}

export function pasteSanitizeHandlerStub(mode) {
  return (clipboard, ctx) => {
    if (clipboard.hasImageFile) return { handled: false }
    const { out, skipped } = sanitizePastedText(ctx.docBefore, clipboard.text, mode)
    return {
      handled: true,
      label: skipped
        ? 'paste-sanitize: skipped (paste lands inside [[code]])'
        : 'paste-sanitize: normalized before insert',
      text: out
    }
  }
}

// Runs handlers in registration order; first one to return handled:true wins
// and the rest never run — mirrors CodeMirror's domEventHandlers precedence.
export function runPastePipeline(handlers, clipboard, ctx) {
  for (const h of handlers) {
    const result = h(clipboard, ctx)
    if (result.handled) return result
  }
  return { handled: false, label: 'default browser paste (unmodified)', text: clipboard.text }
}
