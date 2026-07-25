// PROTOTYPE — throwaway. Scenarios picked to stress the two questions in
// decide.mjs: paste-time typographic contamination in real trouble spots
// (tag params, mid-tag), and the interaction with image-paste handling.

export const SAMPLES = [
  {
    name: 'div-param-curly-quotes',
    note: 'The exact failure mode from the research doc: pasting a [[div class="..."]] block copied out of Word/Docs, where autocorrect already curled the attribute quotes. Expect: both curly quotes -> straight, div param becomes valid.',
    docBefore: '',
    pasted: '[[div class="blockquote"]]\nQuoted from an email.\n[[/div]]',
    hasImageFile: false
  },
  {
    name: 'prose-with-dashes-and-ellipsis',
    note: 'Ordinary narrative prose pasted from a word processor — em dash, curly quotes, ellipsis all present. No tag syntax at risk here, just normalizing typography.',
    docBefore: '',
    pasted: 'The creature—unnervingly calm—said “I know what you are…”',
    hasImageFile: false
  },
  {
    name: 'mid-tag-paste',
    note: "Cursor already sits after `[[div class=`, mid-tag, and the paste supplies the rest including the closing curly quotes. smart-quotes.ts's isInsideTagBrackets guard would suppress conversion here (correct for its job: don't curl a fresh keystroke) — but paste-sanitize must NOT reuse that guard, since leaving the curly quotes in would break the tag. Expect: sanitized regardless of being mid-tag.",
    docBefore: '[[div class=',
    pasted: '“blockquote”]]\nBody text.',
    hasImageFile: false
  },
  {
    name: 'paste-inside-code-block',
    note: 'Paste lands inside an open [[code]] block showing literal example syntax with intentionally-curly quotes (e.g. a formatting guide demonstrating the exact bug). This is where "always" vs "respect-literal-body" mode actually differ — toggle [g] to compare.',
    docBefore: 'Example syntax:\n\n[[code]]\n',
    pasted: '[[span style=“color:red”]]Warning[[/span]]',
    hasImageFile: false
  },
  {
    name: 'paste-already-straight',
    note: 'Idempotency check: plain ASCII already, nothing a word processor touched. Expect: zero changes, output identical to input.',
    docBefore: '',
    pasted: '"Already fine," she said.',
    hasImageFile: false
  },
  {
    name: 'image-clipboard-item',
    note: 'Clipboard carries an image file (e.g. copied screenshot), not text. Tests handler ordering: image-drop.ts should claim the paste and the text sanitizer must never run, regardless of mode.',
    docBefore: '',
    pasted: '',
    hasImageFile: true
  }
]
