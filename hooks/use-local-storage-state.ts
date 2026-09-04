'use client'

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction
} from 'react'

type LocalStorageStateOptions<T> = {
  readonly key: string
  readonly defaultValue: T
  readonly parse: (value: unknown) => T | null
}

export function useLocalStorageState<T>({
  key,
  defaultValue,
  parse
}: LocalStorageStateOptions<T>): readonly [T, Dispatch<SetStateAction<T>>] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) onStoreChange()
      }
      const eventName = localStorageEventName(key)

      window.addEventListener('storage', onStorage)
      window.addEventListener(eventName, onStoreChange)

      return () => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener(eventName, onStoreChange)
      }
    },
    [key]
  )
  const getSnapshot = useCallback(() => readLocalStorage(key), [key])
  const rawValue = useSyncExternalStore(subscribe, getSnapshot, () => null)
  const value = useMemo(
    () => parseStoredValue(rawValue, parse) ?? defaultValue,
    [defaultValue, parse, rawValue]
  )
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      const currentValue =
        parseStoredValue(readLocalStorage(key), parse) ?? defaultValue
      const resolvedValue =
        typeof nextValue === 'function'
          ? (nextValue as (current: T) => T)(currentValue)
          : nextValue

      try {
        window.localStorage.setItem(key, JSON.stringify(resolvedValue))
      } catch {
        return
      }

      window.dispatchEvent(new Event(localStorageEventName(key)))
    },
    [defaultValue, key, parse]
  )

  return [value, setValue]
}

function readLocalStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function parseStoredValue<T>(
  rawValue: string | null,
  parse: (value: unknown) => T | null
): T | null {
  if (rawValue === null) return null

  try {
    return parse(JSON.parse(rawValue))
  } catch {
    return null
  }
}

function localStorageEventName(key: string) {
  return `local-storage-state:${key}`
}
