import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const externalStoreTestState = vi.hoisted(() => ({
  notifications: 0,
  server: false,
  subscribed: false
}))

vi.mock('react', () => ({
  useSyncExternalStore<T>(
    subscribe: (listener: () => void) => () => void,
    getClientSnapshot: () => T,
    getServerSnapshot: () => T
  ) {
    if (externalStoreTestState.server) return getServerSnapshot()

    if (!externalStoreTestState.subscribed) {
      subscribe(() => {
        externalStoreTestState.notifications += 1
      })
      externalStoreTestState.subscribed = true
    }
    return getClientSnapshot()
  }
}))

import {
  GALLERY_ITEM_SIZE_STORAGE_KEY,
  setGalleryItemSizePreference,
  setGalleryItemSizeTransition,
  useGalleryItemSizePreference
} from './gallery-item-size-preference'

describe('gallery item-size preference snapshots', () => {
  const windowListeners = new Map<string, EventListener>()
  const storedValues = new Map([[GALLERY_ITEM_SIZE_STORAGE_KEY, '110']])
  const storage = {
    getItem: vi.fn<(key: string) => string | null>(
      (key) => storedValues.get(key) ?? null
    ),
    removeItem: vi.fn<(key: string) => void>((key) => {
      storedValues.delete(key)
    }),
    setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
      storedValues.set(key, value)
    })
  } as unknown as Storage

  beforeAll(() => {
    vi.stubGlobal('window', {
      addEventListener(type: string, listener: EventListener) {
        windowListeners.set(type, listener)
      },
      clearTimeout: vi.fn<(timer: number) => void>(),
      localStorage: storage,
      setTimeout: vi.fn<() => number>(() => 1)
    })
  })

  afterAll(() => vi.unstubAllGlobals())

  it('requests motion only for pointer-originated size changes', () => {
    externalStoreTestState.server = true
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: false,
      itemSize: 100,
      itemSizeTransition: 'instant'
    })

    externalStoreTestState.server = false
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: true,
      itemSize: 110,
      itemSizeTransition: 'instant'
    })

    setGalleryItemSizePreference(120, 'smooth')
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: true,
      itemSize: 120,
      itemSizeTransition: 'smooth'
    })

    const persistenceCallsAfterSizeChange = vi.mocked(window.setTimeout).mock
      .calls.length
    setGalleryItemSizeTransition('instant')
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: true,
      itemSize: 120,
      itemSizeTransition: 'instant'
    })
    expect(vi.mocked(window.setTimeout)).toHaveBeenCalledTimes(
      persistenceCallsAfterSizeChange
    )

    setGalleryItemSizeTransition('smooth')

    windowListeners.get('storage')?.({
      key: GALLERY_ITEM_SIZE_STORAGE_KEY,
      newValue: '90',
      storageArea: storage
    } as unknown as Event)
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: true,
      itemSize: 120,
      itemSizeTransition: 'smooth'
    })

    const notificationsAfterPointerChange = externalStoreTestState.notifications
    windowListeners.get('pagehide')?.({} as Event)
    expect(storedValues.get(GALLERY_ITEM_SIZE_STORAGE_KEY)).toBe('120')
    expect(externalStoreTestState.notifications).toBe(
      notificationsAfterPointerChange
    )

    setGalleryItemSizePreference(115)
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: true,
      itemSize: 115,
      itemSizeTransition: 'instant'
    })

    windowListeners.get('pagehide')?.({} as Event)

    windowListeners.get('storage')?.({
      key: GALLERY_ITEM_SIZE_STORAGE_KEY,
      newValue: '90',
      storageArea: storage
    } as unknown as Event)
    expect(useGalleryItemSizePreference()).toEqual({
      hydrated: true,
      itemSize: 90,
      itemSizeTransition: 'instant'
    })
  })
})
