import { useCallback, useState } from 'react'

export interface SettingCodec<T> {
  decode(raw: string | null): T
  encode(value: T): string
}

export function enumCodec<T extends string>(values: readonly T[], fallback: T): SettingCodec<T> {
  return {
    decode: (raw) => (values.includes(raw as T) ? (raw as T) : fallback),
    encode: (value) => value
  }
}

export function numberCodec<T extends number>(values: readonly T[], fallback: T): SettingCodec<T> {
  return {
    decode: (raw) => {
      const parsed = Number(raw)
      return values.includes(parsed as T) ? (parsed as T) : fallback
    },
    encode: (value) => String(value)
  }
}

export function rangeCodec(min: number, max: number, fallback: number): SettingCodec<number> {
  return {
    decode: (raw) => {
      const parsed = Number(raw)
      return parsed >= min && parsed <= max ? parsed : fallback
    },
    encode: (value) => String(value)
  }
}

// All persisted booleans share the 'on'/'off' storage format; only the
// fallback for "never stored yet" differs (see theme.ts's autoClose vs
// smartQuotes).
export function boolCodec(fallback: boolean): SettingCodec<boolean> {
  return {
    decode: (raw) => (raw === null ? fallback : raw === 'on'),
    encode: (value) => (value ? 'on' : 'off')
  }
}

/**
 * `set` persists and updates state — the one call most settings need.
 * `setLocal` updates state only, for callers (like a drag handler) that want
 * live UI feedback without writing on every change; call `set` once at the
 * end to persist.
 */
export function usePersistedSetting<T>(
  key: string,
  codec: SettingCodec<T>,
  onChange?: (value: T) => void
): [T, (next: T) => void, (next: T) => void] {
  const [value, setValue] = useState<T>(() => codec.decode(localStorage.getItem(key)))

  const setLocal = useCallback(
    (next: T) => {
      setValue(next)
      onChange?.(next)
    },
    [onChange]
  )

  const set = useCallback(
    (next: T) => {
      localStorage.setItem(key, codec.encode(next))
      setLocal(next)
    },
    [key, codec, setLocal]
  )

  return [value, set, setLocal]
}
