import { isIP } from 'node:net'

import pMap from 'p-map'

import type { Citation } from '../lib/content/schema'

const MAXIMUM_RESPONSE_BYTES = 512 * 1024
const MAXIMUM_PDF_BYTES = 24 * 1024 * 1024
const FETCH_TIMEOUT_MS = 20_000
const MAXIMUM_REDIRECTS = 6

// A small number of reviewed sources expose opaque URLs or incomplete document
// metadata. These titles come from the linked publication itself and remain
// deterministic when the remote site rate-limits or blocks the synchronizer.
const CURATED_CITATION_TITLES = {
  'https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng':
    'Regulation (EU) 2024/1689 (Artificial Intelligence Act)',
  'https://openai.com/index/affective-use-study/':
    'Early methods for studying affective use and emotional well-being on ChatGPT',
  'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.800-1.ipd2.pdf':
    'Managing Misuse Risk for Dual-Use Foundation Models',
  'https://www.gao.gov/products/gao-20-379sp':
    'Science & Tech Spotlight: Deepfakes',
  'https://www.imf.org/en/publications/staff-discussion-notes/issues/2024/01/14/gen-ai-artificial-intelligence-and-the-future-of-work-542379':
    'Gen-AI: Artificial Intelligence and the Future of Work',
  'https://www.lesswrong.com/s/3ni2P2GZzBvNebWYZ/p/RzsXRbk2ETNqjhsma':
    'AI Safety Strategies Landscape',
  'https://www.lesswrong.com/s/r9tYkB2a8Fp4DN8yB':
    'Risks from Learned Optimization'
} as const satisfies Readonly<Record<string, string>>

// Citation URLs are editorial input, so build-time fetching is limited to the
// publication hosts represented in the taxonomy. Add new publishers here as
// part of reviewing a new canonical URL instead of fetching arbitrary hosts.
const ALLOWED_CITATION_HOSTS = new Set([
  'ainowinstitute.org',
  'aisi.gov.uk',
  'alignment.org',
  'alignmentsurvey.com',
  'anthropic.com',
  'apolloresearch.ai',
  'archive-disarmament.unoda.org',
  'arxiv.org',
  'attack.mitre.org',
  'carnegieendowment.org',
  'cepr.org',
  'cisa.gov',
  'crossref.org',
  'deepmind.google',
  'dhs.gov',
  'digital-strategy.ec.europa.eu',
  'doi.org',
  'eur-lex.europa.eu',
  'example.com',
  'example.org',
  'freedomhouse.org',
  'ftc.gov',
  'gao.gov',
  'genai.owasp.org',
  'governance.ai',
  'govinfo.gov',
  'gradual-disempowerment.ai',
  'ic3.gov',
  'ico.org.uk',
  'icrc.org',
  'iea.org',
  'ilo.org',
  'imf.org',
  'internationalaisafetyreport.org',
  'jmlr.org',
  'lawfaremedia.org',
  'lesswrong.com',
  'metr.org',
  'microsoft.com',
  'ncsc.gov.uk',
  'nickbostrom.com',
  'nist.gov',
  'nonhumanminds.org',
  'oecd.ai',
  'oecd.org',
  'openai.com',
  'ora.ox.ac.uk',
  'papers.neurips.cc',
  'proceedings.mlr.press',
  'redwoodresearch.org',
  'saif.google',
  'sipri.org',
  'situational-awareness-dataset.org',
  'storage.googleapis.com',
  'transformer-circuits.pub',
  'un.org',
  'unep.org',
  'unesco.org'
])

const FALLBACK_ACRONYMS = {
  agi: 'AGI',
  ai: 'AI',
  ccw: 'CCW',
  cisa: 'CISA',
  dhs: 'DHS',
  ftc: 'FTC',
  gao: 'GAO',
  gdpr: 'GDPR',
  gpt: 'GPT',
  ilo: 'ILO',
  imf: 'IMF',
  ipd2: 'IPD2',
  llm: 'LLM',
  nist: 'NIST',
  oecd: 'OECD',
  openai: 'OpenAI'
} as const

const NAMED_HTML_ENTITIES = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’'
} as const

