import type { Diagnostic } from '@codemirror/lint'
import { linter, lintGutter } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import { findUnclosedTags, type TagFinding } from './unclosed-tags'

// Warning, not error: this is a syntactic guess, not a real Wikidot parse —
// ftml is the actual authority on whether a document is broken.
function diagnosticFor(finding: TagFinding): Diagnostic {
  const from = finding.index
  const to = finding.index + finding.length
  let message: string
  switch (finding.type) {
    case 'unclosed':
      message = `Unclosed [[${finding.name}]] — no matching [[/${finding.name}]] found.`
      break
    case 'orphan-close':
      message = `[[/${finding.name}]] doesn't match any open [[${finding.name}]] tag.`
      break
    case 'mismatched-nesting':
      message = `[[/${finding.name}]] closes out of order — [[/${finding.expectedName}]] was expected to close first.`
      break
  }
  return { from, to, severity: 'warning', source: 'unclosed-tags', message }
}

export function unclosedTagsLinter(): Extension {
  return [
    linter((view) => findUnclosedTags(view.state.doc.toString()).map(diagnosticFor)),
    lintGutter()
  ]
}
