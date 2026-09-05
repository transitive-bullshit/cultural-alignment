import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

import sharp from 'sharp'

import { renderSafeMemeIntent } from '../evals/safe-render'
import { memeSkillFixtureSchema } from '../evals/schema'
import { semanticMemeIntentSchema } from '../evals/semantic-plan'

const argumentsByName = parseArguments(process.argv.slice(2))
const fixturePath = resolve(requiredArgument(argumentsByName, 'fixture'))
const intentPath = resolve(requiredArgument(argumentsByName, 'intent'))
const outputPath = resolve(requiredArgument(argumentsByName, 'output'))
const previewPath = argumentsByName.get('preview')
  ? resolve(argumentsByName.get('preview')!)
  : undefined

const fixtureDirectory = dirname(fixturePath)
const parsedFixture = memeSkillFixtureSchema.parse(
  JSON.parse(await readFile(fixturePath, 'utf8'))
)
const fixture = {
  ...parsedFixture,
  images: parsedFixture.images.map((image) => ({
    ...image,
    path: isAbsolute(image.path)
      ? image.path
      : resolve(fixtureDirectory, image.path)
  }))
}
const intent = semanticMemeIntentSchema.parse(
  JSON.parse(await readFile(intentPath, 'utf8'))
)
if (intent.fixture_id !== fixture.id) {
  throw new Error(
    `Intent fixture ${intent.fixture_id} does not match ${fixture.id}`
  )
}

await mkdir(dirname(outputPath), { recursive: true })
if (previewPath) await mkdir(dirname(previewPath), { recursive: true })
const result = await renderSafeMemeIntent({
  fixture,
  intent,
  outputPath,
  previewPath
})

if (result.status === 'blocked') {
  console.log(JSON.stringify(result, null, 2))
} else {
  const metadata = await sharp(outputPath).metadata()
  console.log(
    JSON.stringify(
      {
        ...result,
        artifact: {
          path: outputPath,
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          sha256: await sha256(outputPath)
        },
        preview: previewPath
          ? { path: previewPath, sha256: await sha256(previewPath) }
          : null
      },
      null,
      2
    )
  )
}

function parseArguments(
  values: readonly string[]
): ReadonlyMap<string, string> {
  const parsed = new Map<string, string>()
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index]
    const value = values[index + 1]
    if (!name?.startsWith('--') || !value) {
      throw new TypeError(
        'Usage: compose-meme.ts --fixture fixture.json --intent intent.json --output render.png [--preview preview.png]'
      )
    }
    parsed.set(name.slice(2), value)
  }
  return parsed
}

function requiredArgument(
  values: ReadonlyMap<string, string>,
  name: string
): string {
  const value = values.get(name)
  if (!value) throw new TypeError(`Missing --${name}`)
  return value
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}
