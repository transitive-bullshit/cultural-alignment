import type { NextConfig } from 'next'

import franchises from './content/snapshot/franchises.json'
import riskFamilies from './content/snapshot/risk-families.json'
import scenarios from './content/snapshot/scenarios.json'
import sources from './content/snapshot/sources.json'

const generatedMediaPathSegment = '/media/generated/'
type ImageSource = Readonly<{ gallerySrc: string; detailSrc: string }>
type SnapshotScenario = (typeof scenarios)[number] & {
  readonly memes?: readonly ImageSource[]
}

const imageSources = [
  ...(scenarios as readonly SnapshotScenario[]).flatMap(({ image, memes }) => [
    image.gallerySrc,
    image.detailSrc,
    ...(memes ?? []).flatMap(({ gallerySrc, detailSrc }) => [
      gallerySrc,
      detailSrc
    ])
  ]),
  ...sources.flatMap(({ poster }) =>
    poster ? [poster.gallerySrc, poster.detailSrc] : []
  ),
  ...franchises.flatMap(({ image }) => [image.gallerySrc, image.detailSrc])
]

const remotePatterns = [
  ...new Map(
    imageSources.flatMap((source) => {
      if (!source.startsWith('https://')) return []

      const url = new URL(source)
      const generatedPathIndex = url.pathname.indexOf(generatedMediaPathSegment)
      const pathname =
        generatedPathIndex >= 0
          ? `${url.pathname.slice(0, generatedPathIndex)}${generatedMediaPathSegment}**`
          : url.pathname
      const pattern = {
        protocol: 'https' as const,
        hostname: url.hostname,
        port: url.port,
        pathname,
        search: ''
      }

      return [[JSON.stringify(pattern), pattern] as const]
    })
  ).values()
]

const nextConfig: NextConfig = {
  // Keep the wrapper external too so deployment tracing includes the native addon.
  serverExternalPackages: ['takumi-js', '@takumi-rs/core'],
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env.PORTLESS_URL
      ? [new URL(process.env.PORTLESS_URL).hostname]
      : [])
  ],
  images: {
    qualities: [75],
    remotePatterns
  },
  experimental: {
    staleTimes: {
      static: 3_600
    }
  },
  redirects() {
    return riskFamilies.map(({ slug }) => ({
      source: '/scenarios',
      has: [{ type: 'query' as const, key: 'family', value: slug }],
      destination: `/scenarios/family/${slug}`,
      permanent: true
    }))
  },
  outputFileTracingIncludes: {
    '/{scenarios,sources,franchises,risk-families,concepts}/*/opengraph-image':
      ['assets/fonts/barlow-condensed-latin-800-normal.woff']
  }
}

export default nextConfig
