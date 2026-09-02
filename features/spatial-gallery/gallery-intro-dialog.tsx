'use client'

import { ArrowRightIcon } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { focalPointToObjectPosition } from '@/lib/media/crop'

import styles from './gallery-intro-dialog.module.css'
import { useGalleryIntroMotion } from './gallery-intro-motion'
import type { GalleryIntroExample } from './types'

const STORAGE_KEY = 'cultural-alignment:gallery-intro:v1'
const ACKNOWLEDGED_VALUE = 'acknowledged'
const EXPLICITLY_DISMISSED_VALUE = 'explicitly-dismissed'

type GalleryIntroState = 'checking' | 'visible' | 'dismissed'
type GalleryIntroAcknowledgement = 'none' | 'acknowledged' | 'explicit'
type GalleryIntroDismissal = Exclude<GalleryIntroAcknowledgement, 'none'>

export type GalleryIntroMode = 'landing' | 'once'

let sessionAcknowledgement: GalleryIntroAcknowledgement = 'none'

export function GalleryIntroDialog({
  example,
  mode
}: {
  readonly example: GalleryIntroExample
  readonly mode: GalleryIntroMode
}) {
  const [state, setState] = useState<GalleryIntroState>('checking')
  const dismissalHandledRef = useRef(false)
  const exampleHeadingId = `gallery-intro-example-${useId().replaceAll(':', '')}`
  const { launchInertiaBurst } = useGalleryIntroMotion()

  useEffect(() => {
    setState(
      shouldShowIntroduction(mode, readAcknowledgement())
        ? 'visible'
        : 'dismissed'
    )

    const syncDismissal = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return

      const acknowledgement = mergeAcknowledgements(
        sessionAcknowledgement,
        parseAcknowledgement(event.newValue)
      )
      sessionAcknowledgement = acknowledgement

      if (!shouldShowIntroduction(mode, acknowledgement)) {
        setState('dismissed')
      }
    }

    window.addEventListener('storage', syncDismissal)
    return () => window.removeEventListener('storage', syncDismissal)
  }, [mode])

  const dismiss = useCallback(
    (dismissal: GalleryIntroDismissal) => {
      if (dismissalHandledRef.current) return

      dismissalHandledRef.current = true
      persistAcknowledgement(dismissal)
      launchInertiaBurst()
      setState('dismissed')
    },
    [launchInertiaBurst]
  )

  const updateOpen = useCallback(
    (open: boolean) => {
      if (!open && state === 'visible') dismiss('acknowledged')
    },
    [dismiss, state]
  )

  return (
    <>
      <span
        className={styles.stateMarker}
        data-gallery-intro
        data-state={state}
        hidden
      />

      <Dialog open={state === 'visible'} onOpenChange={updateOpen}>
        <DialogContent
          className={styles.dialog}
          data-gallery-intro-dialog
          motion='custom'
          overlayClassName={styles.overlay}
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            window.requestAnimationFrame(() => {
              document
                .querySelector<HTMLElement>('[data-gallery-main]')
                ?.focus({ preventScroll: true })
            })
          }}
        >
          <div className={styles.body}>
            <DialogTitle className={styles.title}>
              Explore AI safety through scenes you already know
            </DialogTitle>

            <DialogDescription className={styles.srOnly}>
              See how one familiar scene maps to one AI safety concept, then
              explore the gallery.
            </DialogDescription>

            <p className={styles.exampleLabel} data-gallery-intro-example-label>
              Example:
            </p>
            <section
              className={styles.example}
              aria-labelledby={exampleHeadingId}
            >
              <div className={styles.exampleHeader}>
                <div className={styles.reference}>
                  <h3 id={exampleHeadingId}>{example.source}</h3>
                  <p>{example.title}</p>
                </div>
                <div className={styles.exampleMedia}>
                  <Image
                    className={styles.exampleImage}
                    data-gallery-intro-example-image
                    src={example.image.src}
                    alt={example.image.alt}
                    width={example.image.width}
                    height={example.image.height}
                    sizes='(max-width: 680px) calc(100vw - 86px), 230px'
                    placeholder='blur'
                    blurDataURL={example.image.blurDataURL}
                    style={{
                      objectPosition: focalPointToObjectPosition(
                        example.image.focalPoint
                      )
                    }}
                  />
                </div>
              </div>
              <div className={styles.analogy}>
                <p className={styles.relation}>This scene is an example of</p>
                <p className={styles.concept}>{example.concept}</p>
              </div>
            </section>

            <div className={styles.footer}>
              <Button
                className={styles.enterButton}
                data-gallery-intro-dismiss
                size='lg'
                type='button'
                onClick={() => dismiss('acknowledged')}
              >
                <span>Explore the gallery</span>
                <ArrowRightIcon aria-hidden='true' data-icon='inline-end' />
              </Button>
            </div>
          </div>

          <button
            className={styles.closeButton}
            data-gallery-intro-close
            type='button'
            aria-label='Permanently dismiss introduction'
            onClick={() => dismiss('explicit')}
          >
            <span aria-hidden='true'>×</span>
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function shouldShowIntroduction(
  mode: GalleryIntroMode,
  acknowledgement: GalleryIntroAcknowledgement
) {
  return mode === 'landing'
    ? acknowledgement !== 'explicit'
    : acknowledgement === 'none'
}

function readAcknowledgement() {
  let storedAcknowledgement: GalleryIntroAcknowledgement = 'none'

  try {
    storedAcknowledgement = parseAcknowledgement(
      window.localStorage.getItem(STORAGE_KEY)
    )
  } catch {
    // The in-memory acknowledgement still survives client-side route changes.
  }

  sessionAcknowledgement = mergeAcknowledgements(
    sessionAcknowledgement,
    storedAcknowledgement
  )
  return sessionAcknowledgement
}

function persistAcknowledgement(dismissal: GalleryIntroDismissal) {
  const acknowledgement = mergeAcknowledgements(
    readAcknowledgement(),
    dismissal
  )
  sessionAcknowledgement = acknowledgement

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      acknowledgement === 'explicit'
        ? EXPLICITLY_DISMISSED_VALUE
        : ACKNOWLEDGED_VALUE
    )
  } catch {
    // The acknowledgement still survives client-side route changes.
  }
}

function parseAcknowledgement(
  value: string | null
): GalleryIntroAcknowledgement {
  if (value === EXPLICITLY_DISMISSED_VALUE) return 'explicit'

  if (value === ACKNOWLEDGED_VALUE || value === 'dismissed') {
    return 'acknowledged'
  }

  return 'none'
}

function mergeAcknowledgements(
  first: GalleryIntroAcknowledgement,
  second: GalleryIntroAcknowledgement
) {
  const acknowledgementRank = {
    none: 0,
    acknowledged: 1,
    explicit: 2
  } satisfies Record<GalleryIntroAcknowledgement, number>

  return acknowledgementRank[first] >= acknowledgementRank[second]
    ? first
    : second
}
