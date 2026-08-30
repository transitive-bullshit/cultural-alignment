'use client'

import { useEffect, useId, useState } from 'react'

import styles from './spoiler-warning.module.css'

const STORAGE_KEY = 'cultural-alignment:spoiler-warning:v2'

type WarningPhase = 'warning' | 'noted' | 'leaving'

export function SpoilerWarning({ className }: { readonly className?: string }) {
  const [visible, setVisible] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<WarningPhase>('warning')
  const pathId = `spoiler-warning-${useId().replaceAll(':', '')}`

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) !== 'dismissed')
    } catch {
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    if (phase === 'noted') {
      const timeout = window.setTimeout(() => setPhase('leaving'), 1000)
      return () => window.clearTimeout(timeout)
    }

    if (phase === 'leaving') {
      const timeout = window.setTimeout(() => setVisible(false), 240)
      return () => window.clearTimeout(timeout)
    }
  }, [phase])

  if (visible !== true) return null

  const acknowledge = () => {
    setPhase('noted')

    try {
      window.localStorage.setItem(STORAGE_KEY, 'dismissed')
    } catch {
      // The dismissal remains valid for this page view when storage is blocked.
    }
  }

  return (
    <>
      <button
        className={[styles.note, className].filter(Boolean).join(' ')}
        data-spoiler-warning
        data-state={phase}
        type='button'
        disabled={phase !== 'warning'}
        aria-label={
          phase === 'warning'
            ? 'Acknowledge spoiler warning: key plot details appear throughout this archive'
            : 'Spoiler warning acknowledged'
        }
        onClick={acknowledge}
      >
        <span className={styles.panel} aria-hidden='true'>
          <span className={styles.warningCopy}>
            <span className={styles.eyebrow}>Spoiler warning</span>
            <strong>Key plot details appear throughout this archive.</strong>
            <span className={styles.action}>
              I’m okay with spoilers&nbsp; →
            </span>
          </span>

          <span className={styles.confirmation}>
            <span className={styles.confirmationMark}>✓</span>
            <span>
              <strong>Spoilers noted</strong>
              <small>Warning acknowledged</small>
            </span>
          </span>
        </span>

        <span className={styles.seal} aria-hidden='true'>
          <span className={styles.orbit}>
            <svg viewBox='0 0 100 100'>
              <defs>
                <path
                  id={pathId}
                  d='M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0'
                />
              </defs>
              <text>
                <textPath
                  href={`#${pathId}`}
                  startOffset='16.667%'
                  textAnchor='middle'
                >
                  Spoiler warning
                </textPath>
                <textPath
                  href={`#${pathId}`}
                  startOffset='50%'
                  textAnchor='middle'
                >
                  Spoiler warning
                </textPath>
                <textPath
                  href={`#${pathId}`}
                  startOffset='83.333%'
                  textAnchor='middle'
                >
                  Spoiler warning
                </textPath>
              </text>
            </svg>
          </span>
        </span>
      </button>

      <span className={styles.srOnly} aria-live='polite'>
        {phase === 'warning' ? '' : 'Spoiler warning acknowledged'}
      </span>
    </>
  )
}
