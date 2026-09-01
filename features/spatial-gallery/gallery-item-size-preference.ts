'use client'

import { useSyncExternalStore } from 'react'

import {
  GALLERY_ITEM_SIZE_DEFAULT,
  normalizeGalleryItemSize,
  parseStoredGalleryItemSize
} from './gallery-sizing'

export const GALLERY_ITEM_SIZE_STORAGE_KEY =
  'cultural-alignment:gallery-item-size:v1'

const PERSIST_DEBOUNCE_MILLISECONDS = 250
const SERVER_SNAPSHOT = {
  hydrated: false,
  itemSize: GALLERY_ITEM_SIZE_DEFAULT,
  itemSizeTransition: 'instant'
} as const

export type GalleryItemSizeTransition = 'instant' | 'smooth'

type GalleryItemSizeSnapshot = Readonly<{
  hydrated: boolean
  itemSize: number
  itemSizeTransition: GalleryItemSizeTransition
}>

const listeners = new Set<() => void>()
let clientSnapshot: GalleryItemSizeSnapshot | null = null
let globalListenersAttached = false
let pendingItemSize: number | null = null
let persistenceTimer: number | null = null

export function useGalleryItemSizePreference() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}

export function setGalleryItemSizePreference(
  value: number,
  itemSizeTransition: GalleryItemSizeTransition = 'instant'
) {
  const itemSize = normalizeGalleryItemSize(value)
  const currentSnapshot = getClientSnapshot()
  const itemSizeChanged = currentSnapshot.itemSize !== itemSize

  if (
    itemSizeChanged ||
    currentSnapshot.itemSizeTransition !== itemSizeTransition
  ) {
    clientSnapshot = { hydrated: true, itemSize, itemSizeTransition }
    notifyListeners()
  }

  if (itemSizeChanged) schedulePreferencePersistence(itemSize)
}

export function setGalleryItemSizeTransition(
  itemSizeTransition: GalleryItemSizeTransition
) {
  const currentSnapshot = getClientSnapshot()
  if (currentSnapshot.itemSizeTransition === itemSizeTransition) return

  clientSnapshot = { ...currentSnapshot, itemSizeTransition }
  notifyListeners()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  attachGlobalListeners()

  return () => listeners.delete(listener)
}

function getServerSnapshot(): GalleryItemSizeSnapshot {
  return SERVER_SNAPSHOT
}

function getClientSnapshot(): GalleryItemSizeSnapshot {
  if (clientSnapshot === null) {
    clientSnapshot = {
      hydrated: true,
      itemSize: readStoredPreference(),
      itemSizeTransition: 'instant'
    }
  }

  return clientSnapshot
}

function readStoredPreference() {
  try {
    return parseStoredGalleryItemSize(
      window.localStorage.getItem(GALLERY_ITEM_SIZE_STORAGE_KEY)
    )
  } catch {
    return GALLERY_ITEM_SIZE_DEFAULT
  }
}

function schedulePreferencePersistence(itemSize: number) {
  pendingItemSize = itemSize
  if (persistenceTimer !== null) window.clearTimeout(persistenceTimer)

  persistenceTimer = window.setTimeout(
    persistPendingPreference,
    PERSIST_DEBOUNCE_MILLISECONDS
  )
}

function persistPendingPreference() {
  if (persistenceTimer !== null) window.clearTimeout(persistenceTimer)
  persistenceTimer = null

  const itemSize = pendingItemSize
  pendingItemSize = null
  if (itemSize === null) return

  try {
    if (itemSize === GALLERY_ITEM_SIZE_DEFAULT) {
      window.localStorage.removeItem(GALLERY_ITEM_SIZE_STORAGE_KEY)
    } else {
      window.localStorage.setItem(
        GALLERY_ITEM_SIZE_STORAGE_KEY,
        String(itemSize)
      )
    }
  } catch {
    // The live preference still works when storage is unavailable.
  }
}

function attachGlobalListeners() {
  if (globalListenersAttached) return

  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('pagehide', persistPendingPreference)
  globalListenersAttached = true
}

function handleStorageChange(event: StorageEvent) {
  let storage: Storage

  try {
    storage = window.localStorage
  } catch {
    return
  }

  if (
    event.storageArea !== storage ||
    (event.key !== GALLERY_ITEM_SIZE_STORAGE_KEY && event.key !== null)
  ) {
    return
  }

  // A local edit that has not reached storage yet is newer from this tab's
  // perspective. Let it win and publish on its existing debounce instead of
  // allowing a slower cross-tab write to discard it.
  if (pendingItemSize !== null) return

  const itemSize = parseStoredGalleryItemSize(event.newValue)
  if (getClientSnapshot().itemSize === itemSize) return

  clientSnapshot = {
    hydrated: true,
    itemSize,
    itemSizeTransition: 'instant'
  }
  notifyListeners()
}

function notifyListeners() {
  for (const listener of listeners) listener()
}
