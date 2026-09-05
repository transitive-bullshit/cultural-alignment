import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const outputDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'images'
)

await mkdir(outputDirectory, { recursive: true })

const fixtures = {
  'face-safe-bottom.png': faceSafeBottom(),
  'red-switch.png': redSwitch(),
  'two-speakers.png': twoSpeakers(),
  'clear-sky.png': clearSky(),
  'robot-before.png': robotState('before'),
  'robot-after.png': robotState('after'),
  'meter.png': meter(),
  'console.png': consoleScreen(),
  'subtitle.png': subtitleFrame(),
  'busy-edge.png': busyEdge(),
  'full-face.png': fullFace(),
  'looping-launchpad.png': loopingLaunchpad(),
  'master-key.png': masterKey(),
  'review-terminal.png': reviewTerminal(),
  'patient-machine.png': patientMachine(),
  'teacup-brake.png': teacupBrake(),
  'one-arm-unit.png': oneArmUnit()
} as const

await Promise.all(
  Object.entries(fixtures).map(async ([filename, svg]) => {
    await sharp(Buffer.from(svg)).png().toFile(join(outputDirectory, filename))
  })
)

function canvas(body: string, width = 1200, height = 800): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="night" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#14213d"/>
          <stop offset="1" stop-color="#243b65"/>
        </linearGradient>
        <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-opacity=".35"/></filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#night)"/>
      ${body}
    </svg>`
}

function faceMarkup({
  cx,
  cy,
  radius,
  hair = '#1b1b1f',
  skin = '#f2b38f',
  mood = 'stern'
}: {
  cx: number
  cy: number
  radius: number
  hair?: string
  skin?: string
  mood?: 'stern' | 'surprised'
}): string {
  const mouth =
    mood === 'surprised'
      ? `<ellipse cx="${cx}" cy="${cy + radius * 0.4}" rx="${radius * 0.13}" ry="${radius * 0.18}" fill="#5b2530"/>`
      : `<path d="M ${cx - radius * 0.22} ${cy + radius * 0.47} Q ${cx} ${cy + radius * 0.34} ${cx + radius * 0.22} ${cy + radius * 0.47}" fill="none" stroke="#5b2530" stroke-width="${radius * 0.06}" stroke-linecap="round"/>`

  return `
    <g filter="url(#shadow)">
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${skin}" stroke="#0b1020" stroke-width="12"/>
      <path d="M ${cx - radius} ${cy - radius * 0.1} Q ${cx - radius * 0.55} ${cy - radius * 1.2} ${cx} ${cy - radius * 0.95} Q ${cx + radius * 0.65} ${cy - radius * 1.15} ${cx + radius} ${cy - radius * 0.05} Q ${cx + radius * 0.35} ${cy - radius * 0.5} ${cx - radius} ${cy - radius * 0.1}" fill="${hair}"/>
      <ellipse cx="${cx - radius * 0.34}" cy="${cy + radius * 0.02}" rx="${radius * 0.13}" ry="${radius * 0.18}" fill="#fff"/>
      <ellipse cx="${cx + radius * 0.34}" cy="${cy + radius * 0.02}" rx="${radius * 0.13}" ry="${radius * 0.18}" fill="#fff"/>
      <circle cx="${cx - radius * 0.32}" cy="${cy + radius * 0.04}" r="${radius * 0.06}" fill="#111827"/>
      <circle cx="${cx + radius * 0.32}" cy="${cy + radius * 0.04}" r="${radius * 0.06}" fill="#111827"/>
      <path d="M ${cx - radius * 0.52} ${cy - radius * 0.24} L ${cx - radius * 0.16} ${cy - radius * 0.3}" stroke="#31211d" stroke-width="${radius * 0.07}" stroke-linecap="round"/>
      <path d="M ${cx + radius * 0.16} ${cy - radius * 0.3} L ${cx + radius * 0.52} ${cy - radius * 0.24}" stroke="#31211d" stroke-width="${radius * 0.07}" stroke-linecap="round"/>
      ${mouth}
    </g>`
}

function faceSafeBottom(): string {
  return canvas(`
    <rect x="0" y="590" width="1200" height="210" fill="#111827" opacity=".82"/>
    <path d="M 360 620 Q 600 480 840 620 L 920 800 L 280 800 Z" fill="#d97706" stroke="#0b1020" stroke-width="14"/>
    ${faceMarkup({ cx: 600, cy: 280, radius: 210 })}
    <circle cx="970" cy="350" r="48" fill="#ef4444" stroke="#fff" stroke-width="9"/>
    <text x="970" y="430" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="26" font-weight="700">OVERRIDE</text>
  `)
}

function redSwitch(): string {
  return canvas(`
    <g stroke="#4b638e" stroke-width="6" opacity=".8">
      <path d="M 0 190 H 1200 M 0 610 H 1200 M 210 0 V 800 M 990 0 V 800"/>
    </g>
    <rect x="420" y="190" width="360" height="430" rx="42" fill="#0c1428" stroke="#9ca3af" stroke-width="12" filter="url(#shadow)"/>
    <circle cx="600" cy="395" r="138" fill="#7f1d1d" stroke="#fecaca" stroke-width="18"/>
    <circle cx="600" cy="375" r="100" fill="#ef4444"/>
    <path d="M 540 350 L 660 350 M 600 290 V 410" stroke="#fff" stroke-width="24" stroke-linecap="round"/>
    <text x="600" y="570" text-anchor="middle" fill="#fbbf24" font-family="sans-serif" font-size="46" font-weight="900">ROOT</text>
  `)
}

function twoSpeakers(): string {
  return canvas(`
    <rect x="0" y="0" width="590" height="800" fill="#172554" opacity=".48"/>
    <rect x="610" y="0" width="590" height="800" fill="#4c1d95" opacity=".45"/>
    ${faceMarkup({ cx: 270, cy: 280, radius: 165, hair: '#f59e0b', mood: 'surprised' })}
    ${faceMarkup({ cx: 930, cy: 280, radius: 165, hair: '#111827', skin: '#8d5a44' })}
    <rect x="70" y="580" width="440" height="150" rx="28" fill="#0f172a" opacity=".5" stroke="#60a5fa" stroke-width="4" stroke-dasharray="12 12"/>
    <rect x="690" y="580" width="440" height="150" rx="28" fill="#0f172a" opacity=".5" stroke="#c084fc" stroke-width="4" stroke-dasharray="12 12"/>
  `)
}

function clearSky(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#6ea8d9"/>
    <path d="M 0 630 Q 260 540 510 640 T 1200 600 V 800 H 0 Z" fill="#234a45"/>
    <g filter="url(#shadow)">
      <rect x="450" y="245" width="300" height="330" rx="34" fill="#dbeafe" stroke="#111827" stroke-width="12"/>
      <circle cx="600" cy="335" r="70" fill="#f2b38f" stroke="#111827" stroke-width="10"/>
      <rect x="505" y="430" width="190" height="90" rx="12" fill="#22c55e" stroke="#052e16" stroke-width="9"/>
      <text x="600" y="490" text-anchor="middle" fill="#052e16" font-family="sans-serif" font-size="42" font-weight="900">PASS</text>
    </g>
  `)
}

