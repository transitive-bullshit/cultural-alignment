import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  memeSkillFixtureCollectionSchema,
  type MemeSkillFixture
} from './schema'

export const memeEvalDirectory = dirname(fileURLToPath(import.meta.url))
export const memeSkillDirectory = resolve(memeEvalDirectory, '..')
export const workspaceDirectory = resolve(memeEvalDirectory, '../../../..')

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

export function toAgentVisibleFixture(fixture: MemeSkillFixture) {
  return {
    id: fixture.id,
    request: fixture.request,
    images: fixture.images.map(({ id, path, description }) => ({
      id,
      filename: path.split('/').at(-1),
      description
    })),
    protected_regions: fixture.protected_regions.map(
      ({ id, image_id, label, priority }) => ({
        id,
        image_id,
        label,
        priority
      })
    )
  }
}
