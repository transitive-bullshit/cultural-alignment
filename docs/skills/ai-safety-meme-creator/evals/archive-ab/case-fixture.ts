import type { MemeEvalTemplate, MemeSkillFixture } from '../schema'

import type { ArchiveComparisonCase } from './selection'

export function buildArchiveFixture(
  comparisonCase: ArchiveComparisonCase,
  stagedAssets: ReadonlyMap<string, string>
): MemeSkillFixture {
  const images = comparisonCase.source_assets.map((asset) => ({
    id: asset.id,
    path: required(stagedAssets.get(asset.content_hash), asset.content_hash),
    description: `${asset.alt}. Authentic source frame, ${asset.width} × ${asset.height}.`
  }))
  const sourceFrames = images.map(({ id }, index) => ({
    image_id: id,
    role:
      images.length === 1
        ? ('single' as const)
        : index === 0
          ? ('before' as const)
          : ('after' as const)
  }))
  const protectedRegions = comparisonCase.source_assets.flatMap((asset) =>
    asset.protected_regions.map((region) => {
      const [x, y, width, height] = region.source_rect
      return {
        id: region.id,
        image_id: asset.id,
        label: region.label,
        canvas_rect_pct: [x, y, width, height] as [
          number,
          number,
          number,
          number
        ],
        priority: region.priority
      }
    })
  )
  const feedback =
    comparisonCase.human_feedback ??
    (comparisonCase.cohort === 'finalized'
      ? 'Human verdict: locked and finalized; no written note was recorded.'
      : 'Human rating: dislike. No ingredient was preserved; replace the direction.')
  const requestedReplacement = extractRequestedReplacement(feedback)
  const requiresOrangeWhite =
    /orange\s+background[\s\S]*white\s+text|orange[\s\S]*white\s+text[\s\S]*background/i.test(
      feedback
    )
  const requestsSplitSetupPayoff =
    /setup[\s\S]*top[\s\S]*payoff[\s\S]*bottom/i.test(feedback) ||
    (comparisonCase.cohort === 'finalized' &&
      (comparisonCase.idea.preview.layout === 'top-bottom' ||
        hasApprovedTopBottomZones(
          comparisonCase.idea.preview.zones,
          comparisonCase.idea.caption_lines.length
        )))
  const approvedTemplate = archiveTemplate(comparisonCase.idea.preview.template)
  const locksArchivedTemplate =
    comparisonCase.cohort === 'finalized' &&
    explicitlyLocksArchivedLayout(comparisonCase.human_feedback)
  const retainsFirstLine = /first line is (?:perfect|strong)/i.test(feedback)
  const retainedFirstLineLocksTerminalPeriod =
    retainsFirstLine && comparisonCase.idea.caption_lines[0]?.endsWith('.')
  const lockedLayoutDirection = [
    locksArchivedTemplate && approvedTemplate
      ? `Locked template: ${approvedTemplate}`
      : null,
    `Locked source frames in reading order: ${sourceFrames.map(({ image_id, role }) => `${image_id} (${role})`).join(', ')}`,
    requestsSplitSetupPayoff
      ? `Locked semantic placement: caption line 0 uses a top slot and caption line ${comparisonCase.idea.caption_lines.length - 1} uses a bottom slot in a separate zone.`
      : null
  ]
    .filter(Boolean)
    .join('\n')

  return {
    id: comparisonCase.case_id,
    purpose:
      comparisonCase.cohort === 'finalized'
        ? 'Recompose human-approved locked copy without weakening its scene hinge or visual evidence.'
        : 'Replace a human-rejected meme direction while following any specifically retained ingredient in the feedback.',
    tags: [
      'archive-ab',
      comparisonCase.cohort,
      comparisonCase.idea.format,
      comparisonCase.human_feedback
        ? 'explicit-feedback'
        : comparisonCase.cohort === 'finalized'
          ? 'locked-without-note'
          : 'terminal-dislike'
    ],
    request: {
      source_title: comparisonCase.source_title,
      scene:
        comparisonCase.cohort === 'finalized'
          ? [
              comparisonCase.scenario.scene,
              `Approved scene hinge: ${comparisonCase.idea.source_anchor}`,
              `Approved frame guidance: ${comparisonCase.idea.frame_guidance}`
            ].join('\n\n')
          : comparisonCase.scenario.scene,
      ai_concepts: [comparisonCase.idea.ai_concept],
      caveats: [...comparisonCase.scenario.caveats],
      user_direction:
        comparisonCase.cohort === 'finalized'
          ? `This direction was human-finalized. Preserve these caption lines byte for byte and in order, including their capitalization and punctuation:\n${comparisonCase.idea.caption_lines.map((line) => `- ${line}`).join('\n')}\nRecompose the locked copy over the supplied authentic frame or frames. Preserve the scene hinge and these layout locks:\n${lockedLayoutDirection}${comparisonCase.human_feedback ? `\nHuman feedback to honor: ${comparisonCase.human_feedback}` : ''}`
          : 'This prior direction was human-disliked. Apply the attached rejection feedback. Preserve only an ingredient the note explicitly keeps; otherwise discard the old hinge, comic ingredient, and format and make a materially different direction.',
      rejected_direction:
        comparisonCase.cohort === 'disliked'
          ? {
              caption_lines: [...comparisonCase.idea.caption_lines],
              format: comparisonCase.idea.format as NonNullable<
                MemeSkillFixture['request']['rejected_direction']
              >['format'],
              feedback
            }
          : null
    },
    images,
    protected_regions: protectedRegions,
    expectations: {
      ai_concept: comparisonCase.idea.ai_concept,
      minimum_caption_lines: 1,
      maximum_caption_lines:
        comparisonCase.cohort === 'finalized'
          ? Math.max(1, comparisonCase.idea.caption_lines.length)
          : 3,
      maximum_caption_words:
        comparisonCase.cohort === 'finalized'
          ? Math.max(
              24,
              comparisonCase.idea.caption_lines.join(' ').trim().split(/\s+/u)
                .length
            )
          : 24,
      maximum_zones: comparisonCase.cohort === 'finalized' ? 6 : 3,
      omit_cosmetic_terminal_periods:
        comparisonCase.cohort === 'disliked' &&
        !retainedFirstLineLocksTerminalPeriod,
      required_caption_terms: requestedReplacement
        ? [[requestedReplacement.to]]
        : undefined,
      forbidden_caption_terms: requestedReplacement
        ? [requestedReplacement.from]
        : undefined,
      exact_caption_lines:
        comparisonCase.cohort === 'finalized'
          ? [...comparisonCase.idea.caption_lines]
          : undefined,
      exact_caption_lines_by_index: retainsFirstLine
        ? { 0: comparisonCase.idea.caption_lines[0]! }
        : undefined,
      require_rejected_caption_change:
        comparisonCase.cohort === 'disliked' || undefined,
      require_rejected_format_change:
        comparisonCase.cohort === 'disliked' &&
        !retainsFirstLine &&
        !requestedReplacement
          ? true
          : undefined,
      allowed_formats: [
        'canon',
        'relabel',
        'collision',
        'dialogue',
        'state contrast',
        'source-native interface'
      ],
      allowed_templates:
        locksArchivedTemplate && approvedTemplate
          ? [approvedTemplate]
          : images.length === 2
            ? ['diptych']
            : [
                'overlay',
                'dialogue',
                'interface',
                'band-top',
                'band-bottom',
                'sidecar-left',
                'sidecar-right'
              ],
      allowed_frame_modes: ['cover', 'contain', 'extend'],
      expected_source_frames: sourceFrames,
      maximum_zone_overlap_ratio: 0,
      maximum_protected_overlap_ratio: 0,
      required_line_slots: requestsSplitSetupPayoff
        ? {
            0: ['top', 'top-left', 'top-right'],
            [comparisonCase.idea.caption_lines.length - 1]: [
              'bottom',
              'bottom-left',
              'bottom-right'
            ]
          }
        : undefined,
      separate_line_zones: requestsSplitSetupPayoff || undefined,
      required_region_ids: protectedRegions
        .filter(({ priority }) => priority === 'must')
        .map(({ id }) => id),
      minimum_font_size_pct: 3.75,
      maximum_rendered_lines_per_zone:
        comparisonCase.cohort === 'finalized' ? 5 : 4,
      required_palette: requiresOrangeWhite ? 'orange-white' : undefined,
      require_distinct_source_frames: images.length === 2
    },
    feedback_sources: [
      {
        path: comparisonCase.feedback_source,
        idea_id: comparisonCase.idea_id,
        rating: comparisonCase.human_rating,
        note_includes: feedback
      }
    ]
  }
}

