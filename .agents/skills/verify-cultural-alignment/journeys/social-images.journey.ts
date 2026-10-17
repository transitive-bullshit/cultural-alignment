import sharp from 'sharp'

import concepts from '../../../../content/snapshot/concepts.json' with { type: 'json' }
import franchises from '../../../../content/snapshot/franchises.json' with { type: 'json' }
import families from '../../../../content/snapshot/risk-families.json' with { type: 'json' }
import scenarios from '../../../../content/snapshot/scenarios.json' with { type: 'json' }
import sources from '../../../../content/snapshot/sources.json' with { type: 'json' }

import { socialImageCacheHeaders } from '../../../../lib/media/social-image'

import { expect, test } from './fixtures'

// The longest names stress wrapping; a posterless source exercises the fallback.
const longest = <T>(records: readonly T[], name: (record: T) => string) =>
  records.toSorted((a, b) => name(b).length - name(a).length)[0]!

const targets = [
  { route: 'scenarios', slug: longest(scenarios, (s) => s.title).slug },
  {
    route: 'sources',
    slug: (sources.find(({ poster }) => !poster) ?? sources[0]!).slug
  },
  { route: 'franchises', slug: franchises[0]!.slug },
  { route: 'risk-families', slug: longest(families, (f) => f.fullName).slug },
  { route: 'concepts', slug: longest(concepts, (c) => c.longName).slug }
]

test('every detail family publishes a 1200×630 WebP social image', async ({
  page,
  request,
  evidence
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Social images are viewport-independent'
  )

  for (const { route, slug } of targets) {
    await page.goto(`/${route}/${slug}`)
    const expectedPath = `/${route}/${slug}/opengraph-image`
    const og = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content')
    const twitter = await page
      .locator('meta[name="twitter:image"]')
      .getAttribute('content')
    expect(new URL(og!).pathname).toBe(expectedPath)
    expect(new URL(twitter!).pathname).toBe(expectedPath)

    // Metadata may name another origin; fetch the path from this instance.
    const response = await request.get(expectedPath)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/webp')
    for (const [name, value] of Object.entries(socialImageCacheHeaders)) {
      expect(response.headers()[name.toLowerCase()], name).toBe(value)
    }
    const body = await response.body()
    const { format, width, height } = await sharp(body).metadata()
    expect({ format, width, height }).toEqual({
      format: 'webp',
      width: 1200,
      height: 630
    })

    await evidence.file(`${route} social image`, 'webp', body)
    await evidence.record(`${route} social image response`, {
      page: page.url(),
      og,
      twitter,
      bytes: body.length,
      headers: Object.fromEntries(
        [
          'content-type',
          'cache-control',
          'cdn-cache-control',
          'vercel-cdn-cache-control'
        ].map((name) => [name, response.headers()[name]])
      )
    })
  }
})

test('sitemap, robots, and llms.txt describe the archive', async ({
  request,
  evidence
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile',
    'Crawler files are viewport-independent'
  )

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  const xml = await sitemap.text()
  const listed = new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]!).pathname
    )
  )
  const expected = [
    ...scenarios.map(({ slug }) => `/scenarios/${slug}`),
    ...sources.map(({ slug }) => `/sources/${slug}`),
    ...franchises.map(({ slug }) => `/franchises/${slug}`),
    ...families.map(({ slug }) => `/risk-families/${slug}`),
    ...concepts.map(({ slug }) => `/concepts/${slug}`)
  ]
  expect(expected.filter((path) => !listed.has(path))).toEqual([])
  expect(
    [...listed].filter((path) => path.startsWith('/scenarios/family/'))
  ).toEqual([])
  await evidence.file('sitemap', 'xml', Buffer.from(xml))

  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  expect(await robots.text()).toMatch(/Sitemap:\s*\S+\/sitemap\.xml/i)
  await evidence.file('robots', 'txt', await robots.body())

  const llms = await request.get('/llms.txt')
  expect(llms.status()).toBe(200)
  expect(await llms.text()).toContain('Cultural Alignment')
  await evidence.file('llms', 'txt', await llms.body())
})
