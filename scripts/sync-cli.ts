export interface SyncCliOptions {
  force: boolean
  help: boolean
}

export const SYNC_CLI_HELP = `Usage: pnpm content:sync [options]

Sync content from Notion and publish generated media to R2.

Options:
  --force      Re-download and reprocess all images
  -h, -help, --help
               Show this help message`

const HELP_HINT = 'Run "pnpm content:sync --help" for usage.'

export function parseSyncCliArgs(argv: readonly string[]): SyncCliOptions {
  const options: SyncCliOptions = {
    force: false,
    help: false
  }

  for (const argument of argv) {
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

  return options
}
