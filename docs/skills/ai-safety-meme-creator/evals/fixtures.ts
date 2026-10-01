import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  memeSkillFixtureCollectionSchema,
  type MemeSkillFixture
} from './schema'

const memeEvalDirectory = dirname(fileURLToPath(import.meta.url))

export const memeSkillFixtures = memeSkillFixtureCollectionSchema.parse(
  JSON.parse(
    readFileSync(join(memeEvalDirectory, 'fixtures', 'scenarios.json'), 'utf8')
  )
)

export function fixtureImagePath(
  fixture: MemeSkillFixture,
  imageId: string
): string {
  const image = fixture.images.find(({ id }) => id === imageId)
  if (!image) throw new Error(`Fixture ${fixture.id} has no image ${imageId}`)
  return resolve(memeEvalDirectory, image.path)
}
