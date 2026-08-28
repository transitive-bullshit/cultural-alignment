import type { FocalPoint } from '@/lib/content/schema'

export function focalPointToObjectPosition(focalPoint: FocalPoint | undefined) {
  const value = focalPoint ?? { x: 0.5, y: 0.5 }
  assertNormalized(value.x, 'focalPoint.x')
  assertNormalized(value.y, 'focalPoint.y')

  return `${formatPercent(value.x * 100)}% ${formatPercent(value.y * 100)}%`
}

function formatPercent(value: number) {
  return Number(value.toFixed(4)).toString()
}

function assertNormalized(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1`)
  }
}