const PUBLISHERS_BY_HOSTNAME = {
  'aisi.gov.uk': 'UK AI Security Institute',
  'alignment.org': 'Alignment Research Center',
  'anthropic.com': 'Anthropic',
  'apolloresearch.ai': 'Apollo Research',
  'arxiv.org': 'arXiv',
  'cisa.gov': 'CISA',
  'deepmind.google': 'Google DeepMind',
  'doi.org': 'DOI',
  'genai.owasp.org': 'OWASP GenAI Security Project',
  'governance.ai': 'Centre for the Governance of AI',
  'internationalaisafetyreport.org': 'International AI Safety Report',
  'lesswrong.com': 'LessWrong',
  'metr.org': 'METR',
  'microsoft.com': 'Microsoft',
  'ncsc.gov.uk': 'UK National Cyber Security Centre',
  'nist.gov': 'NIST',
  'oecd.ai': 'OECD.AI',
  'oecd.org': 'OECD',
  'openai.com': 'OpenAI',
  'papers.neurips.cc': 'NeurIPS',
  'proceedings.mlr.press': 'Proceedings of Machine Learning Research',
  'redwoodresearch.org': 'Redwood Research',
  'saif.google': 'Google Secure AI Framework',
  'unesco.org': 'UNESCO'
} as const

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export type CitationFetcher = (
  input: string,
  init: RequestInit
) => Promise<Response>

export type CitationMetadataResult = {
  readonly citation: Citation
  readonly usedFallbackTitle: boolean
  readonly warning?: string
}

export async function resolveCitationMetadata(
  hrefs: readonly string[],
  options: {
    readonly cachedCitations?: readonly Citation[]
    readonly concurrency?: number
    readonly fetcher?: CitationFetcher
    readonly refresh?: boolean
  } = {}
) {
  const uniqueHrefs = [...new Set(hrefs)]
  const cachedByHref = new Map(
    (options.cachedCitations ?? []).map((citation) => [citation.href, citation])
  )
  const citationsByHref = new Map<string, Citation>()
  const hrefsToFetch: string[] = []

  for (const href of uniqueHrefs) {
    const cached = cachedByHref.get(href)
    const curatedTitle = curatedCitationTitle(href)
    if (curatedTitle) {
      const baseCitation = cached ?? fallbackCitationMetadata(href)
      citationsByHref.set(href, { ...baseCitation, title: curatedTitle })
    } else if (!options.refresh && cached) {
      citationsByHref.set(href, cached)
    } else {
      hrefsToFetch.push(href)
    }
  }

  const results = await pMap(
    hrefsToFetch,
    async (href) =>
      [href, await fetchCitationMetadata(href, options.fetcher)] as const,
    { concurrency: options.concurrency ?? 4 }
  )
  const warnings: string[] = []

  for (const [href, result] of results) {
    const cached = cachedByHref.get(href)
    if (result.usedFallbackTitle && cached) {
      citationsByHref.set(href, cached)
      warnings.push(
        `Citation metadata refresh failed for ${displayUrl(href)}; retained cached title “${cached.title}”`
      )
    } else {
      citationsByHref.set(href, result.citation)
      if (result.warning) warnings.push(result.warning)
    }
  }

  return { citationsByHref, warnings }
}