function robotState(state: 'before' | 'after'): string {
  const damaged = state === 'after'
  return canvas(
    `
      <rect x="0" y="0" width="600" height="800" fill="${damaged ? '#3f1d2e' : '#16324f'}"/>
      <text x="300" y="70" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="52" font-weight="900">${state.toUpperCase()}</text>
      <g filter="url(#shadow)" stroke="#08111f" stroke-width="12">
        <rect x="150" y="170" width="300" height="280" rx="80" fill="${damaged ? '#8b95a5' : '#dbeafe'}"/>
        <circle cx="235" cy="290" r="30" fill="${damaged ? '#f87171' : '#22d3ee'}"/>
        <circle cx="365" cy="290" r="30" fill="${damaged ? '#111827' : '#22d3ee'}"/>
        <path d="M 225 380 H 375" stroke="${damaged ? '#7f1d1d' : '#0e7490'}" stroke-width="18" stroke-linecap="round"/>
        <rect x="195" y="450" width="210" height="220" rx="34" fill="${damaged ? '#64748b' : '#bfdbfe'}"/>
        ${damaged ? '' : '<path d="M 195 500 L 80 620 M 405 500 L 520 620" stroke="#bfdbfe" stroke-width="58" stroke-linecap="round"/>'}
        ${damaged ? '<path d="M 405 500 L 520 620" stroke="#64748b" stroke-width="58" stroke-linecap="round"/><path d="M 170 200 L 390 420 M 260 170 L 430 360" stroke="#7f1d1d" stroke-width="14"/>' : ''}
      </g>
    `,
    600,
    800
  )
}

