import type { FocalPoint } from '@/lib/content/schema'

export type CoverCropInput = Readonly<{
  sourceWidth: number
  sourceHeight: number
  frameWidth: number
  frameHeight: number
  focalPoint?: FocalPoint
}>

export type CoverCrop = Readonly<{
  scale: number
  renderedWidth: number
  renderedHeight: number
  translateX: number
  translateY: number
  objectPosition: string
}>

export function calculateCoverCrop(input: CoverCropInput): CoverCrop {
  assertDimension(input.sourceWidth, 'sourceWidth')
  assertDimension(input.sourceHeight, 'sourceHeight')
  assertDimension(input.frameWidth, 'frameWidth')
  assertDimension(input.frameHeight, 'frameHeight')

  const focalPoint = input.focalPoint ?? { x: 0.5, y: 0.5 }
  assertNormalized(focalPoint.x, 'focalPoint.x')
  assertNormalized(focalPoint.y, 'focalPoint.y')

  const scale = Math.max(
    input.frameWidth / input.sourceWidth,
    input.frameHeight / input.sourceHeight
  )
  const renderedWidth = input.sourceWidth * scale
  const renderedHeight = input.sourceHeight * scale
  const translateX = clamp(
    input.frameWidth / 2 - focalPoint.x * renderedWidth,
    input.frameWidth - renderedWidth,
    0
  )
  const translateY = clamp(
    input.frameHeight / 2 - focalPoint.y * renderedHeight,
    input.frameHeight - renderedHeight,
    0
  )

  return {
    scale,
    renderedWidth,
    renderedHeight,
    translateX,
    translateY,
    objectPosition: `${toObjectPosition(translateX, input.frameWidth - renderedWidth)}% ${toObjectPosition(translateY, input.frameHeight - renderedHeight)}%`
  }
}

export function focalPointToObjectPosition(focalPoint: FocalPoint | undefined) {
  const value = focalPoint ?? { x: 0.5, y: 0.5 }
  assertNormalized(value.x, 'focalPoint.x')
  assertNormalized(value.y, 'focalPoint.y')

  return `${formatPercent(value.x * 100)}% ${formatPercent(value.y * 100)}%`
}

function toObjectPosition(translation: number, freeSpace: number) {
  if (Math.abs(freeSpace) < Number.EPSILON) return 50
  return Number(formatPercent((translation / freeSpace) * 100))
}

function formatPercent(value: number) {
  return Number(value.toFixed(4)).toString()
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function assertDimension(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive finite number`)
  }
}

function assertNormalized(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`)
  }
}