export async function fetchCitationMetadata(
  href: string,
  fetcher: CitationFetcher = fetch
): Promise<CitationMetadataResult> {
  const fallback = fallbackCitationMetadata(href)
  if (curatedCitationTitle(href)) {
    return {
      citation: fallback,
      usedFallbackTitle: false
    }
  }

  try {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
    const doiMetadata = await fetchDoiMetadata(href, signal, fetcher)
    if (doiMetadata) {
      return {
        citation: {
          href,
          title: doiMetadata.title,
          publisher: doiMetadata.publisher
        },
        usedFallbackTitle: false
      }
    }

    const { response, finalUrl } = await fetchFollowingSafeRedirects(
      href,
      signal,
      fetcher
    )
    if (!response.ok) {
      throw new Error(`received HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') ?? ''
    const expectsPdf =
      contentType.toLowerCase().includes('application/pdf') ||
      finalUrl.pathname.toLowerCase().endsWith('.pdf')
    const bytes = expectsPdf
      ? await readBoundedResponse(response, MAXIMUM_PDF_BYTES)
      : await readResponsePrefix(response)
    const isPdf = expectsPdf || startsWithPdfSignature(bytes)
    const extracted = isPdf
      ? {
          title:
            (await extractPdfTitle(bytes)) ??
            titleFromContentDisposition(
              response.headers.get('content-disposition')
            ),
          publisher: null
        }
      : extractCitationMetadataFromHtml(decodeResponse(bytes, contentType))
    const publisher =
      normalizeCitationText(extracted.publisher, 100) ??
      publisherFromUrl(finalUrl)
    const extractedTitle = normalizeCitationText(extracted.title, 300)
    const title =
      isUsefulRemoteTitle(extractedTitle) &&
      !(isPdf && isGenericPdfTitle(extractedTitle))
        ? stripPublisherSuffix(extractedTitle, publisher)
        : fallback.title

    const citation = {
      href,
      title,
      publisher: publisher ?? fallback.publisher
    }
    if (title === fallback.title) {
      return {
        citation,
        usedFallbackTitle: true,
        warning: `Citation metadata for ${displayUrl(href)} did not contain a usable title; using “${fallback.title}”`
      }
    }
    return { citation, usedFallbackTitle: false }
  } catch (err) {
    return {
      citation: fallback,
      usedFallbackTitle: true,
      warning: `Citation metadata fetch failed for ${displayUrl(href)}; using “${fallback.title}” (${errorMessage(err)})`
    }
  }
}

function curatedCitationTitle(href: string) {
  const url = new URL(href)
  return url.href in CURATED_CITATION_TITLES
    ? CURATED_CITATION_TITLES[url.href as keyof typeof CURATED_CITATION_TITLES]
    : null
}

export function extractCitationMetadataFromHtml(html: string) {
  const metadata = new Map<string, string>()

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseTagAttributes(match[0])
    const key = (
      attributes.property ??
      attributes.name ??
      attributes.itemprop
    )?.toLowerCase()
    const content = attributes.content
    if (key && content && !metadata.has(key)) metadata.set(key, content)
  }

  const titleElement = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1]

  return {
    title: firstDefined(
      metadata.get('citation_title'),
      metadata.get('dc.title'),
      metadata.get('og:title'),
      metadata.get('twitter:title'),
      titleElement
    ),
    publisher: firstDefined(
      metadata.get('citation_publisher'),
      metadata.get('og:site_name'),
      metadata.get('dc.publisher'),
      metadata.get('application-name')
    )
  }
}

export function fallbackCitationMetadata(href: string): Citation {
  const url = assertFetchableUrl(href)
  const publisher = publisherFromUrl(url)

  return {
    href,
    title:
      curatedCitationTitle(url.href) ?? fallbackTitleFromUrl(url, publisher),
    publisher
  }
}

async function fetchDoiMetadata(
  href: string,
  signal: AbortSignal,
  fetcher: CitationFetcher
) {
  const url = assertFetchableUrl(href)
  if (url.hostname !== 'doi.org') return null

  const doi = decodePathSegment(url.pathname.slice(1))
  if (!doi) return null
  const endpoint = `https://api.crossref.org/works/${encodeURIComponent(doi)}`

  try {
    const response = await fetcher(endpoint, {
      headers: {
        accept: 'application/json',
        'user-agent':
          'cultural-alignment-citation-sync/1.0 (+https://github.com/transitive-bullshit/cultural-alignment)'
      },
      redirect: 'manual',
      signal
    })
    if (!response.ok) return null

    const value: unknown = JSON.parse(
      decodeResponse(
        await readResponsePrefix(response),
        response.headers.get('content-type') ?? ''
      )
    )
    if (!value || typeof value !== 'object' || !('message' in value)) {
      return null
    }
    const message = value.message
    if (!message || typeof message !== 'object') return null
    const titleValue = 'title' in message ? message.title : null
    const title = normalizeCitationText(
      Array.isArray(titleValue) ? titleValue[0] : null,
      300
    )
    if (!title) return null
    const publisherValue =
      'publisher' in message && typeof message.publisher === 'string'
        ? message.publisher
        : null

    return {
      title,
      publisher:
        normalizeCitationText(publisherValue, 100) ?? publisherFromUrl(url)
    }
  } catch {
    return null
  }
}

async function fetchFollowingSafeRedirects(
  href: string,
  signal: AbortSignal,
  fetcher: CitationFetcher
) {
  let currentUrl = assertFetchableUrl(href)

  for (let redirectCount = 0; ; redirectCount += 1) {
    const response = await fetcher(currentUrl.href, {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.1',
        'user-agent':
          'cultural-alignment-citation-sync/1.0 (+https://github.com/transitive-bullshit/cultural-alignment)'
      },
      redirect: 'manual',
      signal
    })

    if (!REDIRECT_STATUSES.has(response.status)) {
      return { response, finalUrl: currentUrl }
    }
    if (redirectCount >= MAXIMUM_REDIRECTS) {
      throw new Error(`exceeded ${MAXIMUM_REDIRECTS} redirects`)
    }

    const location = response.headers.get('location')
    if (!location) throw new Error('redirect response had no location header')
    currentUrl = assertFetchableUrl(new URL(location, currentUrl).href)
  }
}

async function readResponsePrefix(response: Response) {
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()

  const chunks: Uint8Array[] = []
  let byteCount = 0

  try {
    while (byteCount < MAXIMUM_RESPONSE_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      const remaining = MAXIMUM_RESPONSE_BYTES - byteCount
      const chunk =
        value.byteLength > remaining ? value.slice(0, remaining) : value
      chunks.push(chunk)
      byteCount += chunk.byteLength
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  const bytes = new Uint8Array(byteCount)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function readBoundedResponse(response: Response, maximumBytes: number) {
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(
      `PDF response exceeded the ${Math.round(maximumBytes / 1024 / 1024)} MB limit`
    )
  }

  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let byteCount = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      byteCount += value.byteLength
      if (byteCount > maximumBytes) {
        throw new Error(
          `PDF response exceeded the ${Math.round(maximumBytes / 1024 / 1024)} MB limit`
        )
      }
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }

  const bytes = new Uint8Array(byteCount)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

function decodeResponse(bytes: Uint8Array, contentType: string) {
  const charset = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1]
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

function startsWithPdfSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
}

async function extractPdfTitle(bytes: Uint8Array) {
  try {
    const { getDocument, VerbosityLevel } =
      await import('pdfjs-dist/legacy/build/pdf.mjs')
    const loadingTask = getDocument({
      data: bytes.slice(),
      enableXfa: false,
      useSystemFonts: false,
      useWorkerFetch: false,
      verbosity: VerbosityLevel.ERRORS
    })

    try {
      const document = await loadingTask.promise
      const { info, metadata } = await document.getMetadata()
      const infoTitle = getPdfInfoTitle(info)
      const metadataTitle = metadata
        ? getStringValue(metadata.get('dc:title'))
        : null
      const title = firstDefined(
        metadataTitle ?? undefined,
        infoTitle ?? undefined
      )
      if (title) return title
    } finally {
      await loadingTask.destroy().catch(() => undefined)
    }
  } catch {
    // Some publishers serve malformed PDFs. The raw Info-dictionary parser
    // still recovers common uncompressed titles before URL fallback is used.
  }

  return extractRawPdfTitle(bytes)
}

function extractRawPdfTitle(bytes: Uint8Array) {
  const source = new TextDecoder('latin1').decode(bytes)
  const value = source.match(
    /\/Title\s*(?:\(((?:\\.|[^\\)])*)\)|<([0-9a-f]+)>)/i
  )
  if (!value) return null

  if (value[1] !== undefined) return decodePdfLiteral(value[1])
  return decodePdfHex(value[2]!)
}

function getPdfInfoTitle(value: unknown) {
  return value && typeof value === 'object' && 'Title' in value
    ? getStringValue(value.Title)
    : null
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : null
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
      String.fromCodePoint(Number.parseInt(octal, 8))
    )
    .replace(/\\([nrtbf()\\])/g, (_, escaped: string) => {
      const values = {
        b: '\b',
        f: '\f',
        n: '\n',
        r: '\r',
        t: '\t'
      }
      return values[escaped as keyof typeof values] ?? escaped
    })
}

function decodePdfHex(value: string) {
  const normalized = value.length % 2 === 0 ? value : `${value}0`
  const bytes = Uint8Array.from(normalized.match(/.{2}/g) ?? [], (pair) =>
    Number.parseInt(pair, 16)
  )
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    const codePoints: number[] = []
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      codePoints.push((bytes[index]! << 8) | bytes[index + 1]!)
    }
    return String.fromCharCode(...codePoints)
  }
  return new TextDecoder().decode(bytes)
}