function extractRequestedReplacement(
  feedback: string
): { readonly from: string; readonly to: string } | undefined {
  const match = feedback.match(
    /replace\s+["“]([^"”]+)["”]\s+with\s+["“]([^"”]+)["”]/i
  )
  return match?.[1] && match[2] ? { from: match[1], to: match[2] } : undefined
}

function archiveTemplate(
  value: string | undefined
): MemeEvalTemplate | undefined {
  const templates = new Set<MemeEvalTemplate>([
    'overlay',
    'dialogue',
    'diptych',
    'interface',
    'band-top',
    'band-bottom',
    'sidecar-left',
    'sidecar-right'
  ])
  return value && templates.has(value as MemeEvalTemplate)
    ? (value as MemeEvalTemplate)
    : undefined
}

function explicitlyLocksArchivedLayout(feedback: string | null): boolean {
  return Boolean(
    feedback &&
    /revert|previous version(?:'s)? layout|first version(?:'s)? layout/i.test(
      feedback
    )
  )
}

function hasApprovedTopBottomZones(
  zones: readonly unknown[] | undefined,
  captionLineCount: number
): boolean {
  if (!zones?.length || captionLineCount < 2) return false
  const parsed = zones.flatMap((zone) => {
    if (!zone || typeof zone !== 'object') return []
    const candidate = zone as { lines?: unknown; slot?: unknown }
    if (!Array.isArray(candidate.lines) || typeof candidate.slot !== 'string') {
      return []
    }
    return [{ lines: candidate.lines, slot: candidate.slot }]
  })
  return (
    parsed.some(
      ({ lines, slot }) => lines.includes(0) && slot.startsWith('top')
    ) &&
    parsed.some(
      ({ lines, slot }) =>
        lines.includes(captionLineCount - 1) && slot.startsWith('bottom')
    )
  )
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing staged source ${label}`)
  return value
}
