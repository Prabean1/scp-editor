import { createHash } from 'crypto'

export function hashFilePath(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex')
}
