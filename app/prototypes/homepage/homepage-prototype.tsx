'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType
} from 'react'

import { ColdOpenVariant } from './variant-cold-open'
import { FieldGuideVariant } from './variant-field-guide'
import type { HomepageVariantProps } from './prototype-types'
import { SignalLoaderVariant } from './variant-signal-loader'
import { SplitLensVariant } from './variant-split-lens'

import styles from './homepage-prototype.module.css'

type PrototypeDefinition = Readonly<{
  name: string
  Component: ComponentType<HomepageVariantProps>
}>

const variants: readonly PrototypeDefinition[] = [
  { name: 'Signal Loader', Component: SignalLoaderVariant },
  { name: 'Split Lens', Component: SplitLensVariant },
  { name: 'Cold Open', Component: ColdOpenVariant },
  { name: 'Field Guide', Component: FieldGuideVariant }
]

export function HomepagePrototype({
  examples,
  galleryItems,
  initialItemId,
  initialVariant,
  scenarioCount
}: HomepageVariantProps & { readonly initialVariant: number }) {
  const safeInitialVariant = Math.min(
    variants.length - 1,
    Math.max(0, initialVariant)
  )
  const pickerRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [activeVariant, setActiveVariant] = useState(safeInitialVariant)
  const [revision, setRevision] = useState(0)
  const [highlight, setHighlight] = useState({ width: 0, x: 0 })
  const definition = variants[activeVariant]!

  const moveHighlight = useCallback(() => {
    const item = itemRefs.current[activeVariant]
    if (!item) return
    setHighlight({ width: item.offsetWidth, x: item.offsetLeft })
  }, [activeVariant])

  const writeVariantToUrl = useCallback((index: number) => {
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(window.history.state, '', url)
  }, [])

  const selectVariant = useCallback(
    (index: number) => {
      if (index < 0 || index >= variants.length) return
      setActiveVariant(index)
      setRevision(0)
      writeVariantToUrl(index)
    },
    [writeVariantToUrl]
  )

  const replay = useCallback(() => setRevision((current) => current + 1), [])

  useLayoutEffect(moveHighlight, [moveHighlight])

  useEffect(() => {
    writeVariantToUrl(activeVariant)

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        pickerRef.current?.setAttribute('data-ready', '')
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [activeVariant, writeVariantToUrl])

  useEffect(() => {
    window.addEventListener('resize', moveHighlight)
    return () => window.removeEventListener('resize', moveHighlight)
  }, [moveHighlight])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= variants.length) {
        selectVariant(number - 1)
      } else if (event.key === 'ArrowRight') {
        selectVariant((activeVariant + 1) % variants.length)
      } else if (event.key === 'ArrowLeft') {
        selectVariant((activeVariant - 1 + variants.length) % variants.length)
      } else if (event.key === 'r' || event.key === 'R') {
        replay()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeVariant, replay, selectVariant])

  const variantProps: HomepageVariantProps = {
    examples,
    galleryItems,
    initialItemId,
    scenarioCount
  }

  return (
    <div
      className={`experience-scope ${styles.root}`}
      data-site-footer='hidden'
      data-homepage-prototype
    >
      <a className={styles.skipLink} href='#prototype-main'>
        Skip to prototype
      </a>
      <div
        key={`${activeVariant}-${revision}`}
        className={styles.stage}
        data-prototype-stage={definition.name}
      >
        <definition.Component {...variantProps} />
      </div>

      <nav
        ref={pickerRef}
        className='proto-picker'
        aria-label='Prototype variants'
      >
        <span
          className='proto-picker-highlight'
          style={{
            width: highlight.width,
            transform: `translateX(${highlight.x}px)`
          }}
          aria-hidden='true'
        />
        {variants.map(({ name }, index) => (
          <button
            key={name}
            ref={(item) => {
              itemRefs.current[index] = item
            }}
            className='proto-picker-item'
            type='button'
            data-prototype-index={index + 1}
            data-active={activeVariant === index || undefined}
            aria-current={activeVariant === index ? 'true' : undefined}
            onClick={() => selectVariant(index)}
          >
            {name}
          </button>
        ))}
        <span className='proto-picker-divider' aria-hidden='true' />
        <button
          className='proto-picker-item proto-picker-replay'
          type='button'
          data-prototype-replay
          aria-label='Replay animation (R)'
          onClick={replay}
        >
          ↻
        </button>
      </nav>
    </div>
  )
}
