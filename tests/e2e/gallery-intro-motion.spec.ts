import { expect, test, type Locator } from '@playwright/test'
import sharp from 'sharp'

import { mockOptimizedImages } from './image-fixtures'

test.describe('gallery introduction motion', () => {
  test.describe.configure({ mode: 'serial' })

  test('reloading the scenarios gallery keeps moving left through its initial layout correction', async ({
    page
  }, testInfo) => {
    const targetURL = process.env.GALLERY_MOTION_URL ?? '/scenarios'

    if (targetURL.startsWith('/')) await mockOptimizedImages(page)
    await page.goto(targetURL)

    const introduction = page.locator('[data-gallery-intro]')

    await expect(introduction).toHaveAttribute('data-state', 'visible')
    await page.locator('[data-gallery-intro-dismiss]').click()
    await expect(introduction).toHaveAttribute('data-state', 'dismissed')
    await page.reload({ waitUntil: 'commit' })

    const gallery = page.locator('[data-spatial-gallery="browse"]')
    const canvas = gallery.locator('canvas')

    await expect(introduction).toHaveAttribute('data-state', 'dismissed')
    await expect(canvas).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(
        async () =>
          Number(await canvas.getAttribute('data-gallery-bound-textures')),
        { timeout: 15_000 }
      )
      .toBeGreaterThan(0)

    await expect(canvas).toHaveAttribute('data-gallery-intro-motion', 'running')

    const viewport = page.viewportSize()
    const canvasWidth = await canvas.getAttribute('width')
    if (!viewport || !canvasWidth) {
      throw new Error('Expected a measured gallery viewport')
    }
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width - 1
    })
    await expect.poll(() => canvas.getAttribute('width')).not.toBe(canvasWidth)
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve(undefined))
          )
        )
    )
    await expect(canvas).toHaveAttribute('data-gallery-intro-motion', 'running')

    const frames: Buffer[] = []

    for (let frame = 0; frame < 8; frame += 1) {
      const screenshot = await canvas.screenshot({
        animations: 'allow',
        scale: 'css'
      })

      frames.push(screenshot)
      await testInfo.attach(`gallery-motion-frame-${frame}`, {
        body: screenshot,
        contentType: 'image/png'
      })
      await page.waitForTimeout(25)
    }

    const motion = await measureHorizontalMotion(frames)
    const diagnostic = JSON.stringify({
      introMotion: await canvas.getAttribute('data-gallery-intro-motion'),
      motion
    })

    expect(
      motion.maxChangedPixelRatio,
      `Expected visible frame-to-frame gallery movement: ${diagnostic}`
    ).toBeGreaterThan(0.01)
    expect(
      motion.leftwardSteps,
      `Expected leftward gallery movement: ${diagnostic}`
    ).toBeGreaterThanOrEqual(2)
  })

  test('dismissing the introduction launches an inertia burst', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/')

    const gallery = page.locator('[data-spatial-gallery="browse"]')
    const canvas = gallery.locator('canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )

    await page.locator('[data-gallery-intro-dismiss]').click()

    await expect(page.locator('[data-gallery-intro]')).toHaveAttribute(
      'data-state',
      'dismissed'
    )
    await expect(gallery).toHaveAttribute(
      'data-gallery-inertia-burst-requested',
      'true'
    )
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      /^(launched|settled)$/
    )
  })

  test('reduced motion dismisses without positional movement', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockOptimizedImages(page)
    await page.goto('/')

    const canvas = page.locator('[data-spatial-gallery="browse"] canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )
    await page.locator('[data-gallery-intro-dismiss]').click()

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'skipped'
    )
  })

  test('a scenario filter remount does not replay the dismissal burst', async ({
    page
  }) => {
    await mockOptimizedImages(page)
    await page.goto('/scenarios')

    const gallery = page.locator('[data-spatial-gallery="browse"]')
    const canvas = gallery.locator('canvas')

    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )
    await page.locator('[data-gallery-intro-dismiss]').click()
    await expect(canvas).toHaveAttribute(
      'data-gallery-inertia-burst',
      /^(launched|settled)$/
    )

    const filter = page
      .locator('[data-scenario-family-filters] a[href^="/scenarios?family="]')
      .first()
    const filterHref = await requiredInternalHref(filter)
    const navigation = page.waitForURL(
      (url) => `${url.pathname}${url.search}${url.hash}` === filterHref,
      { waitUntil: 'commit' }
    )

    await filter.click()
    await navigation

    await expect(gallery).not.toHaveAttribute(
      'data-gallery-inertia-burst-requested'
    )
    await expect(gallery.locator('canvas')).toHaveAttribute(
      'data-gallery-inertia-burst',
      'pending',
      { timeout: 15_000 }
    )
  })

  test.describe('phone viewport', () => {
    test.use({ hasTouch: true, viewport: { height: 844, width: 390 } })

    test('keeps the homepage gallery paintable after the introduction closes', async ({
      page
    }) => {
      await mockOptimizedImages(page)
      await page.goto('/')

      const introduction = page.locator('[data-gallery-intro]')
      await expect(introduction).toHaveAttribute('data-state', 'visible')
      await page.locator('[data-gallery-intro-dismiss]').click()
      await expect(introduction).toHaveAttribute('data-state', 'dismissed')

      const gallery = page.locator('[data-spatial-gallery="browse"]')
      const canvas = gallery.locator('canvas')

      await expect(gallery).toBeVisible()
      await expect
        .poll(async () => (await canvas.boundingBox())?.height ?? 0)
        .toBeGreaterThan(0)
      await expect
        .poll(async () =>
          Number(await canvas.getAttribute('data-gallery-bound-textures'))
        )
        .toBeGreaterThan(0)
    })
  })
})

