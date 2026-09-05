import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ImpactFontIdentity {
  readonly familyNames: readonly string[]
  readonly fullNames: readonly string[]
}

export interface ResolvedImpactFont {
  readonly status: 'resolved'
  readonly filePath: string
  readonly family: 'Impact'
  readonly source: 'environment' | 'system'
  readonly identity: ImpactFontIdentity
}

export interface UnavailableImpactFont {
  readonly status: 'unavailable'
  readonly reason:
    | 'missing'
    | 'unreadable'
    | 'unsupported_font'
    | 'identity_mismatch'
  readonly message: string
  readonly path?: string
  readonly source?: 'environment' | 'system'
  readonly identity?: ImpactFontIdentity
}

export type ImpactFontResolution = ResolvedImpactFont | UnavailableImpactFont

export interface ResolveImpactFontOptions {
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly systemPaths?: readonly string[]
}

interface CandidateFailure extends UnavailableImpactFont {
  readonly path: string
  readonly source: 'environment' | 'system'
}

export function resolveImpactFont(
  options: ResolveImpactFontOptions = {}
): ImpactFontResolution {
  const environment = options.environment ?? process.env
  const overridePath = environment.MEME_IMPACT_FONT_PATH?.trim()
  if (overridePath) {
    return inspectCandidate(overridePath, 'environment')
  }

  const systemPaths = options.systemPaths ?? defaultImpactFontPaths(environment)
  let firstInvalidCandidate: CandidateFailure | undefined
  for (const path of systemPaths) {
    const candidate = inspectCandidate(path, 'system')
    if (candidate.status === 'resolved') return candidate
    if (candidate.reason !== 'missing' && !firstInvalidCandidate) {
      firstInvalidCandidate = candidate
    }
  }

  return (
    firstInvalidCandidate ?? {
      status: 'unavailable',
      reason: 'missing',
      message:
        'No verified Impact font was found; set MEME_IMPACT_FONT_PATH to an Impact font file'
    }
  )
}

export function defaultImpactFontPaths(
  environment: Readonly<Record<string, string | undefined>> = process.env
): readonly string[] {
  const paths = [
    '/System/Library/Fonts/Supplemental/Impact.ttf',
    '/Library/Fonts/Impact.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/Impact.ttf',
    '/usr/share/fonts/truetype/msttcorefonts/impact.ttf'
  ]
  const windowsDirectory = environment.WINDIR?.trim()
  return windowsDirectory
    ? [join(windowsDirectory, 'Fonts', 'impact.ttf'), ...paths]
    : paths
}

function inspectCandidate(
  path: string,
  source: 'environment' | 'system'
): ResolvedImpactFont | CandidateFailure {
  let bytes: Buffer
  try {
    bytes = readFileSync(path)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String(err.code)
        : undefined
    const missing = code === 'ENOENT' || code === 'ENOTDIR'
    return {
      status: 'unavailable',
      reason: missing ? 'missing' : 'unreadable',
      message: missing
        ? `Impact font candidate does not exist: ${path}`
        : `Impact font candidate is not readable: ${path}`,
      path,
      source
    }
  }

  let identity: ImpactFontIdentity
  try {
    identity = readSfntIdentity(bytes)
  } catch (err) {
    return {
      status: 'unavailable',
      reason: 'unsupported_font',
      message:
        err instanceof Error
          ? `Impact font candidate is invalid: ${err.message}`
          : 'Impact font candidate is invalid',
      path,
      source
    }
  }

  const isImpact = (name: string) =>
    name.normalize('NFKC').trim().toLocaleLowerCase('en-US') === 'impact'
  if (
    !identity.familyNames.some(isImpact) ||
    !identity.fullNames.some(isImpact)
  ) {
    return {
      status: 'unavailable',
      reason: 'identity_mismatch',
      message: `Font metadata does not identify Impact: ${path}`,
      path,
      source,
      identity
    }
  }

  return {
    status: 'resolved',
    filePath: path,
    family: 'Impact',
    source,
    identity
  }
}

function readSfntIdentity(bytes: Buffer): ImpactFontIdentity {
  if (bytes.length < 12) throw new Error('file is shorter than an SFNT header')
  const signature = bytes.subarray(0, 4).toString('latin1')
  const scalerType = bytes.readUInt32BE(0)
  if (
    scalerType !== 0x00010000 &&
    signature !== 'OTTO' &&
    signature !== 'true' &&
    signature !== 'typ1'
  ) {
    throw new Error('file is not a supported TTF or OTF font')
  }

  const tableCount = bytes.readUInt16BE(4)
  const tableDirectoryEnd = 12 + tableCount * 16
  if (tableCount === 0 || tableDirectoryEnd > bytes.length) {
    throw new Error('SFNT table directory is truncated')
  }

  let nameTableOffset = -1
  let nameTableLength = 0
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16
    if (
      bytes.subarray(recordOffset, recordOffset + 4).toString('ascii') !==
      'name'
    ) {
      continue
    }
    nameTableOffset = bytes.readUInt32BE(recordOffset + 8)
    nameTableLength = bytes.readUInt32BE(recordOffset + 12)
    break
  }
  if (nameTableOffset < 0) throw new Error('font has no name table')
  if (!containsRange(bytes, nameTableOffset, nameTableLength)) {
    throw new Error('font name table is truncated')
  }
  if (nameTableLength < 6) throw new Error('font name table has no header')

  const recordCount = bytes.readUInt16BE(nameTableOffset + 2)
  const stringOffset = bytes.readUInt16BE(nameTableOffset + 4)
  const recordsEnd = 6 + recordCount * 12
  if (recordsEnd > nameTableLength || stringOffset > nameTableLength) {
    throw new Error('font name records are truncated')
  }

  const familyNames: string[] = []
  const fullNames: string[] = []
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = nameTableOffset + 6 + index * 12
    const platformId = bytes.readUInt16BE(recordOffset)
    const nameId = bytes.readUInt16BE(recordOffset + 6)
    if (nameId !== 1 && nameId !== 4 && nameId !== 16) continue

    const length = bytes.readUInt16BE(recordOffset + 8)
    const relativeOffset = bytes.readUInt16BE(recordOffset + 10)
    const valueOffset = nameTableOffset + stringOffset + relativeOffset
    if (
      relativeOffset + length > nameTableLength - stringOffset ||
      !containsRange(bytes, valueOffset, length)
    ) {
      throw new Error('font name string is truncated')
    }
    const value = decodeName(
      bytes.subarray(valueOffset, valueOffset + length),
      platformId
    )
    if (!value) continue
    const target = nameId === 4 ? fullNames : familyNames
    if (!target.includes(value)) target.push(value)
  }

  if (!familyNames.length || !fullNames.length) {
    throw new Error('font lacks family or full-name metadata')
  }
  return { familyNames, fullNames }
}

function decodeName(bytes: Buffer, platformId: number): string {
  const value =
    platformId === 0 || platformId === 3
      ? decodeUtf16BigEndian(bytes)
      : bytes.toString('latin1')
  return value.replaceAll('\0', '').trim()
}

function decodeUtf16BigEndian(bytes: Buffer): string {
  if (bytes.length % 2 !== 0) {
    throw new Error('UTF-16 font name has an odd byte length')
  }
  let value = ''
  for (let offset = 0; offset < bytes.length; offset += 2) {
    value += String.fromCharCode(bytes.readUInt16BE(offset))
  }
  return value
}

function containsRange(bytes: Buffer, offset: number, length: number): boolean {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(length) &&
    offset >= 0 &&
    length >= 0 &&
    offset <= bytes.length &&
    length <= bytes.length - offset
  )
}
