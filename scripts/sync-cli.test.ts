import { describe, expect, it } from 'vitest'

import { parseSyncCliArgs, SYNC_CLI_HELP } from './sync-cli'

describe('parseSyncCliArgs', () => {
  it('uses safe defaults when no arguments are provided', () => {
    expect(parseSyncCliArgs([])).toEqual({ force: false, help: false })
  })

  it('parses force and both help spellings', () => {
    expect(parseSyncCliArgs(['--force'])).toEqual({
      force: true,
      help: false
    })
    expect(parseSyncCliArgs(['--help'])).toEqual({
      force: false,
      help: true
    })
    expect(parseSyncCliArgs(['-help'])).toEqual({
      force: false,
      help: true
    })
    expect(parseSyncCliArgs(['-h', '--force'])).toEqual({
      force: true,
      help: true
    })
  })

  it('rejects unknown options with a usage hint', () => {
    expect(() => parseSyncCliArgs(['--fresh'])).toThrow(
      'Unknown option "--fresh". Run "pnpm content:sync --help" for usage.'
    )
  })

  it('rejects positional arguments with a usage hint', () => {
    expect(() => parseSyncCliArgs(['scenarios'])).toThrow(
      'Unexpected positional argument "scenarios". Run "pnpm content:sync --help" for usage.'
    )
  })
})

describe('SYNC_CLI_HELP', () => {
  it('documents the command and every supported option', () => {
    expect(SYNC_CLI_HELP).toContain('pnpm content:sync [options]')
    expect(SYNC_CLI_HELP).toContain('--force')
    expect(SYNC_CLI_HELP).toContain('-h, -help, --help')
  })
})
