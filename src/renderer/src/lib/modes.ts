import { Columns2, Eye, PencilLine, Wand2, type LucideIcon } from 'lucide-react'

export type Mode = 'edit' | 'split' | 'preview' | 'wysiwyg'

export const MODES: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: 'edit', label: 'Edit', icon: PencilLine },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'preview', label: 'Preview', icon: Eye },
  { value: 'wysiwyg', label: 'WYSIWYG', icon: Wand2 }
]
