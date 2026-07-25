import {
  Bold,
  ChevronDown,
  Code2,
  FilePlus,
  FolderOpen,
  Image as ImageIcon,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageCircle,
  Minus,
  Palette,
  Save,
  SaveAll,
  ShieldAlert,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline
} from 'lucide-react'
import type { ToolbarButton } from './Toolbar'
import type { DocumentHandle } from '../hooks/useDocument'
import RedactionGlyph from './RedactionGlyph'

export interface ToolbarConfigDeps {
  doc: Pick<DocumentHandle, 'new' | 'open' | 'save' | 'saveAs'>
  insertSyntax: (before: string, after?: string) => void
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
    }
  ]

  // Block-level placeholders — dropped in at the cursor, not wrapped around
  // a selection. Lives on the Insert ribbon tab.
  const insertButtons: ToolbarButton[] = [
    {
      label: 'Table',
      title: 'Table row',
      icon: Table,
      action: () => insertSyntax('||', '||content||'),
      richTextSupported: false
    },
    {
      label: 'Collapsible',
      title: 'Collapsible',
      icon: ChevronDown,
      action: () =>
        insertSyntax('[[collapsible show="+ show" hide="- hide"]]\n', '\n[[/collapsible]]'),
      richTextSupported: false
    },
    {
      label: 'Horizontal rule',
      title: 'Horizontal rule',
      icon: Minus,
      action: () => insertSyntax('\n----\n'),
      richTextSupported: false
    },
    {
      label: 'Link',
      title: 'Link ([[[page|text]]])',
      icon: Link2,
      action: () => insertSyntax('[[[', '|text]]]'),
      richTextSupported: false
    },
    {
      label: 'Image',
      title: 'Image ([[image url]])',
      icon: ImageIcon,
      action: () => insertSyntax('[[image ', ']]'),
      richTextSupported: false
    },
    {
      label: 'Addendum',
      title: 'Insert an addendum block',
      icon: MessageCircle,
      action: () =>
        insertSyntax(
          '+ Addendum\n[[collapsible show="+ Show Addendum" hide="- Hide Addendum"]]\nAddendum content goes here.\n[[/collapsible]]\n'
        ),
      richTextSupported: false
    },
    {
      label: 'Interview log',
      title: 'Insert an interview log table',
      icon: Table,
      action: () =>
        insertSyntax(
          '||~ Speaker||~ Dialogue||\n||Dr. ██████||Line of dialogue.||\n||Subject||Response.||\n'
        ),
      richTextSupported: false
    },
    {
      label: 'Incident log',
      title: 'Insert an incident log scaffold',
      icon: FilePlus,
      action: () =>
        insertSyntax(
          '+ Incident Log\n**Date:** ██/██/████\n\n**Involved Personnel:** \n\n**Description of Incident:** \n'
        ),
      richTextSupported: false
    },
    {
      label: 'Danger class display',
      title:
        'Insert an object/danger class bar (starter scaffold — verify params before publishing)',
      icon: ShieldAlert,
      action: () =>
        insertSyntax(
          '[[include :scp-wiki:component:anomaly-class-bar-source\n|item-number=XXXX\n|clearance=3\n|container-class=safe\n|secondary-class=none\n|disruption-class=dark\n|risk-class=notice\n]]\n'
        ),
      richTextSupported: false
    },
    {
      label: 'Redaction',
      title: 'Insert a redaction block (█)',
      icon: RedactionGlyph,
      action: () => insertSyntax('█'),
      richTextSupported: false
    }
  ]

  return { fileButtons, homeButtons, insertButtons }
}