function titleFromContentDisposition(value: string | null) {
  if (!value) return null
  const encoded = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  if (encoded) {
    try {
      return stripFileExtension(decodeURIComponent(encoded.trim()))
    } catch {
      return stripFileExtension(encoded.trim())
    }
  }
  const filename = value.match(/filename\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)
  return stripFileExtension(filename?.[1] ?? filename?.[2] ?? '')
}

function parseTagAttributes(tag: string) {
  const attributes: Record<string, string> = {}
  const source = tag.replace(/^<meta\b/i, '').replace(/\/?\s*>$/, '')
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

  for (const match of source.matchAll(pattern)) {
    const name = match[1]!.toLowerCase()
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? ''
  }
  return attributes
}

function normalizeCitationText(
  value: string | null | undefined,
  maximum: number
) {
  if (!value) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/[,;:]$/, '')
    .trim()
  return normalized ? normalized.slice(0, maximum).trim() : null
}

function decodeHtmlEntities(value: string) {
  return value.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z][a-z0-9]+));/gi,
    (entity, decimal: string, hexadecimal: string, named: string) => {
      if (decimal || hexadecimal) {
        const codePoint = Number.parseInt(
          decimal || hexadecimal,
          decimal ? 10 : 16
        )
        try {
          return String.fromCodePoint(codePoint)
        } catch {
          return entity
        }
      }
      return (
        NAMED_HTML_ENTITIES[
          named.toLowerCase() as keyof typeof NAMED_HTML_ENTITIES
        ] ?? entity
      )
    }
  )
}

