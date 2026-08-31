import { describe, expect, it, vi } from 'vitest'

import {
  boldWarning,
  formatImageBatchSummary,
  formatNotionRecord,
  NotionSyncReport
} from './notion-sync-report'

const totals = {
  scenarios: 3,
  sources: 2,
  franchises: 1,
  riskFamilies: 1,
  concepts: 1
}

describe('NotionSyncReport', () => {
  it('keeps processing after a record operation throws', async () => {
    const warn = vi.fn<(message: string) => void>()
    const report = new NotionSyncReport(totals, {
      log: vi.fn<(message: string) => void>(),
      warn
    })

    const failed = await report.capture(
      'scenarios',
      { id: 'scenario-1', title: 'Keep Summer Safe' },
      'processing the image for',
      () => {
        throw new Error('received HTTP 503')
      }
    )
    const succeeded = await report.capture(
      'scenarios',
      { id: 'scenario-2', title: 'Order 66' },
      'processing the image for',
      () => 'image-result'
    )

    expect(failed).toBeNull()
    expect(succeeded).toBe('image-result')
    expect(report.counts('scenarios')).toEqual({
      total: 3,
      succeeded: 2,
      errors: 1
    })
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '"Keep Summer Safe" (Notion ID: scenario-1): received HTTP 503'
      )
    )
  })

  it('counts a record once when more than one operation reports it', () => {
    const report = new NotionSyncReport(totals, {
      log: vi.fn<(message: string) => void>(),
      warn: vi.fn<(message: string) => void>()
    })

    report.recordError(
      'sources',
      { id: 'source-1', title: 'Rick and Morty' },
      'parsing',
      new Error('first')
    )
    report.recordError(
      'sources',
      { id: 'source-1', title: 'Rick and Morty' },
      'validating',
      new Error('second')
    )

    expect(report.counts('sources')).toEqual({
      total: 2,
      succeeded: 1,
      errors: 1
    })
  })

  it('prints successful and errored counts for every Notion collection', () => {
    const log = vi.fn<(message: string) => void>()
    const report = new NotionSyncReport(totals, {
      log,
      warn: vi.fn<(message: string) => void>()
    })
    report.recordError(
      'concepts',
      { id: 'concept-1', title: 'Specification Gaming' },
      'validating',
      new Error('invalid URL')
    )

    report.printSummary()

    expect(log.mock.calls.map(([message]) => message)).toEqual([
      'Notion record sync summary:',
      '- Scenarios: 3 succeeded, 0 encountered errors',
      '- Sources: 2 succeeded, 0 encountered errors',
      '- Franchises: 1 succeeded, 0 encountered errors',
      '- Risk families: 1 succeeded, 0 encountered errors',
      '- Safety concepts: 0 succeeded, 1 encountered an error'
    ])
  })
})

describe('Notion sync diagnostics', () => {
  it('pairs a readable title with the opaque Notion ID when available', () => {
    expect(formatNotionRecord({ id: 'opaque-id', title: '  WALL-E  ' })).toBe(
      '"WALL-E" (Notion ID: opaque-id)'
    )
    expect(formatNotionRecord({ id: 'opaque-id' })).toBe(
      '(Notion ID: opaque-id)'
    )
    expect(boldWarning('Something failed')).toBe(
      '\u001B[1mWARNING:\u001B[22m Something failed'
    )
  })

  it('summarizes uploaded and reusable images without counting absent images', () => {
    expect(
      formatImageBatchSummary('Media source images', [
        { uploaded: true },
        { uploaded: false },
        { uploaded: false },
        null
      ])
    ).toBe('Media source images: 1 changed and uploaded, 2 already synced.')
  })
})