async function requiredInternalHref(locator: Locator) {
  const href = await locator.getAttribute('href')

  if (!href?.startsWith('/')) {
    throw new Error('Expected an internal navigation link')
  }

  return href
}

interface GrayscaleFrame {
  data: Buffer
  height: number
  width: number
}

interface FrameMotion {
  changedPixelRatio: number
  horizontalShift: number
  shiftImprovement: number
}

async function measureHorizontalMotion(frames: Buffer[]) {
  const grayscaleFrames = await Promise.all(frames.map(toGrayscaleFrame))
  if (grayscaleFrames.length < 2) {
    throw new Error('Expected at least two gallery frames')
  }
  const steps = grayscaleFrames
    .slice(1)
    .map((frame, index) => compareFrames(grayscaleFrames[index]!, frame))
  const meaningfulSteps = steps.filter(
    ({ changedPixelRatio, shiftImprovement }) =>
      changedPixelRatio > 0.01 && shiftImprovement > 0.25
  )

  return {
    leftwardSteps: meaningfulSteps.filter(
      ({ horizontalShift }) => horizontalShift > 0
    ).length,
    maxChangedPixelRatio: Math.max(
      ...steps.map(({ changedPixelRatio }) => changedPixelRatio)
    ),
    steps
  }
}

async function toGrayscaleFrame(png: Buffer): Promise<GrayscaleFrame> {
  const { data, info } = await sharp(png)
    .resize({ width: 320 })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return { data, height: info.height, width: info.width }
}

function compareFrames(from: GrayscaleFrame, to: GrayscaleFrame): FrameMotion {
  expect(to.height).toBe(from.height)
  expect(to.width).toBe(from.width)

  const errors = Array.from({ length: 33 }, (_, index) => index - 16).map(
    (horizontalShift) => ({
      error: meanSquaredError(from, to, horizontalShift),
      horizontalShift
    })
  )
  const zeroShiftError = errors[16]!.error
  const bestMatch = errors.reduce((best, candidate) =>
    candidate.error < best.error ? candidate : best
  )

  return {
    changedPixelRatio: changedPixelRatio(from, to),
    horizontalShift: bestMatch.horizontalShift,
    shiftImprovement:
      zeroShiftError === 0
        ? 0
        : (zeroShiftError - bestMatch.error) / zeroShiftError
  }
}

function changedPixelRatio(from: GrayscaleFrame, to: GrayscaleFrame) {
  let changedPixels = 0

  for (let index = 0; index < from.data.length; index += 1) {
    if (Math.abs(from.data.readUInt8(index) - to.data.readUInt8(index)) >= 8) {
      changedPixels += 1
    }
  }

  return changedPixels / from.data.length
}

function meanSquaredError(
  from: GrayscaleFrame,
  to: GrayscaleFrame,
  horizontalShift: number
) {
  const margin = 18
  const startX = margin + Math.max(0, -horizontalShift)
  const endX = from.width - margin - Math.max(0, horizontalShift)
  let squaredError = 0
  let samples = 0

  for (let y = margin; y < from.height - margin; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const fromIndex = y * from.width + x + horizontalShift
      const toIndex = y * to.width + x
      const difference =
        from.data.readUInt8(fromIndex) - to.data.readUInt8(toIndex)

      squaredError += difference * difference
      samples += 1
    }
  }

  return squaredError / samples
}
