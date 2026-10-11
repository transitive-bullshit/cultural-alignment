import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const observer = vi.hoisted(() => ({
  notifications: 0,
  server: false,
  subscribed: false
}))

// This harness observes the store contract. The browser journey exercises
// React hydration and pointer/keyboard wiring with the real hook and control.
vi.mock('react', () => ({
  useSyncExternalStore<T>(
    subscribe: (listener: () => void) => () => void,
    getClientSnapshot: () => T,
    getServerSnapshot: () => T
  ) {
    if (observer.server) return getServerSnapshot()
    if (!observer.subscribed) {
      subscribe(() => {
        observer.notifications += 1
      })
      observer.subscribed = true
    }
    return getClientSnapshot()
  }
}))

const storageKey = 'cultural-alignment:gallery-item-size:v1'
let preference: typeof import('./gallery-item-size-preference')
let events: EventTarget
let stored: Map<string, string>
let storage: {
  getItem: ReturnType<typeof vi.fn<(key: string) => string | null>>
  removeItem: ReturnType<typeof vi.fn<(key: string) => void>>
  setItem: ReturnType<typeof vi.fn<(key: string, value: string) => void>>
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  Object.assign(observer, {
    notifications: 0,
    server: false,
    subscribed: false
  })
  events = new EventTarget()
  stored = new Map([[storageKey, '110']])
  storage = {
    getItem: vi.fn<(key: string) => string | null>(
      (key) => stored.get(key) ?? null
    ),
    removeItem: vi.fn<(key: string) => void>((key) => {
      stored.delete(key)
    }),
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      stored.set(key, value)
    })
  }
  vi.stubGlobal('window', {
    addEventListener: events.addEventListener.bind(events),
    localStorage: storage,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  })
  preference = await import('./gallery-item-size-preference')
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function read() {
  return preference.useGalleryItemSizePreference()
}

function remotePreference(value: string) {
  events.dispatchEvent(
    Object.assign(new Event('storage'), {
      key: storageKey,
      newValue: value,
      storageArea: storage
    })
  )
}

describe('gallery item-size preference store', () => {
  it('offers a default server snapshot and restores the stored client value', () => {
    observer.server = true
    expect(read()).toEqual({
      hydrated: false,
      itemSize: 100,
      itemSizeTransition: 'instant'
    })
    observer.server = false
    expect(read()).toEqual({
      hydrated: true,
      itemSize: 110,
      itemSizeTransition: 'instant'
    })
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('debounces live changes and persists only the most recent size', () => {
    read()
    preference.setGalleryItemSizePreference(120, 'smooth')
    expect(read()).toEqual({
      hydrated: true,
      itemSize: 120,
      itemSizeTransition: 'smooth'
    })
    vi.advanceTimersByTime(249)
    expect(stored.get(storageKey)).toBe('110')
    preference.setGalleryItemSizePreference(130, 'smooth')
    vi.advanceTimersByTime(249)
    expect(storage.setItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(stored.get(storageKey)).toBe('130')
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(storageKey, '130')
  })

  it('changes transition state without scheduling another storage write', () => {
    read()
    preference.setGalleryItemSizePreference(120, 'smooth')
    vi.advanceTimersByTime(250)
    storage.setItem.mockClear()
    preference.setGalleryItemSizeTransition('instant')
    expect(read()).toEqual({
      hydrated: true,
      itemSize: 120,
      itemSizeTransition: 'instant'
    })
    vi.advanceTimersByTime(250)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('keeps pending local changes over storage events and accepts later remote changes', () => {
    read()
    preference.setGalleryItemSizePreference(120, 'smooth')
    remotePreference('90')
    expect(read()).toEqual({
      hydrated: true,
      itemSize: 120,
      itemSizeTransition: 'smooth'
    })
    vi.advanceTimersByTime(250)
    expect(stored.get(storageKey)).toBe('120')
    remotePreference('90')
    expect(read()).toEqual({
      hydrated: true,
      itemSize: 90,
      itemSizeTransition: 'instant'
    })
  })

  it('flushes pending changes on pagehide without notifying or writing twice', () => {
    read()
    preference.setGalleryItemSizePreference(115)
    const notifications = observer.notifications
    events.dispatchEvent(new Event('pagehide'))
    expect(stored.get(storageKey)).toBe('115')
    expect(observer.notifications).toBe(notifications)
    vi.advanceTimersByTime(250)
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(storageKey, '115')
  })

  it('removes the stored override when the default size is restored', () => {
    read()
    preference.setGalleryItemSizePreference(100)
    vi.advanceTimersByTime(250)
    expect(stored.has(storageKey)).toBe(false)
    expect(storage.removeItem).toHaveBeenCalledExactlyOnceWith(storageKey)
  })
})