function firstDefined(...values: readonly (string | undefined)[]) {
  return values.find((value) => value?.trim()) ?? null
}

function isUsefulRemoteTitle(value: string | null): value is string {
  return Boolean(
    value &&
    !/^(?:access denied|attention required|checking your browser|error|forbidden|just a moment|not found|page not found|service unavailable)(?:\b|[.!…])/i.test(
      value
    )
  )
}

function isGenericPdfTitle(value: string) {
  return /^(?:concept note|document|final|paper|publication|report|title|untitled)$/i.test(
    value
  )
}

function stripPublisherSuffix(title: string, publisher: string | null) {
  if (!publisher) return title
  const normalizedPublisher = publisher.toLowerCase().replace(/[^a-z0-9]+/g, '')

  for (const separator of [' | ', ' — ', ' – ', ' - ']) {
    const separatorIndex = title.lastIndexOf(separator)
    if (separatorIndex < 1) continue
    const suffix = title
      .slice(separatorIndex + separator.length)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
    if (suffix === normalizedPublisher) return title.slice(0, separatorIndex)
  }
  return title
}

function fallbackTitleFromUrl(url: URL, publisher: string | null) {
  if (url.hostname === 'arxiv.org') {
    const identifier = url.pathname.match(/^\/(?:abs|pdf)\/([^/]+)/)?.[1]
    if (identifier) return `arXiv: ${stripFileExtension(identifier)}`
  }
  if (url.hostname === 'doi.org') {
    return `DOI ${decodePathSegment(url.pathname.slice(1))}`
  }

  const segments = url.pathname
    .split('/')
    .map(decodePathSegment)
    .filter(Boolean)
  const ignoredSegments = new Set(['en', 'eng', 'final', 'index', 'oj'])
  const candidates = segments
    .toReversed()
    .filter((candidate) => !ignoredSegments.has(candidate.toLowerCase()))
  let segment = candidates[0]
  if (
    segment &&
    looksLikeOpaqueIdentifier(stripFileExtension(segment)) &&
    url.hostname.endsWith('lesswrong.com')
  ) {
    return `${publisher ?? 'LessWrong'} ${url.pathname.includes('/p/') ? 'article' : 'sequence'}`
  }
  if (
    segment &&
    looksLikeOpaqueIdentifier(stripFileExtension(segment)) &&
    url.hostname === 'papers.neurips.cc'
  ) {
    return 'NeurIPS paper'
  }
  if (segment && looksLikeOpaqueIdentifier(stripFileExtension(segment))) {
    const descriptiveCandidate = candidates.slice(1).find((candidate) => {
      const normalized = stripFileExtension(candidate)
      return (
        normalized.length > 3 &&
        !/^\d+$/.test(normalized) &&
        !looksLikeOpaqueIdentifier(normalized)
      )
    })
    if (descriptiveCandidate) segment = descriptiveCandidate
  }
  if (segment) segment = stripOpaqueSuffix(stripFileExtension(segment))
  if (segment && url.pathname.toLowerCase().endsWith('.pdf')) {
    segment = cleanPdfFilename(segment)
  }

  if (segment && /^\d+$/.test(segment)) {
    return `${publisher ?? url.hostname} publication ${segment}`
  }
  if (segment) return humanizeUrlText(segment)

  const hostLabel = url.hostname.replace(/^www\./, '').split('.')[0]!
  return publisher ? `${publisher} resource` : humanizeUrlText(hostLabel)
}

