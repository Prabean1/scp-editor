import { describe, expect, it } from 'vitest'
import type { Node as PMNode } from '@tiptap/pm/model'
import { rawTextWithCaret } from './richtext-blocks'
import type { PmNode } from './ftml-ast'

// rawTextWithCaret only calls node.toJSON() — a duck-typed stand-in avoids building a real
// ProseMirror schema/Node just to exercise this pure serialization logic.
function fakeNode(json: PmNode): PMNode {
  return { toJSON: () => json } as unknown as PMNode
}

describe('rawTextWithCaret', () => {
  it('places the caret inside a bold run, merged with the surrounding mark syntax', () => {
    const node = fakeNode({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'bold text', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' end' }
      ]
    })
    const { raw, offset } = rawTextWithCaret(node, 8) // 6 ("Hello ") + 2 ("bo")
    expect(raw).toBe('Hello **bold text** end')
    expect(raw.slice(0, offset) + '|' + raw.slice(offset)).toBe('Hello **bo|ld text** end')
  })

  it('places the caret inside a link label without losing the surrounding [[[url|...]]] syntax', () => {
    const node = fakeNode({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Click ' },
        { type: 'text', text: 'here now', marks: [{ type: 'link', attrs: { href: 'http://x' } }] },
        { type: 'text', text: ' please' }
      ]
    })
    const { raw, offset } = rawTextWithCaret(node, 10) // 6 ("Click ") + 4 ("here")
    expect(raw).toBe('Click [[[http://x|here now]]] please')
    expect(raw.slice(0, offset) + '|' + raw.slice(offset)).toBe(
      'Click [[[http://x|here| now]]] please'
    )
  })

  it('places the caret right after a link, outside its closing syntax, not nested inside it', () => {
    const node = fakeNode({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Click ' },
        { type: 'text', text: 'here now', marks: [{ type: 'link', attrs: { href: 'http://x' } }] },
        { type: 'text', text: ' please' }
      ]
    })
    const { raw, offset } = rawTextWithCaret(node, 14) // 6 ("Click ") + 8 ("here now")
    expect(raw).toBe('Click [[[http://x|here now]]] please')
    expect(raw.slice(0, offset) + '|' + raw.slice(offset)).toBe(
      'Click [[[http://x|here now]]]| please'
    )
  })

  it('places the caret right before a link, outside its opening syntax, not nested inside it', () => {
    const node = fakeNode({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'here now', marks: [{ type: 'link', attrs: { href: 'http://x' } }] },
        { type: 'text', text: ' please' }
      ]
    })
    const { raw, offset } = rawTextWithCaret(node, 0) // right at the start of the link run
    expect(raw).toBe('[[[http://x|here now]]] please')
    expect(raw.slice(0, offset) + '|' + raw.slice(offset)).toBe('|[[[http://x|here now]]] please')
  })

  it('places the caret right before a hardBreak', () => {
    const node = fakeNode({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Line one' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line two' }
      ]
    })
    const { raw, offset } = rawTextWithCaret(node, 8) // end of "Line one"
    expect(raw).toBe('Line one\nLine two')
    expect(offset).toBe(8)
  })

  it('accounts for heading syntax when placing the caret', () => {
    const node = fakeNode({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Hello World' }]
    })
    const { raw, offset } = rawTextWithCaret(node, 6) // after "Hello "
    expect(raw).toBe('++ Hello World')
    expect(raw.slice(0, offset) + '|' + raw.slice(offset)).toBe('++ Hello |World')
  })

  it('returns an empty raw string with offset 0 for an empty paragraph', () => {
    const node = fakeNode({ type: 'paragraph', content: [] })
    const { raw, offset } = rawTextWithCaret(node, 0)
    expect(raw).toBe('')
    expect(offset).toBe(0)
  })
})
