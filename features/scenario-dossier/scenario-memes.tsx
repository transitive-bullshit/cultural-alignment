'use client'

import Image from 'next/image'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { ContentImage } from '@/lib/content/catalog'

import { getNextVisibleMemeCount, MEME_BATCH_SIZE } from './meme-gallery-state'
import styles from './scenario-memes.module.css'

export function ScenarioMemes({
  memes,
  scenarioTitle
}: {
  readonly memes: readonly ContentImage[]
  readonly scenarioTitle: string
}) {
  const headingId = useId()
  const gridId = useId()
  const originatingButtonRef = useRef<HTMLButtonElement | null>(null)
  const memeButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const pendingFocusIndexRef = useRef<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(() =>
    getNextVisibleMemeCount(0, memes.length)
  )
  const [activeIndex, setActiveIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const [gridAnnouncement, setGridAnnouncement] = useState('')
  const [dialogAnnouncement, setDialogAnnouncement] = useState('')

  useEffect(() => {
    const pendingFocusIndex = pendingFocusIndexRef.current
    if (pendingFocusIndex === null) return

    memeButtonRefs.current[pendingFocusIndex]?.focus()
    pendingFocusIndexRef.current = null
  }, [visibleCount])

  if (memes.length === 0) return null

  const activeMeme = memes[activeIndex]!
  const visibleMemes = memes.slice(0, visibleCount)
  const remainingCount = Math.max(0, memes.length - visibleCount)
  const nextBatchCount = Math.min(MEME_BATCH_SIZE, remainingCount)

  const openMeme = (index: number, button: HTMLButtonElement) => {
    originatingButtonRef.current = button
    setActiveIndex(index)
    setDialogAnnouncement('')
    setOpen(true)
  }

  const moveBy = (direction: -1 | 1) => {
    if (memes.length < 2) return

    const nextIndex = (activeIndex + direction + memes.length) % memes.length

    setActiveIndex(nextIndex)
    setDialogAnnouncement(`Meme ${nextIndex + 1} of ${memes.length}`)
  }

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      memes.length < 2 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return
    }

    event.preventDefault()
    moveBy(event.key === 'ArrowRight' ? 1 : -1)
  }

  const showNextBatch = () => {
    const nextVisibleCount = getNextVisibleMemeCount(visibleCount, memes.length)

    if (nextVisibleCount === memes.length) {
      pendingFocusIndexRef.current = visibleCount
    }
    setVisibleCount(nextVisibleCount)
    setGridAnnouncement(`Showing ${nextVisibleCount} of ${memes.length} memes`)
  }

  return (
    <section
      className={styles.section}
      aria-labelledby={headingId}
      data-scenario-memes
    >
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Scenario artifacts</p>
            <h2 id={headingId}>Memes</h2>
          </div>
          <p className={styles.count} aria-label={`${memes.length} memes`}>
            {String(memes.length).padStart(2, '0')} images
          </p>
        </header>

        <ul id={gridId} className={styles.grid} data-scenario-meme-grid>
          {visibleMemes.map((meme, index) => (
            <li key={`${meme.detailSrc}:${index}`}>
              <button
                ref={(button) => {
                  memeButtonRefs.current[index] = button
                }}
                className={styles.trigger}
                type='button'
                aria-label={`Open meme ${index + 1} of ${memes.length}`}
                data-scenario-meme-trigger
                onClick={(event) => openMeme(index, event.currentTarget)}
              >
                <span className={styles.thumbnailFrame}>
                  <Image
                    className={styles.thumbnailImage}
                    src={meme.gallerySrc}
                    alt={meme.alt}
                    fill
                    placeholder='blur'
                    blurDataURL={meme.blurDataURL}
                    sizes='(max-width: 620px) 45vw, (max-width: 820px) 30vw, (max-width: 1279px) 23vw, 250px'
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>

        {remainingCount > 0 ? (
          <div className={styles.moreAction}>
            <Button
              type='button'
              variant='outline'
              aria-controls={gridId}
              data-scenario-meme-load-more
              onClick={showNextBatch}
            >
              View {nextBatchCount} more
            </Button>
          </div>
        ) : null}

        <span className='sr-only' role='status' aria-live='polite'>
          {gridAnnouncement}
        </span>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={styles.dialog}
          motion='custom'
          overlayClassName={styles.dialogOverlay}
          showCloseButton={false}
          aria-keyshortcuts='ArrowLeft ArrowRight'
          data-scenario-meme-lightbox
          data-scenario-meme-index={activeIndex}
          onKeyDown={handleDialogKeyDown}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            originatingButtonRef.current?.focus()
          }}
        >
          <DialogHeader className='sr-only'>
            <DialogTitle>
              {scenarioTitle}: meme {activeIndex + 1} of {memes.length}
            </DialogTitle>
            <DialogDescription>
              Use the previous and next buttons or the Left and Right Arrow keys
              to browse. Press Escape to close.
            </DialogDescription>
          </DialogHeader>

          <DialogClose asChild>
            <Button
              className={styles.closeButton}
              type='button'
              variant='outline'
              size='icon-lg'
              aria-label='Close meme viewer'
            >
              <XIcon data-icon='inline-start' />
            </Button>
          </DialogClose>

          <div
            className={styles.dialogBody}
            data-single={memes.length === 1 || undefined}
          >
            {memes.length > 1 ? (
              <Button
                className={styles.previousButton}
                type='button'
                variant='outline'
                size='icon-lg'
                aria-label='Previous meme'
                onClick={() => moveBy(-1)}
              >
                <ChevronLeftIcon data-icon='inline-start' />
              </Button>
            ) : null}

            <figure className={styles.figure}>
              <div className={styles.imageStage}>
                <Image
                  key={activeMeme.detailSrc}
                  className={styles.focusedImage}
                  src={activeMeme.detailSrc}
                  alt={activeMeme.alt}
                  width={activeMeme.width}
                  height={activeMeme.height}
                  placeholder='blur'
                  blurDataURL={activeMeme.blurDataURL}
                  sizes='(max-width: 620px) calc(100vw - 36px), (max-width: 1100px) calc(100vw - 9rem), 960px'
                />
              </div>
              <figcaption className={styles.caption}>
                Meme {activeIndex + 1} / {memes.length}
              </figcaption>
            </figure>

            {memes.length > 1 ? (
              <Button
                className={styles.nextButton}
                type='button'
                variant='outline'
                size='icon-lg'
                aria-label='Next meme'
                onClick={() => moveBy(1)}
              >
                <ChevronRightIcon data-icon='inline-start' />
              </Button>
            ) : null}
          </div>

          <span className='sr-only' role='status' aria-live='polite'>
            {dialogAnnouncement}
          </span>
        </DialogContent>
      </Dialog>
    </section>
  )
}