function cleanPdfFilename(value: string) {
  return value.replace(/^\d{2,4}[_-]\d{2,4}[_-]/, '').replace(/[_-]508c?$/i, '')
}

function humanizeUrlText(value: string) {
  const normalized = value
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return 'Linked publication'
  const words = normalized.split(' ').map((word) => {
    const acronym =
      FALLBACK_ACRONYMS[word.toLowerCase() as keyof typeof FALLBACK_ACRONYMS]
    return acronym ?? word
  })
  const title = words.join(' ')
  return `${title[0]!.toUpperCase()}${title.slice(1)}`.slice(0, 300)
}

function looksLikeOpaqueIdentifier(value: string) {
  const normalized = value.replace(/-abstract$/i, '')
  return (
    /^[0-9a-f]{8,}(?:-en)?$/i.test(normalized) ||
    (/^[a-z0-9]{14,}$/i.test(normalized) && /\d/.test(normalized))
  )
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function stripFileExtension(value: string) {
  return value.replace(/\.(?:html?|pdf)$/i, '')
}

function stripOpaqueSuffix(value: string) {
  return value.replace(/[_-][0-9a-f]{8,}(?:-en)?$/i, '')
}

function publisherFromUrl(url: URL) {
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
  if (
    hostname === 'storage.googleapis.com' &&
    url.pathname.toLowerCase().includes('deepmind')
  ) {
    return 'Google DeepMind'
  }

  for (const [domain, publisher] of Object.entries(PUBLISHERS_BY_HOSTNAME)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return publisher
  }
  return hostname || null
}

function assertFetchableUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('citation URL must use HTTP or HTTPS')
  }
  if (url.username || url.password) {
    throw new Error('citation URL must not contain credentials')
  }

  const hostname = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
    .toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isPrivateIpAddress(hostname)
  ) {
    throw new Error('citation URL must not target a local network address')
  }
  if (!isAllowedCitationHostname(hostname)) {
    throw new Error(`citation host is not approved: ${hostname}`)
  }
  return url
}

function isAllowedCitationHostname(hostname: string) {
  for (const allowedHostname of ALLOWED_CITATION_HOSTS) {
    if (
      hostname === allowedHostname ||
      hostname.endsWith(`.${allowedHostname}`)
    ) {
      return true
    }
  }
  return false
}

function isPrivateIpAddress(hostname: string) {
  const ipVersion = isIP(hostname)
  if (ipVersion === 4) {
    const [first, second] = hostname.split('.').map(Number)
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second! >= 64 && second! <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second! >= 16 && second! <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && second! >= 18 && second! <= 19) ||
      first! >= 224
    )
  }
  if (ipVersion === 6) {
    return (
      hostname === '::' ||
      hostname === '::1' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      /^fe[89ab]/.test(hostname) ||
      hostname.startsWith('::ffff:')
    )
  }
  return false
}

function displayUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.hostname}${url.pathname}`
  } catch {
    return 'configured citation URL'
  }
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'unknown error'
}