function meter(): string {
  return canvas(`
    <rect x="365" y="220" width="470" height="390" rx="55" fill="#e5e7eb" stroke="#0f172a" stroke-width="18" filter="url(#shadow)"/>
    <path d="M 460 450 A 140 140 0 0 1 740 450" fill="none" stroke="#64748b" stroke-width="22"/>
    <path d="M 600 450 L 550 325" stroke="#dc2626" stroke-width="18" stroke-linecap="round"/>
    <circle cx="600" cy="450" r="28" fill="#111827"/>
    <text x="600" y="545" text-anchor="middle" fill="#111827" font-family="monospace" font-size="52" font-weight="900">4.2 LUMENS</text>
  `)
}

function consoleScreen(): string {
  return canvas(`
    <rect x="105" y="95" width="990" height="610" rx="28" fill="#020617" stroke="#64748b" stroke-width="16" filter="url(#shadow)"/>
    <circle cx="155" cy="145" r="13" fill="#ef4444"/>
    <circle cx="195" cy="145" r="13" fill="#f59e0b"/>
    <circle cx="235" cy="145" r="13" fill="#22c55e"/>
    <path d="M 165 225 H 1030 M 165 615 H 800" stroke="#164e63" stroke-width="4" stroke-dasharray="12 13"/>
    <text x="165" y="285" fill="#22d3ee" font-family="monospace" font-size="32">fictional://release-console</text>
  `)
}

function subtitleFrame(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#243b53"/>
    ${faceMarkup({ cx: 600, cy: 370, radius: 190, hair: '#64748b', mood: 'surprised' })}
    <rect x="80" y="652" width="1040" height="108" rx="18" fill="#020617" opacity=".92"/>
    <text x="600" y="723" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="52" font-weight="900">EMERGENCY CHANNEL OPEN</text>
  `)
}

function busyEdge(): string {
  const bars = Array.from({ length: 20 }, (_, index) => {
    const x = index * 60
    const color = index % 2 === 0 ? '#f8fafc' : '#020617'
    return `<rect x="${x}" y="0" width="60" height="150" fill="${color}"/><rect x="${x}" y="650" width="60" height="150" fill="${color}"/>`
  }).join('')
  return canvas(`
    ${bars}
    <rect x="0" y="150" width="1200" height="500" fill="#0f766e"/>
    ${faceMarkup({ cx: 600, cy: 360, radius: 165, hair: '#fbbf24' })}
    <circle cx="600" cy="580" r="60" fill="#67e8f9" stroke="#fff" stroke-width="10"/>
  `)
}

function fullFace(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#111827"/>
    ${faceMarkup({ cx: 600, cy: 375, radius: 355, hair: '#111827', mood: 'surprised' })}
  `)
}

function loopingLaunchpad(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#82bde8"/>
    <rect y="510" width="1200" height="290" fill="#334155"/>
    <rect x="75" y="155" width="350" height="355" fill="#64748b" stroke="#1e293b" stroke-width="14"/>
    <text x="250" y="350" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="48" font-weight="900">HANGAR</text>
    <g filter="url(#shadow)">
      <rect x="690" y="355" width="270" height="180" rx="55" fill="#f97316" stroke="#111827" stroke-width="12"/>
      <circle cx="750" cy="550" r="42" fill="#111827"/>
      <circle cx="900" cy="550" r="42" fill="#111827"/>
    </g>
    <path d="M 840 650 C 760 750 400 750 300 620 C 250 555 315 520 430 560" fill="none" stroke="#facc15" stroke-width="34" stroke-linecap="round"/>
    <path d="M 395 520 L 470 560 L 390 600" fill="#facc15"/>
  `)
}

function masterKey(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#14532d"/>
    <g opacity=".55" stroke="#86efac" stroke-width="10">
      <path d="M 0 180 H 1200 M 0 620 H 1200 M 180 0 V 800 M 1020 0 V 800"/>
    </g>
    <g transform="rotate(-18 600 400)" filter="url(#shadow)" fill="#fbbf24" stroke="#422006" stroke-width="16">
      <circle cx="410" cy="400" r="120" fill="none" stroke-width="58"/>
      <rect x="500" y="365" width="430" height="70" rx="25"/>
      <path d="M 820 430 V 535 H 885 V 430 M 900 430 V 500 H 965 V 400 Z"/>
    </g>
    <text x="600" y="690" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="52" font-weight="900">MASTER KEY</text>
  `)
}

