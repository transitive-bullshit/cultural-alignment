import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'

import {
  buildMemeReviewExport,
  compactMemeReviewExport,
  type MemeCandidateBatch,
  type MemeCandidate,
  parseMemeCandidateBatch,
  prepareMemeCandidateBatch,
  renderMemeCandidateReview,
  restoreMemeReviewFeedback
} from './meme-candidate-review'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

function first<T>(items: T[]): T {
  const value = items[0]
  if (!value) throw new Error('Expected a fixture item')
  return value
}

function scenario(batch: MemeCandidateBatch) {
  return first(batch.scenarios)
}
function candidate(batch: MemeCandidateBatch): MemeCandidate {
  return first(scenario(batch).candidates)
}

function makeBatch(): MemeCandidateBatch {
  return {
    schemaVersion: 1,
    batchId: 'archive-candidates-2026-10-06',
    title: 'Local candidate review',
    createdAt: '2026-10-06T00:00:00Z',
    scenarios: [
      {
        id: '12345678-1234-1234-1234-123456789abc',
        slug: 'a-scene',
        title: 'A scene',
        source: { id: 'source-id', slug: 'a-source', title: 'A source' },
        scene: 'A machine follows the literal instruction',
        whyAnalogyWorks: 'Its behavior optimizes the requested target',
        caveats: 'This is an analogy',
        concepts: ['Specification gaming'],
        candidates: [
          {
            id: 'candidate-1',
            captionLines: [
              'Exactly what you asked for',
              'Exactly what you feared'
            ],
            concept: 'Specification gaming',
            recognitionHinge: 'The machine follows the literal instruction',
            whyItWorks: 'The visible result supplies the reversal',
            fixturePath: 'fixture.json',
            intentPath: 'intent.json',
            artifactPath: 'meme.png',
            previewPath: 'preview.png',
            sha256: 'a'.repeat(64),
            status: 'complete'
          }
        ]
      }
    ]
  }
}

async function stageBatch() {
  const root = await mkdtemp(join(tmpdir(), 'meme-candidate-review-'))
  directories.push(root)
  await writeFile(join(root, 'fixture.json'), '{}')
  await writeFile(join(root, 'intent.json'), '{}')
  const image = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: '#ddd' }
  })
    .png()
    .toBuffer()
  await writeFile(join(root, 'meme.png'), image)
  await sharp(image).resize(480).png().toFile(join(root, 'preview.png'))
  const batch = makeBatch()
  candidate(batch).sha256 = createHash('sha256').update(image).digest('hex')
  return { root, batch, manifestPath: join(root, 'batch.json') }
}

describe('meme candidate batch validation', () => {
  it('rejects duplicate candidate identities across scenarios and unsafe paths', () => {
    const batch = makeBatch()
    batch.scenarios.push({
      ...structuredClone(scenario(batch)),
      id: 'another-scenario'
    })
    expect(() => parseMemeCandidateBatch(batch)).toThrow(
      'Duplicate candidate ID'
    )
    const unsafe = makeBatch()
    candidate(unsafe).artifactPath = 'https://example.com/meme.png'
    expect(() => parseMemeCandidateBatch(unsafe)).toThrow('local file path')
  })

  it('requires complete renders and safe provenance', () => {
    const batch = makeBatch()
    expect(() =>
      parseMemeCandidateBatch({
        ...batch,
        scenarios: [
          {
            ...scenario(batch),
            candidates: [{ ...candidate(batch), status: 'blocked' }]
          }
        ]
      })
    ).toThrow()
    candidate(batch).visualSource = {
      path: 'source.png',
      description: 'Source frame',
      provenanceUrl: 'javascript:alert(1)'
    }
    expect(() => parseMemeCandidateBatch(batch)).toThrow(
      'HTTP(S) provenance URL'
    )
  })

  it('verifies files and artifact hashes before creating a review', async () => {
    const { batch, manifestPath } = await stageBatch()
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    expect(prepared.candidateFingerprints['candidate-1']).toMatch(
      /^[a-f\d]{64}$/
    )
    const changed = structuredClone(batch)
    candidate(changed).sha256 = 'b'.repeat(64)
    await expect(
      prepareMemeCandidateBatch(changed, manifestPath)
    ).rejects.toThrow('SHA-256 differs')
    const missing = structuredClone(batch)
    candidate(missing).intentPath = 'missing.json'
    await expect(
      prepareMemeCandidateBatch(missing, manifestPath)
    ).rejects.toThrow('ENOENT')
  })

  it('binds feedback to caption, scenario context, and intent bytes', async () => {
    const { root, batch, manifestPath } = await stageBatch()
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    const renamed = structuredClone(batch)
    candidate(renamed).captionLines[0] = 'A different joke'
    expect(
      (await prepareMemeCandidateBatch(renamed, manifestPath))
        .candidateFingerprints['candidate-1']
    ).not.toBe(prepared.candidateFingerprints['candidate-1'])
    const recontextualized = structuredClone(batch)
    scenario(recontextualized).caveats = 'A revised caveat'
    expect(
      (await prepareMemeCandidateBatch(recontextualized, manifestPath))
        .candidateFingerprints['candidate-1']
    ).not.toBe(prepared.candidateFingerprints['candidate-1'])
    await writeFile(join(root, 'intent.json'), '{"different":"intent"}')
    expect(
      (await prepareMemeCandidateBatch(batch, manifestPath))
        .candidateFingerprints['candidate-1']
    ).not.toBe(prepared.candidateFingerprints['candidate-1'])
  })
})

