const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+(?=["“‘(]?[A-Z0-9])/u

/** Shortest leading sentences that carry the mapping, for collection cards. */
export function summarizeAnalogy(text: string, minLength = 80): string {
  const sentences = text.trim().split(SENTENCE_BOUNDARY)
  let summary = sentences[0] ?? ''

  for (const sentence of sentences.slice(1)) {
    if (summary.length >= minLength) break
    summary = `${summary} ${sentence}`
  }

  return summary
}
