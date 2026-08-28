export const MEDIA_SEEK_STEP_SECONDS = 10

export function clampMediaTime(time: number, duration: number) {
  const finiteTime = Number.isFinite(time) ? Math.max(0, time) : 0

  return Number.isFinite(duration) && duration > 0
    ? Math.min(finiteTime, duration)
    : finiteTime
}

export function formatMediaTime(time: number) {
  const totalSeconds = Math.floor(clampMediaTime(time, 0))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
