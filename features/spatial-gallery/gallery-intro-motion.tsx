'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react'

type GalleryIntroMotionContextValue = Readonly<{
  inertiaBurst: boolean
  consumeInertiaBurst(): void
  launchInertiaBurst(): void
}>

const defaultContextValue: GalleryIntroMotionContextValue = {
  inertiaBurst: false,
  consumeInertiaBurst: () => undefined,
  launchInertiaBurst: () => undefined
}

const GalleryIntroMotionContext =
  createContext<GalleryIntroMotionContextValue>(defaultContextValue)

export function GalleryIntroMotionProvider({
  children
}: {
  readonly children: ReactNode
}) {
  const [inertiaBurst, setInertiaBurst] = useState(false)
  const consumeInertiaBurst = useCallback(() => setInertiaBurst(false), [])
  const launchInertiaBurst = useCallback(() => setInertiaBurst(true), [])
  const value = useMemo(
    () => ({ consumeInertiaBurst, inertiaBurst, launchInertiaBurst }),
    [consumeInertiaBurst, inertiaBurst, launchInertiaBurst]
  )

  return (
    <GalleryIntroMotionContext.Provider value={value}>
      {children}
    </GalleryIntroMotionContext.Provider>
  )
}

export function useGalleryIntroMotion() {
  return useContext(GalleryIntroMotionContext)
}