describe('feedback and export identity', () => {
  it('copies compact bulk feedback that still restores the exact candidate', async () => {
    const { batch, manifestPath } = await stageBatch()
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    const full = buildMemeReviewExport(prepared, {
      'candidate-1': {
        rating: 'liked',
        feedback: 'Keep the visual',
        approvedForUpload: true
      }
    })
    const compact = compactMemeReviewExport(full)
    expect(compact.manifestPath).toBe(manifestPath)
    expect(first(compact.candidates).scenarioId).toBe(scenario(batch).id)
    expect(first(compact.candidates)).not.toHaveProperty('candidate')
    expect(JSON.stringify(compact).length).toBeLessThan(
      JSON.stringify(full).length / 2
    )
    expect(
      restoreMemeReviewFeedback(batch.batchId, full.candidates, compact)
        .restored['candidate-1']
    ).toEqual(first(full.candidates).review)
  })

  it('preserves existing reviews when later candidates join the same batch', async () => {
    const { batch, manifestPath } = await stageBatch()
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    const backup = buildMemeReviewExport(prepared, {
      'candidate-1': {
        rating: 'liked',
        feedback: 'Keep this version',
        approvedForUpload: true
      }
    })
    const expanded = structuredClone(batch)
    expanded.title = 'The completed batch'
    scenario(expanded).candidates.push({
      ...structuredClone(candidate(expanded)),
      id: 'candidate-2',
      captionLines: ['A later candidate']
    })
    const next = await prepareMemeCandidateBatch(expanded, manifestPath)
    expect(next.batchFingerprint).not.toBe(prepared.batchFingerprint)
    const bindings = buildMemeReviewExport(next, {}, 'all').candidates.map(
      ({ candidateId, candidateFingerprint, sha256 }) => ({
        candidateId,
        candidateFingerprint,
        sha256
      })
    )
    expect(
      restoreMemeReviewFeedback(next.batchId, bindings, backup).restored
    ).toEqual({
      'candidate-1': {
        rating: 'liked',
        feedback: 'Keep this version',
        approvedForUpload: true
      }
    })
  })

  it('separates likes from approval and copies exact caption and Notion identity', async () => {
    const { batch, manifestPath } = await stageBatch()
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    const liked = {
      'candidate-1': {
        rating: 'liked' as const,
        feedback: 'Keep the image',
        approvedForUpload: false
      }
    }
    expect(
      buildMemeReviewExport(prepared, liked, 'approved').candidates
    ).toEqual([])
    const copied = buildMemeReviewExport(prepared, liked)
    expect(first(copied.candidates).scenario.notionPageUrl).toBe(
      'https://app.notion.com/p/12345678123412341234123456789abc'
    )
    expect(first(copied.candidates).candidate.captionLines).toEqual(
      candidate(batch).captionLines
    )
    expect(first(copied.candidates).candidate.artifactPath).toContain(
      'meme.png'
    )
    expect(first(copied.candidates).review.feedback).toBe('Keep the image')
  })

  it('restores only matching batch, candidate fingerprint, and artifact hash', async () => {
    const { batch, manifestPath } = await stageBatch()
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    const backup = buildMemeReviewExport(
      prepared,
      {
        'candidate-1': {
          rating: 'liked',
          feedback: 'Yes',
          approvedForUpload: true
        }
      },
      'all'
    )
    const bindings = backup.candidates.map(
      ({ candidateId, candidateFingerprint, sha256 }) => ({
        candidateId,
        candidateFingerprint,
        sha256
      })
    )
    expect(
      first(
        Object.values(
          restoreMemeReviewFeedback(batch.batchId, bindings, backup).restored
        )
      ).approvedForUpload
    ).toBe(true)
    expect(() =>
      restoreMemeReviewFeedback('another-batch', bindings, backup)
    ).toThrow('different batch')
    const changed = structuredClone(backup)
    first(changed.candidates).candidateFingerprint = 'c'.repeat(64)
    expect(
      restoreMemeReviewFeedback(batch.batchId, bindings, changed)
    ).toMatchObject({ restored: {}, skipped: 1 })
    first(changed.candidates).candidateFingerprint = first(
      backup.candidates
    ).candidateFingerprint
    first(changed.candidates).sha256 = 'd'.repeat(64)
    expect(
      restoreMemeReviewFeedback(batch.batchId, bindings, changed)
    ).toMatchObject({ restored: {}, skipped: 1 })
    first(backup.candidates).review.rating = 'disliked'
    expect(
      first(
        Object.values(
          restoreMemeReviewFeedback(batch.batchId, bindings, backup).restored
        )
      ).approvedForUpload
    ).toBe(false)
  })

  it('escapes captions and embedded JSON so content cannot create executable HTML', async () => {
    const { batch, root, manifestPath } = await stageBatch()
    candidate(batch).captionLines = [
      '</script><script>alert("caption")</script>'
    ]
    const prepared = await prepareMemeCandidateBatch(batch, manifestPath)
    const html = renderMemeCandidateReview(prepared, join(root, 'review.html'))
    expect(html).not.toContain('</script><script>alert')
    expect(html).toContain('&lt;/script&gt;')
    expect(html).toContain('\\u003c/script\\u003e')
    expect(html).toContain("connect-src 'none'")
    // The renderer never rewrites the staged inputs or image bytes.
    expect(await readFile(join(root, 'fixture.json'), 'utf8')).toBe('{}')
  })
})
