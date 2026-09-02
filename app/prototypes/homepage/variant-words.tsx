'use client'

import {
  HomepageWords,
  HomepageWordsInlineIntroduction
} from '@/features/homepage/homepage-words'
import { GalleryHeader } from '@/features/spatial-gallery/gallery-header'

import type { HomepagePrototypeRuntimeProps } from './prototype-types'

import styles from './variant-words.module.css'

export function WordsVariant({
  galleryItems,
  initialItemId,
  introDismissed,
  onDismissIntro
}: HomepagePrototypeRuntimeProps) {
  return (
    <HomepageWords
      className={styles.prototype}
      header={<GalleryHeader />}
      historyKey='prototype-words'
      initialItemId={initialItemId}
      inlineIntroduction={
        <HomepageWordsInlineIntroduction
          introDismissed={introDismissed}
          onDismissIntro={onDismissIntro}
        />
      }
      items={galleryItems}
      mainId='prototype-main'
    />
  )
}
