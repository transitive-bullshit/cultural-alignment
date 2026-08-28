'use client'

import { useEffect, useId, useState } from 'react'

import styles from './spoiler-warning.module.css'

const STORAGE_KEY = 'cultural-alignment:spoiler-warning:v2'

export function SpoilerWarning({ className }: { readonly className?: string }) {
  const [visible, setVisible] = useState<boolean | null>(null)
  const pathId = useId().replaceAll(':', '')

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'dismissed')
    } catch {
      setVisible(true)
    }
  }, [])

  if (visible !== true) return null

  const dismiss = () => {
    setVisible(false)

    try {
      window.localStorage.setItem(STORAGE_KEY, 'dismissed')
    } catch {
      // The dismissal remains valid for this page view when storage is blocked.
    }
  }

  return (
    <button
      className={[styles.sticker, className].filter(Boolean).join(' ')}
      data-spoiler-warning
      type='button'
      onClick={dismiss}
      aria-label='Dismiss spoiler warning'
    >
      <span className={styles.orbit} aria-hidden='true'>
        <svg viewBox='0 0 100 100'>
          <defs>
            <path
              id={pathId}
              d='M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0'
            />
          </defs>
          <text>
            <textPath href={`#${pathId}`} startOffset='0%'>
              Spoiler warning · scenes first · good parts ahead ·
            </textPath>
          </text>
        </svg>
      </span>
      <strong aria-hidden='true'>Spoilers</strong>
      <span className={styles.dismissCue} aria-hidden='true'>
        Dismiss
      </span>
    </button>
  )
}
