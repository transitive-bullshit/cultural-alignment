import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('site URL', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('PORTLESS_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '')
    vi.stubEnv('VERCEL_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the active Portless origin during development', async () => {
    const origin = 'http://feature.cultural-alignment.localhost:1355'
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('PORTLESS_URL', origin)

    const { siteUrl } = await import('./site')

    expect(siteUrl.origin).toBe(origin)
  })

  it('preserves an explicit origin over Portless', async () => {
    const origin = 'https://preview.example.com'
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', origin)
    vi.stubEnv('PORTLESS_URL', 'https://cultural-alignment.localhost')

    const { siteUrl } = await import('./site')

    expect(siteUrl.origin).toBe(origin)
  })

  it('ignores Portless outside development', async () => {
    const hostname = 'preview.example.com'
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PORTLESS_URL', 'https://cultural-alignment.localhost')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', hostname)

    const { siteUrl } = await import('./site')

    expect(siteUrl.hostname).toBe(hostname)
  })

  it('treats a blank configured origin as absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'cultural-alignment.vercel.app')
    vi.stubEnv('VERCEL_URL', '')

    const { siteUrl } = await import('./site')

    expect(siteUrl.href).toBe('https://cultural-alignment.vercel.app/')
  })
})
