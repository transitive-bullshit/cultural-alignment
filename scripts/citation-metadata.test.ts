import { describe, expect, it, vi } from 'vitest'

import type { Citation } from '../lib/content/schema'
import {
  type CitationFetcher,
  fallbackCitationMetadata,
  fetchCitationMetadata,
  resolveCitationMetadata
} from './citation-metadata'

describe('fetchCitationMetadata', () => {
  it('prefers citation metadata and normalizes entities and whitespace', async () => {
    const href = 'https://example.org/research/alignment'
    const fetcher = vi.fn<CitationFetcher>(async () =>
      htmlResponse(`
        <html>
          <head>
            <meta property="og:title" content="Open Graph title">
            <meta name="dc.title" content="Dublin Core title">
            <meta
              content="  Safety&nbsp; &amp; &#x41;lignment  "
              name="citation_title"
            >
            <meta property="og:site_name" content="Other publisher">
            <meta
              content="  Example&nbsp;   Research &#73;nstitute  "
              name="citation_publisher"
            >
            <title>Document title</title>
          </head>
        </html>
      `)
    )

    await expect(fetchCitationMetadata(href, fetcher)).resolves.toEqual({
      citation: {
        href,
        title: 'Safety & Alignment',
        publisher: 'Example Research Institute'
      },
      usedFallbackTitle: false
    })
  })

  it('extracts a known publisher from a subdomain and removes its title suffix', async () => {
    const href = 'https://research.anthropic.com/policies/responsible-scaling'
    const fetcher = vi.fn<CitationFetcher>(async () =>
      htmlResponse('<title>Responsible Scaling Policy — Anthropic</title>')
    )

    const result = await fetchCitationMetadata(href, fetcher)

    expect(result.citation).toEqual({
      href,
      title: 'Responsible Scaling Policy',
      publisher: 'Anthropic'
    })
    expect(result.usedFallbackTitle).toBe(false)
  })

  it('follows safe redirects and derives metadata from the final URL', async () => {
    const href = 'https://example.org/publications/ai-risk'
    const destination = 'https://www.nist.gov/itl/ai-risk-management-framework'
    const fetcher = vi
      .fn<CitationFetcher>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: destination }
        })
      )
      .mockResolvedValueOnce(
        htmlResponse('<title>AI Risk Management Framework - NIST</title>')
      )

    const result = await fetchCitationMetadata(href, fetcher)

    expect(result).toEqual({
      citation: {
        href,
        title: 'AI Risk Management Framework',
        publisher: 'NIST'
      },
      usedFallbackTitle: false
    })
    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      href,
      destination
    ])
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      href,
      expect.objectContaining({ redirect: 'manual' })
    )
  })

  it('uses deterministic URL metadata when HTML has a failure title', async () => {
    const href = 'https://example.com/research/model-evaluations.html'
    const fetcher = vi.fn<CitationFetcher>(async () =>
      htmlResponse('<html><head><title>Access denied</title></head></html>')
    )

    const result = await fetchCitationMetadata(href, fetcher)

    expect(result.citation).toEqual(fallbackCitationMetadata(href))
    expect(result.usedFallbackTitle).toBe(true)
    expect(result.warning).toContain('did not contain a usable title')
    expect(result.citation.title).toBe('Model evaluations')
  })

  it('extracts a normalized title from PDF metadata', async () => {
    const href = 'https://arxiv.org/pdf/2401.12345.pdf'
    const pdf = pdfWithTitle('  A Safety Case (Revised)  ')
    const fetcher = vi.fn<CitationFetcher>(
      async () =>
        new Response(pdf, {
          status: 200,
          headers: { 'content-type': 'application/pdf' }
        })
    )

    await expect(fetchCitationMetadata(href, fetcher)).resolves.toEqual({
      citation: {
        href,
        title: 'A Safety Case (Revised)',
        publisher: 'arXiv'
      },
      usedFallbackTitle: false
    })
  })

  it('uses a descriptive PDF filename when embedded metadata is generic', async () => {
    const href =
      'https://www.nist.gov/system/files/Concept%20Note_%20Development%20of%20the%20NIST%20AI%20RMF%20Profile.pdf'
    const fetcher = vi.fn<CitationFetcher>(
      async () =>
        new Response(pdfWithTitle('Concept Note:'), {
          status: 200,
          headers: { 'content-type': 'application/pdf' }
        })
    )

    const result = await fetchCitationMetadata(href, fetcher)

    expect(result.citation.title).toBe(
      'Concept Note Development of the NIST AI RMF Profile'
    )
    expect(result.usedFallbackTitle).toBe(true)
  })

  it('resolves DOI titles through Crossref before visiting the publisher', async () => {
    const href = 'https://doi.org/10.1145/3571730'
    const fetcher = vi.fn<CitationFetcher>(async () =>
      Response.json({
        message: {
          title: ['A taxonomy of risks posed by language models :'],
          publisher: 'Association for Computing Machinery (ACM)'
        }
      })
    )

    await expect(fetchCitationMetadata(href, fetcher)).resolves.toEqual({
      citation: {
        href,
        title: 'A taxonomy of risks posed by language models',
        publisher: 'Association for Computing Machinery (ACM)'
      },
      usedFallbackTitle: false
    })
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.crossref.org/works/10.1145%2F3571730',
      expect.objectContaining({
        headers: expect.objectContaining({ accept: 'application/json' })
      })
    )
  })

  it('rejects direct local URLs before fetching', async () => {
    const fetcher = vi.fn<CitationFetcher>()

    await expect(
      fetchCitationMetadata('http://127.0.0.1/private', fetcher)
    ).rejects.toThrow('citation URL must not target a local network address')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('falls back without following a redirect to a local URL', async () => {
    const href = 'https://example.org/research/safe-start'
    const fetcher = vi.fn<CitationFetcher>(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://localhost/internal' }
        })
    )

    const result = await fetchCitationMetadata(href, fetcher)

    expect(result.citation).toEqual(fallbackCitationMetadata(href))
    expect(result.usedFallbackTitle).toBe(true)
    expect(result.warning).toContain(
      'citation URL must not target a local network address'
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects citation hosts that have not been editorially approved', async () => {
    const fetcher = vi.fn<CitationFetcher>()

    await expect(
      fetchCitationMetadata('https://unreviewed-publisher.test/paper', fetcher)
    ).rejects.toThrow(
      'citation host is not approved: unreviewed-publisher.test'
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe('resolveCitationMetadata', () => {
  it('reuses cached entries, refreshes explicitly, and deduplicates URLs', async () => {
    const cachedHref = 'https://openai.com/index/preparedness-framework'
    const cachedCitation: Citation = {
      href: cachedHref,
      title: 'Preparedness Framework',
      publisher: 'OpenAI'
    }
    const freshHref = 'https://example.org/research/fresh-paper'
    const fallbackHref = 'https://example.org/research/retry-paper'
    const fetcher = vi.fn<CitationFetcher>(async (input: string) =>
      htmlResponse(
        input === freshHref
          ? '<meta name="citation_title" content="Fresh safety paper">'
          : '<meta name="citation_title" content="Retried safety paper">'
      )
    )

    const result = await resolveCitationMetadata(
      [cachedHref, freshHref, freshHref, fallbackHref, fallbackHref],
      {
        cachedCitations: [
          cachedCitation,
          fallbackCitationMetadata(fallbackHref)
        ],
        fetcher
      }
    )

    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([freshHref])
    expect(result.citationsByHref.size).toBe(3)
    expect(result.citationsByHref.get(cachedHref)).toBe(cachedCitation)
    expect(result.citationsByHref.get(freshHref)?.title).toBe(
      'Fresh safety paper'
    )
    expect(result.citationsByHref.get(fallbackHref)).toEqual(
      fallbackCitationMetadata(fallbackHref)
    )
    expect(result.warnings).toEqual([])

    const refreshed = await resolveCitationMetadata(
      [fallbackHref, fallbackHref],
      {
        cachedCitations: [fallbackCitationMetadata(fallbackHref)],
        fetcher,
        refresh: true
      }
    )

    expect(fetcher.mock.calls.map(([input]) => input)).toEqual([
      freshHref,
      fallbackHref
    ])
    expect(refreshed.citationsByHref.get(fallbackHref)?.title).toBe(
      'Retried safety paper'
    )
  })

  it('retains a good cached title when an explicit refresh fails', async () => {
    const href = 'https://example.org/research/verified-paper'
    const cachedCitation: Citation = {
      href,
      title: 'Verified paper title',
      publisher: 'Example Research'
    }
    const fetcher = vi.fn<CitationFetcher>(async () =>
      htmlResponse('<title>Access denied</title>')
    )

    const result = await resolveCitationMetadata([href], {
      cachedCitations: [cachedCitation],
      fetcher,
      refresh: true
    })

    expect(result.citationsByHref.get(href)).toBe(cachedCitation)
    expect(result.warnings).toEqual([
      expect.stringContaining('retained cached title “Verified paper title”')
    ])
  })
})

describe('fallbackCitationMetadata', () => {
  it('does not expose opaque CMS identifiers as citation titles', () => {
    expect(
      fallbackCitationMetadata(
        'https://www.lesswrong.com/s/3ni2P2GZzBvNebWYZ/p/RzsXRbk2ETNqjhsma'
      ).title
    ).toBe('AI Safety Strategies Landscape')
    expect(
      fallbackCitationMetadata(
        'https://www.oecd.org/en/publications/artificial-intelligence-data-and-competition_e7e88884-en.html'
      ).title
    ).toBe('Artificial intelligence data and competition')
  })

  it('uses reviewed titles for sources with opaque or incomplete metadata', async () => {
    const href = 'https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.800-1.ipd2.pdf'
    const fetcher = vi.fn<CitationFetcher>()

    await expect(fetchCitationMetadata(href, fetcher)).resolves.toEqual({
      citation: {
        href,
        title: 'Managing Misuse Risk for Dual-Use Foundation Models',
        publisher: 'NIST'
      },
      usedFallbackTitle: false
    })
    expect(fetcher).not.toHaveBeenCalled()
  })
})

function htmlResponse(html: string) {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })
}

function pdfWithTitle(title: string) {
  const escapedTitle = title.replace(/[\\()]/g, '\\$&')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [] /Count 0 >>',
    `<< /Title (${escapedTitle}) >>`
  ]
  let source = '%PDF-1.4\n'
  const offsets = [0]

  for (const [index, object] of objects.entries()) {
    offsets.push(source.length)
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
  }

  const xrefOffset = source.length
  source += `xref\n0 ${objects.length + 1}\n`
  source += '0000000000 65535 f \n'
  source += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\n`
  source += `startxref\n${xrefOffset}\n%%EOF`
  return source
}
