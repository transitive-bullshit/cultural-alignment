import { execFileSync } from 'node:child_process'

export function getLocalDevUrl() {
  return execFileSync(
    'pnpm',
    ['exec', 'portless', 'get', 'cultural-alignment'],
    {
      encoding: 'utf8'
    }
  ).trim()
}
