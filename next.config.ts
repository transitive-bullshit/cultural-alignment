import type { NextConfig } from 'next'

import scenarios from './content/snapshot/scenarios.json'
import sources from './content/snapshot/sources.json'

const generatedMediaPathSegment = '/media/generated/'
const imageSources = [
  ...scenarios.flatMap(({ image }) => [image.gallerySrc, image.detailSrc]),
  ...sources.flatMap(({ poster }) =>
    poster ? [poster.gallerySrc, poster.detailSrc] : []
  )
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
  images: {
    qualities: [75],
    remotePatterns
  }
}

export default nextConfig
