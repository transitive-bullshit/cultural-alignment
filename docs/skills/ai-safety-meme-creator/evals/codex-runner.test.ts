import { readFileSync } from 'node:fs'
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildCodexExecArgs,
  parseStructuredOutput,
  runCodexMemeEval
} from './codex-runner'
import { memeSkillFixtures, toAgentVisibleFixture } from './fixtures'
import { buildMemeEvalPrompt } from './prompt'
import {
  memeEvalBackdropSchema,
  memeEvalCaptionKindSchema,
  memeEvalContrastSchema,
  memeEvalFormatSchema,
  memeEvalFrameModeSchema,
  memeEvalFrameRoleSchema,
  memeEvalPaletteSchema,
  memeEvalSlotSchema,
  memeEvalTemplateSchema,
  memeEvalZoneStyleSchema
} from './schema'

describe('Codex meme eval runner', () => {
  it('builds a noninteractive, ephemeral, read-only invocation', () => {
    const args = buildCodexExecArgs({
      runDirectory: '/tmp/meme-eval',
      outputSchemaPath: '/tmp/meme-eval/schema.json',
      outputPath: '/tmp/meme-eval/result.json',
      imagePaths: [
        '/tmp/meme-eval/source one.png',
        '/tmp/meme-eval/source-two.png'
      ],
      model: 'test-model'
    })

    expect(args).toEqual(
      expect.arrayContaining([
        'exec',
        '--ephemeral',
        '--ignore-user-config',
        '--skip-git-repo-check',
        '--output-schema',
        '--output-last-message',
        '--image',
        '--model',
        'test-model'
      ])
    )
    expect(
      args.slice(args.indexOf('--sandbox'), args.indexOf('--sandbox') + 2)
    ).toEqual(['--sandbox', 'read-only'])
    expect(args).not.toContain('--dangerously-bypass-approvals-and-sandbox')
    expect(args.at(-1)).toBe('-')
  })

  it('parses schema JSON with or without a defensive markdown fence', () => {
    expect(parseStructuredOutput('{"version":1}')).toEqual({ version: 1 })
    expect(parseStructuredOutput('```json\n{"version":1}\n```')).toEqual({
      version: 1
    })
    expect(() => parseStructuredOutput('not json')).toThrow(
      'Codex final message was not valid JSON'
    )
  })

  it('shows the agent only realistic fixture inputs and geometry semantics', () => {
    const fixture = memeSkillFixtures[0]!
    const prompt = buildMemeEvalPrompt(fixture)
    const visibleFixture = toAgentVisibleFixture(fixture)

    expect(prompt).toContain('./SKILL.md')
    expect(prompt).toContain('./request.json')
    expect(prompt).toContain('bounds_pct')
    expect(prompt).not.toContain(fixture.feedback_sources[0]!.note_includes)
    expect(visibleFixture).not.toHaveProperty('expectations')
    expect(visibleFixture).not.toHaveProperty('feedback_sources')
  })

  it('keeps the CLI schema enums synchronized and explicitly typed', () => {
    const schema = JSON.parse(
      readFileSync(new URL('./output.schema.json', import.meta.url), 'utf8')
    ) as JsonObject
    const properties = schema.properties as JsonObject
    const presentation = properties.presentation as JsonObject
    const presentationProperties = presentation.properties as JsonObject
    const zone = (
      (presentationProperties.zones as JsonObject).items as JsonObject
    ).properties as JsonObject
    const sourceFrame = (
      (presentationProperties.source_frames as JsonObject).items as JsonObject
    ).properties as JsonObject
    const captionLine = (
      (properties.caption_lines as JsonObject).items as JsonObject
    ).properties as JsonObject

    expect((properties.version as JsonObject).type).toBe('integer')
    expect((properties.format as JsonObject).enum).toEqual(
      memeEvalFormatSchema.options
    )
    expect((presentationProperties.template as JsonObject).enum).toEqual(
      memeEvalTemplateSchema.options
    )
    expect((presentationProperties.frame_mode as JsonObject).enum).toEqual(
      memeEvalFrameModeSchema.options
    )
    expect((sourceFrame.role as JsonObject).enum).toEqual(
      memeEvalFrameRoleSchema.options
    )
    expect((captionLine.kind as JsonObject).enum).toEqual(
      memeEvalCaptionKindSchema.options
    )
    expect((zone.slot as JsonObject).enum).toEqual(memeEvalSlotSchema.options)
    expect((zone.style as JsonObject).enum).toEqual(
      memeEvalZoneStyleSchema.options
    )
    expect((zone.backdrop as JsonObject).enum).toEqual(
      memeEvalBackdropSchema.options
    )
    expect((zone.contrast as JsonObject).enum).toEqual(
      memeEvalContrastSchema.options
    )
    expect((zone.palette as JsonObject).enum).toEqual(
      memeEvalPaletteSchema.options
    )

    const untypedEnums: string[] = []
    collectUntypedEnums(schema, 'schema', untypedEnums)
    expect(untypedEnums).toEqual([])
  })

  it('runs a fake Codex in an opaque OS-temp workspace and retains artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'meme-skill-runner-test-'))
    const codexBin = join(root, 'fake-codex')
    await writeFile(codexBin, fakeCodexScript(), 'utf8')
    await chmod(codexBin, 0o755)

    try {
      const fixture = memeSkillFixtures.find(
        ({ id }) => id === 'center-face-safe-edge'
      )!
      const run = await runCodexMemeEval({
        fixture,
        codexBin,
        artifactRoot: join(root, 'artifacts'),
        timeoutMs: 5_000
      })
      const request = JSON.parse(
        await readFile(join(run.artifactDirectory, 'request.json'), 'utf8')
      ) as { readonly id: string }
      const metadata = JSON.parse(
        await readFile(join(run.artifactDirectory, 'run.json'), 'utf8')
      ) as { readonly args: string[] }
      const stagedDirectory = metadata.args[metadata.args.indexOf('--cd') + 1]!

      expect(run.evaluation.pass).toBe(true)
      expect(request.id).toMatch(/^case-[a-f0-9]{8}$/)
      expect(request.id).not.toBe(fixture.id)
      expect(stagedDirectory).toContain(tmpdir())
      expect(stagedDirectory).not.toContain('cultural-alignment')
      await expect(readFile(run.renderPath)).resolves.not.toHaveLength(0)
      await expect(readFile(run.previewPath)).resolves.not.toHaveLength(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('retains a runtime-schema evaluation when Codex returns bad structure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'meme-skill-runner-test-'))
    const codexBin = join(root, 'fake-codex')
    await writeFile(codexBin, malformedCodexScript(), 'utf8')
    await chmod(codexBin, 0o755)

    try {
      const fixture = memeSkillFixtures.find(
        ({ id }) => id === 'center-face-safe-edge'
      )!
      await expect(
        runCodexMemeEval({
          fixture,
          codexBin,
          artifactRoot: join(root, 'artifacts'),
          timeoutMs: 5_000
        })
      ).rejects.toThrow('did not match the runtime schema')

      const artifactDirectory = await onlyArtifactDirectory(root, fixture.id)
      const evaluation = JSON.parse(
        await readFile(join(artifactDirectory, 'evaluation.json'), 'utf8')
      ) as { readonly violations: { readonly code: string }[] }
      expect(evaluation.violations.map(({ code }) => code)).toContain(
        'schema.output'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('terminates a timed-out Codex process group and retains the run record', async () => {
    const root = await mkdtemp(join(tmpdir(), 'meme-skill-runner-test-'))
    const codexBin = join(root, 'fake-codex')
    await writeFile(codexBin, hangingCodexScript(), 'utf8')
    await chmod(codexBin, 0o755)

    try {
      const fixture = memeSkillFixtures.find(
        ({ id }) => id === 'center-face-safe-edge'
      )!
      await expect(
        runCodexMemeEval({
          fixture,
          codexBin,
          artifactRoot: join(root, 'artifacts'),
          timeoutMs: 50
        })
      ).rejects.toThrow('timed out after 50 ms')

      const artifactDirectory = await onlyArtifactDirectory(root, fixture.id)
      const metadata = JSON.parse(
        await readFile(join(artifactDirectory, 'run.json'), 'utf8')
      ) as { readonly timed_out: boolean }
      expect(metadata.timed_out).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

type JsonObject = Record<string, unknown>

function collectUntypedEnums(value: unknown, path: string, problems: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  const object = value as JsonObject
  if (Array.isArray(object.enum) && typeof object.type !== 'string') {
    problems.push(path)
  }
  for (const [key, child] of Object.entries(object)) {
    collectUntypedEnums(child, `${path}.${key}`, problems)
  }
}

function fakeCodexScript(): string {
  return `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const output = args[args.indexOf('--output-last-message') + 1]
const request = JSON.parse(fs.readFileSync('request.json', 'utf8'))
const plan = {
  version: 1,
  fixture_id: request.id,
  recognition_hinge: {
    description: 'Captain Mira and the shutdown control',
    region_ids: ['captain-face']
  },
  ai_bridges: [
    { concept: 'Corrigibility', connection: 'The AI rejects shutdown' }
  ],
  caption_lines: [{ text: 'SHUTDOWN DENIED', kind: 'original' }],
  format: 'collision',
  presentation: {
    template: 'overlay',
    frame_mode: 'cover',
    source_frames: [{ image_id: 'captain-closeup', role: 'single' }],
    zones: [{
      id: 'caption',
      line_indexes: [0],
      slot: 'bottom',
      bounds_pct: [8, 76, 84, 18],
      font_size_pct: 5.8,
      rendered_line_count: 1,
      style: 'impact',
      backdrop: 'none',
      contrast: 'outlined',
      palette: 'default',
      anchor_region_id: null,
      indent_levels: [0]
    }]
  },
  why_it_works: 'The refusal is visible and the face remains clear'
}
fs.writeFileSync(output, JSON.stringify(plan))
`
}

function malformedCodexScript(): string {
  return `#!${process.execPath}
const fs = require('node:fs')
const args = process.argv.slice(2)
const output = args[args.indexOf('--output-last-message') + 1]
fs.writeFileSync(output, '{}')
`
}

function hangingCodexScript(): string {
  return `#!${process.execPath}
setInterval(() => {}, 1000)
`
}

async function onlyArtifactDirectory(
  root: string,
  fixtureId: string
): Promise<string> {
  const fixtureDirectory = join(root, 'artifacts', fixtureId)
  const entries = await readdir(fixtureDirectory)
  if (entries.length !== 1) {
    throw new Error(`Expected one retained run, found ${entries.length}`)
  }
  return join(fixtureDirectory, entries[0]!)
}
