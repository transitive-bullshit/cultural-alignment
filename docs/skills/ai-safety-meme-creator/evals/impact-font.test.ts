import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { resolveImpactFont } from './impact-font'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('Impact font resolution', () => {
  it('rejects an explicit override whose embedded family is not Impact', async () => {
    const directory = await temporaryDirectory()
    const wrongFontPath = join(directory, 'Impact.ttf')
    const systemImpactPath = join(directory, 'system-impact.ttf')
    await Promise.all([
      writeFile(
        wrongFontPath,
        sfntWithNames('Barlow Condensed', 'Barlow Condensed ExtraBold')
      ),
      writeFile(systemImpactPath, sfntWithNames('Impact', 'Impact'))
    ])

    expect(
      resolveImpactFont({
        environment: { MEME_IMPACT_FONT_PATH: wrongFontPath },
        systemPaths: [systemImpactPath]
      })
    ).toMatchObject({
      status: 'unavailable',
      reason: 'identity_mismatch',
      path: wrongFontPath,
      source: 'environment',
      identity: {
        familyNames: ['Barlow Condensed'],
        fullNames: ['Barlow Condensed ExtraBold']
      }
    })
  })

  it('accepts an explicit override only when its embedded names identify Impact', async () => {
    const directory = await temporaryDirectory()
    const impactPath = join(directory, 'custom-font.ttf')
    await writeFile(impactPath, sfntWithNames('Impact', 'Impact'))

    expect(
      resolveImpactFont({
        environment: { MEME_IMPACT_FONT_PATH: impactPath },
        systemPaths: []
      })
    ).toEqual({
      status: 'resolved',
      filePath: impactPath,
      family: 'Impact',
      source: 'environment',
      identity: {
        familyNames: ['Impact'],
        fullNames: ['Impact']
      }
    })
  })

  it('uses a verified operating-system candidate when no override is set', async () => {
    const directory = await temporaryDirectory()
    const missingPath = join(directory, 'missing.ttf')
    const impactPath = join(directory, 'Impact.ttf')
    await writeFile(impactPath, sfntWithNames('Impact', 'Impact'))

    expect(
      resolveImpactFont({
        environment: {},
        systemPaths: [missingPath, impactPath]
      })
    ).toMatchObject({
      status: 'resolved',
      filePath: impactPath,
      family: 'Impact',
      source: 'system'
    })
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'impact-font-'))
  temporaryDirectories.push(directory)
  return directory
}

function sfntWithNames(familyName: string, fullName: string): Buffer {
  const encodedNames = [familyName, fullName].map(utf16BigEndian)
  const stringOffset = 6 + encodedNames.length * 12
  const nameTableLength =
    stringOffset + encodedNames.reduce((total, name) => total + name.length, 0)
  const nameTableOffset = 12 + 16
  const buffer = Buffer.alloc(nameTableOffset + nameTableLength)

  buffer.writeUInt32BE(0x00010000, 0)
  buffer.writeUInt16BE(1, 4)
  buffer.write('name', 12, 'ascii')
  buffer.writeUInt32BE(nameTableOffset, 20)
  buffer.writeUInt32BE(nameTableLength, 24)

  buffer.writeUInt16BE(0, nameTableOffset)
  buffer.writeUInt16BE(encodedNames.length, nameTableOffset + 2)
  buffer.writeUInt16BE(stringOffset, nameTableOffset + 4)

  let storedNameOffset = 0
  encodedNames.forEach((encodedName, index) => {
    const recordOffset = nameTableOffset + 6 + index * 12
    buffer.writeUInt16BE(3, recordOffset)
    buffer.writeUInt16BE(1, recordOffset + 2)
    buffer.writeUInt16BE(0x0409, recordOffset + 4)
    buffer.writeUInt16BE(index === 0 ? 1 : 4, recordOffset + 6)
    buffer.writeUInt16BE(encodedName.length, recordOffset + 8)
    buffer.writeUInt16BE(storedNameOffset, recordOffset + 10)
    encodedName.copy(buffer, nameTableOffset + stringOffset + storedNameOffset)
    storedNameOffset += encodedName.length
  })

  return buffer
}

function utf16BigEndian(value: string): Buffer {
  const buffer = Buffer.alloc(value.length * 2)
  for (let index = 0; index < value.length; index += 1) {
    buffer.writeUInt16BE(value.charCodeAt(index), index * 2)
  }
  return buffer
}