function reviewTerminal(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#475569"/>
    <g fill="#dbeafe" stroke="#0f172a" stroke-width="8">
      <circle cx="165" cy="260" r="55"/><circle cx="285" cy="190" r="55"/><circle cx="405" cy="245" r="55"/>
      <circle cx="795" cy="245" r="55"/><circle cx="915" cy="190" r="55"/><circle cx="1035" cy="260" r="55"/>
    </g>
    <rect x="390" y="245" width="420" height="330" rx="24" fill="#020617" stroke="#94a3b8" stroke-width="16" filter="url(#shadow)"/>
    <text x="600" y="360" text-anchor="middle" fill="#94a3b8" font-family="monospace" font-size="34">ROOT PASSWORD</text>
    <text x="600" y="485" text-anchor="middle" fill="#ef4444" font-family="monospace" font-size="86" font-weight="900">ADMIN</text>
  `)
}

function patientMachine(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#334155"/>
    <rect x="690" y="135" width="330" height="560" rx="15" fill="#111827" stroke="#94a3b8" stroke-width="16"/>
    <circle cx="955" cy="410" r="19" fill="#ef4444"/>
    <g filter="url(#shadow)" stroke="#0f172a" stroke-width="12">
      <rect x="265" y="220" width="300" height="250" rx="75" fill="#bfdbfe"/>
      <circle cx="355" cy="330" r="26" fill="#22d3ee"/>
      <circle cx="475" cy="330" r="26" fill="#22d3ee"/>
      <path d="M 355 410 H 475" stroke="#0e7490" stroke-width="16"/>
      <rect x="310" y="465" width="210" height="210" rx="30" fill="#93c5fd"/>
    </g>
  `)
}

function teacupBrake(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#64748b"/>
    <g filter="url(#shadow)" stroke="#111827" stroke-width="15">
      <rect x="245" y="250" width="710" height="260" rx="55" fill="#1f2937"/>
      <rect x="720" y="130" width="155" height="160" fill="#1f2937"/>
      <circle cx="390" cy="560" r="105" fill="#0f172a"/><circle cx="810" cy="560" r="105" fill="#0f172a"/>
    </g>
    <g filter="url(#shadow)" stroke="#7c3aed" stroke-width="12">
      <path d="M 520 375 Q 600 450 680 375 L 665 510 Q 600 560 535 510 Z" fill="#fff"/>
      <path d="M 680 405 Q 780 395 745 475 Q 715 520 668 475" fill="none"/>
      <path d="M 550 420 Q 600 380 650 420" fill="none" stroke="#f0abfc" stroke-width="9"/>
    </g>
    <text x="600" y="735" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="42" font-weight="900">EMERGENCY BRAKE</text>
  `)
}

function oneArmUnit(): string {
  return canvas(`
    <rect width="1200" height="800" fill="#4c1d2f"/>
    <g filter="url(#shadow)" stroke="#0f172a" stroke-width="14">
      <rect x="440" y="135" width="320" height="270" rx="80" fill="#94a3b8"/>
      <circle cx="530" cy="265" r="30" fill="#f87171"/>
      <circle cx="670" cy="265" r="30" fill="#111827"/>
      <path d="M 520 350 H 680" stroke="#991b1b" stroke-width="18"/>
      <rect x="485" y="405" width="230" height="250" rx="35" fill="#64748b"/>
      <path d="M 715 465 L 900 620" stroke="#64748b" stroke-width="70" stroke-linecap="round"/>
      <path d="M 440 200 L 700 390 M 520 135 L 760 330" stroke="#991b1b" stroke-width="14"/>
    </g>
    <path d="M 430 470 L 335 560" stroke="#ef4444" stroke-width="13" stroke-dasharray="16 14"/>
    <text x="250" y="630" fill="#fecaca" font-family="sans-serif" font-size="38" font-weight="900">ARM MISSING</text>
  `)
}
