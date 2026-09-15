import { describe, expect, it } from 'vitest'

import {
  getDownloadButtonLabel,
  getDownloadButtonVariant,
  getMemeDownloadFilename,
  isStaleDownload
} from './scenario-memes'

const memeCount = 4
const assetHost = 'https://assets.cultural-alignment.com'

describe('getDownloadButtonLabel', () => {
  it('labels the idle state with the live active position', () => {
    expect(getDownloadButtonLabel('idle', 0, memeCount)).toBe(
      'Download meme 1 of 4'
    )
  })

  it('labels the loading state with the live active position', () => {
    expect(getDownloadButtonLabel('loading', 1, memeCount)).toBe(
      'Preparing meme 2 of 4 for download'
    )
  })

  it('labels the success state with the live active position', () => {
    expect(getDownloadButtonLabel('success', 2, memeCount)).toBe(
      'meme 3 of 4 download started'
    )
  })

  it('labels the error state with the live active position', () => {
    expect(getDownloadButtonLabel('error', 3, memeCount)).toBe(
      'Retry downloading meme 4 of 4'
    )
  })

  it('derives the position from the passed index, not a captured one', () => {
    expect(getDownloadButtonLabel('success', 0, memeCount)).not.toBe(
      getDownloadButtonLabel('success', 1, memeCount)
    )
    expect(getDownloadButtonLabel('success', 1, memeCount)).toBe(
      'meme 2 of 4 download started'
    )
  })
})

describe('getDownloadButtonVariant', () => {
  it('keeps the resting and loading states on the ghost variant', () => {
    expect(getDownloadButtonVariant('idle')).toBe('ghost')
    expect(getDownloadButtonVariant('loading')).toBe('ghost')
  })

  it('highlights success on the secondary variant', () => {
    expect(getDownloadButtonVariant('success')).toBe('secondary')
  })

  it('flags errors on the destructive variant', () => {
    expect(getDownloadButtonVariant('error')).toBe('destructive')
  })
})

describe('getMemeDownloadFilename', () => {
  it('names the saved file from the captured index so the clicked meme is saved', () => {
    expect(
      getMemeDownloadFilename(
        'jimmys-fake-remorse',
        0,
        `${assetHost}/memes/jimmys-fake-remorse/detail-1.webp`
      )
    ).toBe('jimmys-fake-remorse-meme-1.webp')
  })

  it('one-indexes the position regardless of the captured zero-based index', () => {
    expect(
      getMemeDownloadFilename(
        'truman-becomes-aware',
        3,
        `${assetHost}/memes/truman-becomes-aware/detail-4.webp`
      )
    ).toBe('truman-becomes-aware-meme-4.webp')
  })

  it('preserves the source extension', () => {
    expect(
      getMemeDownloadFilename('slug', 0, `${assetHost}/meme/detail-1.png`)
    ).toBe('slug-meme-1.png')
  })

  it('falls back to webp when the source has no extension', () => {
    expect(
      getMemeDownloadFilename('slug', 2, `${assetHost}/meme/detail-3`)
    ).toBe('slug-meme-3.webp')
  })
})

describe('isStaleDownload', () => {
  it('treats the captured token as active when nothing navigated mid-download', () => {
    expect(isStaleDownload(1, 1)).toBe(false)
    expect(isStaleDownload(7, 7)).toBe(false)
  })

  it('treats the captured token as stale after navigation bumped the token', () => {
    expect(isStaleDownload(1, 2)).toBe(true)
    expect(isStaleDownload(5, 9)).toBe(true)
  })

  it('treats any mismatch as stale so a stale success can never catch up', () => {
    expect(isStaleDownload(3, 2)).toBe(true)
    expect(isStaleDownload(0, 1)).toBe(true)
  })
})
