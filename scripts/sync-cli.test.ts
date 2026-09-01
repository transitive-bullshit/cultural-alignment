import { describe, expect, it } from 'vitest'

import { parseSyncCliArgs, SYNC_CLI_HELP } from './sync-cli'

describe('parseSyncCliArgs', () => {
  it('uses safe defaults when no arguments are provided', () => {
    expect(parseSyncCliArgs([])).toEqual({
      fast: false,
      force: false,
      help: false
    })
  })

  it('parses fast, force, and every help spelling', () => {
    expect(parseSyncCliArgs(['--fast'])).toEqual({
      fast: true,
      force: false,
      help: false
    })
    expect(parseSyncCliArgs(['--force'])).toEqual({
      fast: false,
      force: true,
      help: false
    })
    expect(parseSyncCliArgs(['--help'])).toEqual({
      fast: false,
      force: false,
      help: true
    })
    expect(parseSyncCliArgs(['-help'])).toEqual({
      fast: false,
      force: false,
      help: true
    })
    expect(parseSyncCliArgs(['-h', '--fast'])).toEqual({
      fast: true,
      force: false,
      help: true
    })
  })

  it.each([
    ['--fast', '--force'],
    ['--force', '--fast']
  ])('rejects conflicting image modes in either order', (...argv) => {
    expect(() => parseSyncCliArgs(argv)).toThrow(
      'Options "--fast" and "--force" cannot be used together. Run "pnpm content:sync --help" for usage.'
    )
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
    expect(SYNC_CLI_HELP).toContain('--fast')
    expect(SYNC_CLI_HELP).toContain('--force')
    expect(SYNC_CLI_HELP).toContain('-h, -help, --help')
  })
})
