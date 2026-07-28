import {
  Asterisk,
  AtSign,
  Bold,
  Brush,
  ChevronDown,
  ChevronsDown,
  Code2,
  Columns3,
  ExternalLink,
  FilePlus,
  Film,
  FolderOpen,
  Grid3x3,
  Highlighter,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Italic,
  Link2,
  List,
  ListEnd,
  ListOrdered,
  MessageCircle,
  MessageSquareQuote,
  Minus,
  Palette,
  Quote,
  Save,
  SaveAll,
  ShieldAlert,
  SquareArrowOutUpRight,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TextQuote,
  Underline
} from 'lucide-react'
import type { ToolbarButton } from './Toolbar'
import type { DocumentHandle } from '../hooks/useDocument'
import RedactionGlyph from './RedactionGlyph'

export interface ToolbarConfigDeps {
  doc: Pick<DocumentHandle, 'new' | 'open' | 'save' | 'saveAs'>
  insertSyntax: (before: string, after?: string) => void
  prefixLines: (prefix: string) => void
  onShowPageInfo: () => void
}

export interface ToolbarButtonGroups {
  fileButtons: ToolbarButton[]
  homeButtons: ToolbarButton[]
  insertButtons: ToolbarButton[]
}

export function createToolbarButtons({
  doc,
  insertSyntax,
  prefixLines,
  onShowPageInfo
}: ToolbarConfigDeps): ToolbarButtonGroups {
  const fileButtons: ToolbarButton[] = [
    { label: 'New', title: 'New (Ctrl+N)', icon: FilePlus, action: () => doc.new() },
    { label: 'Open', title: 'Open… (Ctrl+O)', icon: FolderOpen, action: () => doc.open() },
    { label: 'Save', title: 'Save (Ctrl+S)', icon: Save, action: () => doc.save() },
    {
      label: 'Save As',
      title: 'Save As… (Ctrl+Shift+S)',
      icon: SaveAll,
      action: () => doc.saveAs()
    },
    {
      label: 'Page Info',
      title: 'Edit page metadata',
      icon: Info,
      action: onShowPageInfo
    }
  ]

  // Inline formatting for the Home tab, not the block-level insertButtons below.
  const homeButtons: ToolbarButton[] = [
    {
      label: 'Colour',
      title: 'Insert coloured text (##red|…##)',
      icon: Palette,
      action: () => insertSyntax('##red|', '##'),
      richTextSupported: false
    },
    { label: 'Bold', title: 'Bold', icon: Bold, action: () => insertSyntax('**', '**') },
    { label: 'Italic', title: 'Italic', icon: Italic, action: () => insertSyntax('//', '//') },
    {
      label: 'Underline',
      title: 'Underline',
      icon: Underline,
      action: () => insertSyntax('__', '__')
    },
    {
      label: 'Strikethrough',
      title: 'Strikethrough',
      icon: Strikethrough,
      action: () => insertSyntax('--', '--')
    },
    {
      label: 'Inline code',
      title: 'Inline code ({{…}})',
      icon: Code2,
      action: () => insertSyntax('{{', '}}'),
      richTextSupported: false
    },
    {
      label: 'Bulleted list',
      title: 'Bulleted list',
      icon: List,
      action: () => insertSyntax('* '),
      richTextSupported: false
    },
    {
      label: 'Numbered list',
      title: 'Numbered list',
      icon: ListOrdered,
      action: () => insertSyntax('# '),
      richTextSupported: false
    },
    {
      label: 'Subscript',
      title: 'Subscript (,,…,,)',
      icon: Subscript,
      action: () => insertSyntax(',,', ',,')
    },
    {
      label: 'Superscript',
      title: 'Superscript (^^…^^)',
      icon: Superscript,
      action: () => insertSyntax('^^', '^^')
    },
    {
      label: 'Custom span',
      title: 'Custom styled span ([[span style="..."]])',
      icon: Highlighter,
      action: () => insertSyntax('[[span style="color:red"]]', '[[/span]]'),
      richTextSupported: false
    },
    {
      label: 'Escape parsing',
      title: 'Escape parsing (@@literal text@@)',
      icon: AtSign,
      action: () => insertSyntax('@@', '@@'),
      richTextSupported: false
    }
  ]

  // Block-level placeholders — dropped in at the cursor, not wrapped around
  // a selection. Lives on the Insert ribbon tab.
  const insertButtons: ToolbarButton[] = [
    {
      label: 'Table',
      title: 'Table (spec-shaped starter grid)',
      icon: Table,
      action: () => insertSyntax('\n||~ Header ||~ Header ||\n|| cell || cell ||\n')
    },
    {
      label: 'Manual table',
      title: 'Manual table layout ([[table]]) — for colspan/rowspan/rich cell content',
      icon: Grid3x3,
      action: () =>
        insertSyntax(
          '[[table class="wiki-content-table"]]\n' +
            '[[row]]\n[[hcell]]Header[[/hcell]]\n[[hcell]]Header[[/hcell]]\n[[/row]]\n' +
            '[[row]]\n[[cell]]Cell[[/cell]]\n[[cell]]Cell[[/cell]]\n[[/row]]\n' +
            '[[/table]]\n'
        )
    },
    {
      label: 'Collapsible',
      title: 'Collapsible',
      icon: ChevronDown,
      action: () =>
        insertSyntax('[[collapsible show="+ show" hide="- hide"]]\n', '\n[[/collapsible]]')
    },
    {
      label: 'Collapsible (long)',
      title: 'Collapsible with a repeated hide link at the bottom (hideLocation="both")',
      icon: ChevronsDown,
      action: () =>
        insertSyntax(
          '[[collapsible show="+ show" hide="- hide" hideLocation="both"]]\n',
          '\n[[/collapsible]]'
        )
    },
    {
      label: 'Horizontal rule',
      title: 'Horizontal rule',
      icon: Minus,
      action: () => insertSyntax('\n----\n')
    },
    {
      label: 'Link',
      title: 'Internal link ([[[page|text]]]; [[[page|]]] uses the page name as the title)',
      icon: Link2,
      action: () => insertSyntax('[[[', '|text]]]')
    },
    {
      label: 'External link',
      title: 'External link ([url text])',
      icon: ExternalLink,
      action: () => insertSyntax('[', ' text]')
    },
    {
      label: 'External link (new tab)',
      title: 'External link, opens in a new tab (*url or [*url text])',
      icon: SquareArrowOutUpRight,
      action: () => insertSyntax('[*', ' text]')
    },
    {
      label: 'Styled link',
      title: 'Custom-styled link ([[a href="..." style="..."]])',
      icon: Brush,
      action: () => insertSyntax('[[a href="URL" style="color:green"]]', '[[/a]]')
    },
    {
      label: 'Quote',
      title: 'Quote block (prefixes each selected line with "> ")',
      icon: TextQuote,
      action: () => prefixLines('> '),
      richTextSupported: false
    },
    {
      label: 'Quote block (code-friendly)',
      title:
        'Div-based quoteblock ([[div class="blockquote"]]) — supports code and nested blocks that plain ">" quoting can\'t',
      icon: MessageSquareQuote,
      action: () => insertSyntax('[[div class="blockquote"]]\n', '\n[[/div]]')
    },
    {
      label: 'Tabs',
      title: 'Tabbed view ([[tabview]])',
      icon: Columns3,
      action: () =>
        insertSyntax(
          '[[tabview]]\n' +
            '[[tab First]]\nFirst tab content.\n[[/tab]]\n' +
            '[[tab Second]]\nSecond tab content.\n[[/tab]]\n' +
            '[[/tabview]]\n'
        )
    },
    {
      label: 'Image',
      title: 'Image (component:image-block include — the documented wiki-syntax method)',
      icon: ImageIcon,
      action: () =>
        insertSyntax(
          '[[include component:image-block\n' +
            '|name=filename.jpg\n' +
            '|caption=Caption text\n' +
            '|width=300px\n' +
            '|align=right\n' +
            '|alt-text=Describe the image\n' +
            ']]\n'
        )
    },
    {
      label: 'Image (direct URL)',
      title: "Image via ftml's native [[image url]] tag — no include-block scaffolding",
      icon: ImagePlus,
      action: () => insertSyntax('[[image ', ']]')
    },
    {
      label: 'Footnote',
      title: 'Footnote ([[footnote]])',
      icon: Asterisk,
      action: () => insertSyntax('[[footnote]]', '[[/footnote]]')
    },
    {
      label: 'Footnote block',
      title: 'Footnote list position marker ([[footnoteblock]])',
      icon: ListEnd,
      action: () => insertSyntax('[[footnoteblock]]\n')
    },
    {
      label: 'Audio/Video',
      title: 'HTML5 audio/video player include (:snippets:html5player)',
      icon: Film,
      action: () =>
        insertSyntax(
          '[[include :snippets:html5player\n' + '|type=audio\n' + '|url=\n' + ']]\n'
        )
    },
    {
      label: 'Addendum',
      title: 'Insert an addendum block',
      icon: MessageCircle,
      action: () =>
        insertSyntax(
          '+ Addendum\n[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]\nAddendum content goes here.\n[[/collapsible]]\n'
        )
    },
    {
      label: 'Interview log',
      title: 'Insert an interview log (dashed box, like a real interview transcript)',
      icon: Quote,
      action: () =>
        insertSyntax(
          '**Interview Log**\n\n' +
            '**Interviewer:** Dr. ██████\n' +
            '**Interviewed:** ██████████\n\n' +
            '> <Begin Log>\n' +
            '>\n' +
            '> **Dr. ██████:** Question goes here.\n' +
            '>\n' +
            '> **██████████:** Response goes here.\n' +
            '>\n' +
            '> <End Log>\n'
        )
    },
    {
      label: 'Incident log',
      title: 'Insert an incident log scaffold',
      icon: FilePlus,
      action: () =>
        insertSyntax(
          '+ Incident Log\n**Date:** ██/██/████\n\n**Involved Personnel:** \n\n**Description of Incident:** \n'
        )
    },
    {
      label: 'Danger class display',
      title:
        'Insert an object/danger class bar (starter scaffold — verify params before publishing)',
      icon: ShieldAlert,
      action: () =>
        insertSyntax(
          '[[include :scp-wiki:component:anomaly-class-bar-source\n|item-number=XXXX\n|clearance=3\n|container-class=safe\n|secondary-class=none\n|disruption-class=dark\n|risk-class=notice\n]]\n'
        )
    },
    {
      label: 'Redaction',
      title: 'Insert a redaction block (█)',
      icon: RedactionGlyph,
      action: () => insertSyntax('█')
    }
  ]

  return { fileButtons, homeButtons, insertButtons }
}
