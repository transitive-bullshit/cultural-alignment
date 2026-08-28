import { afterEach, describe, expect, it, vi } from 'vitest'

describe('site URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('treats a blank configured origin as absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cultural-alignment.vercel.app')
    vi.stubEnv('VERCEL_URL', '')

    const { siteUrl } = await import('./site')

    expect(siteUrl.href).toBe('https://cultural-alignment.vercel.app/')
  })
})
