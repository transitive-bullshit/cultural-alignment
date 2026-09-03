import { ZodError } from 'zod'

import { memeIdeaIds } from '@/lib/meme-review/catalog'
import { memeFeedbackBatchPatchSchema } from '@/lib/meme-review/schema'
import { patchMemeFeedback } from '@/lib/meme-review/store'

export const runtime = 'nodejs'

export async function PATCH(request: Request) {
  try {
    const patch = memeFeedbackBatchPatchSchema.parse(await request.json())
    const unknownIdea = patch.updates.find(
      ({ ideaId }) => !memeIdeaIds.has(ideaId)
    )

    if (unknownIdea) {
      return Response.json(
        { error: `Unknown meme idea: ${unknownIdea.ideaId}` },
        { status: 400, headers: noStoreHeaders }
      )
    }

    const document = await patchMemeFeedback(patch.updates)

    return Response.json(
      {
        ideaIds: patch.updates.map(({ ideaId }) => ideaId),
        updatedAt: document.updatedAt
      },
      { headers: noStoreHeaders }
    )
  } catch (err) {
    if (err instanceof ZodError || err instanceof SyntaxError) {
      return Response.json(
        { error: 'Invalid meme feedback payload' },
        { status: 400, headers: noStoreHeaders }
      )
    }

    console.error('Failed to save meme feedback', err)
    return Response.json(
      { error: 'Could not save meme feedback' },
      { status: 500, headers: noStoreHeaders }
    )
  }
}

const noStoreHeaders = {
  'Cache-Control': 'no-store'
}
