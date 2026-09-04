import '@dotenvx/dotenvx/config'

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runNotionMemeUpload } from './notion-meme-uploader'

type CliOptions = {
  manifestPath?: string
  scenariosPath: string
  checkpointPath?: string
  apply: boolean
  replaceExisting: boolean
  concurrency: number
  retries: number
  help: boolean
}

const HELP = `Usage: pnpm memes:upload-notion --manifest=<path> [options]

Append rendered finalized memes to each scenario row's “Memes” files property.
The command is a read-only dry run unless --apply is supplied.

Options:
  --manifest=<path>    Required finalized meme export manifest
  --scenarios=<path>   Scenario snapshot used for slug → Notion page IDs
                       (default: content/snapshot/scenarios.json)
  --checkpoint=<path>  Resume checkpoint written only with --apply
                       (default: <manifest>.notion-upload-checkpoint.json)
  --concurrency=<n>    Scenario-level concurrency (default: 2)
  --retries=<n>        Retries for transient Notion errors (default: 5)
  --apply              Create uploads and apply the selected operation to Notion
  --replace-existing   Replace exactly matching attachment filenames instead of
                       appending. Missing or duplicate targets abort safely.
  --dry-run            Explicitly select the default read-only mode
  -h, --help           Show this help

Both modes read current Notion properties and require NOTION_TOKEN. Only --apply
creates file uploads, changes the “Memes” property, or writes a checkpoint.`

export function parseUploadCliArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    scenariosPath: 'content/snapshot/scenarios.json',
    apply: false,
    replaceExisting: false,
    concurrency: 2,
    retries: 5,
    help: false
  }
  let explicitDryRun = false

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!
    const [name = '', inlineValue] = argument.split('=', 2)

    if (name === '--apply') {
      options.apply = true
      continue
    }
    if (name === '--dry-run') {
      explicitDryRun = true
      continue
    }
    if (name === '--replace-existing') {
      options.replaceExisting = true
      continue
    }
    if (name === '--help' || name === '-h') {
      options.help = true
      continue
    }

    const takesValue = [
      '--manifest',
      '--scenarios',
      '--checkpoint',
      '--concurrency',
      '--retries'
    ].includes(name)
    if (!takesValue) throw new Error(`Unknown option: ${argument}`)

    const value = inlineValue ?? argv[++index]
    if (!value) throw new Error(`${name} requires a value`)

    if (name === '--manifest') options.manifestPath = value
    if (name === '--scenarios') options.scenariosPath = value
    if (name === '--checkpoint') options.checkpointPath = value
    if (name === '--concurrency')
      options.concurrency = parseInteger(value, name)
    if (name === '--retries') options.retries = parseInteger(value, name, true)
  }

  if (options.apply && explicitDryRun) {
    throw new Error('--apply and --dry-run cannot be combined')
  }
  if (!options.help && !options.manifestPath) {
    throw new Error('--manifest is required')
  }
  return options
}

async function main() {
  let options: CliOptions
  try {
    options = parseUploadCliArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    console.error('Run with --help for usage')
    process.exitCode = 1
    return
  }

  if (options.help) {
    console.log(HELP)
    return
  }

  const token = process.env.NOTION_TOKEN
  if (!token) {
    console.error(
      'NOTION_TOKEN is required, including for the read-only dry run'
    )
    process.exitCode = 1
    return
  }

  const manifestPath = resolve(options.manifestPath!)
  const checkpointPath = resolve(
    options.checkpointPath ?? `${manifestPath}.notion-upload-checkpoint.json`
  )

  try {
    const summary = await runNotionMemeUpload({
      manifestPath,
      scenariosPath: resolve(options.scenariosPath),
      checkpointPath,
      apply: options.apply,
      replaceExisting: options.replaceExisting,
      concurrency: options.concurrency,
      retries: options.retries,
      token
    })

    console.log(
      `${summary.mode === 'apply' ? 'Applied' : 'Dry run complete'} ${summary.operation}: ${summary.fileCount} exports across ${summary.scenarioCount} scenarios; ${summary.alreadyPresentCount} already present; ${summary.uploadedCount} uploaded; ${summary.attachedCount} attached; ${summary.replacedCount} replaced`
    )
    if (!options.apply) {
      console.log('No Notion data or local checkpoints were changed')
    }
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exitCode = 1
  }
}

function parseInteger(value: string, name: string, allowZero = false) {
  const parsed = Number(value)
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`)
  }
  return parsed
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) await main()
