export interface SyncCliOptions {
  fast: boolean
  force: boolean
  help: boolean
}

export const SYNC_CLI_HELP = `Usage: pnpm content:sync [options]

Sync content from Notion and update the generated snapshot.

Options:
  --fast       Skip image processing and assume images are unchanged
  --force      Re-download and reprocess all images
  -h, -help, --help
               Show this help message

Image modes --fast and --force cannot be combined.`

const HELP_HINT = 'Run "pnpm content:sync --help" for usage.'

export function parseSyncCliArgs(argv: readonly string[]): SyncCliOptions {
  const options: SyncCliOptions = {
    fast: false,
    force: false,
    help: false
  }

  for (const argument of argv) {
    if (argument === '--fast') {
      options.fast = true
      continue
    }

    if (argument === '--force') {
      options.force = true
      continue
    }

    if (argument === '--help' || argument === '-help' || argument === '-h') {
      options.help = true
      continue
    }

    const description = argument.startsWith('-')
      ? `Unknown option "${argument}".`
      : `Unexpected positional argument "${argument}".`

    throw new Error(`${description} ${HELP_HINT}`)
  }

  if (options.fast && options.force) {
    throw new Error(
      `Options "--fast" and "--force" cannot be used together. ${HELP_HINT}`
    )
  }

  return options
}
