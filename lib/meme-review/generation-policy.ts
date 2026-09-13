import { z } from 'zod'

export const memeReviewGenerationActionSchema = z.enum([
  'finalized',
  'disabled-unchanged',
  'layout-only',
  'bounded-revision',
  'punctuation-only'
])
export const memeReviewMutableFieldSchema = z.enum([
  'caption_lines',
  'preview',
  'frame_guidance',
  'why_it_works',
  'critic',
  'assets'
])

export type MemeReviewGenerationAction = z.infer<
  typeof memeReviewGenerationActionSchema
>
export type MemeReviewMutableField = z.infer<
  typeof memeReviewMutableFieldSchema
>

const fieldsByAction = {
  finalized: [],
  'disabled-unchanged': [],
  'layout-only': ['preview', 'frame_guidance', 'critic', 'assets'],
  'bounded-revision': [
    'caption_lines',
    'preview',
    'frame_guidance',
    'why_it_works',
    'critic',
    'assets'
  ],
  'punctuation-only': ['caption_lines']
} satisfies Record<
  MemeReviewGenerationAction,
  readonly MemeReviewMutableField[]
>

export function allowedMemeReviewFields(
  action: MemeReviewGenerationAction
): readonly MemeReviewMutableField[] {
  return [...fieldsByAction[action]]
}

export function isMutableMemeReviewAction(action: MemeReviewGenerationAction) {
  return fieldsByAction[action].length > 0
}
