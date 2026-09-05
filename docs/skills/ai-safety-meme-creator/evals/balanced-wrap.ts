interface TextBalanceCandidate {
  readonly lines: readonly string[]
  readonly finalOrphan: number
  readonly singletonLines: number
  readonly lengthVariance: number
}

export function balanceWrappedTextLines(
  initialLines: readonly string[]
): readonly string[] {
  return rankBalancedTextLines(initialLines, 1)[0] ?? initialLines
}

export function rankBalancedTextLines(
  initialLines: readonly string[],
  maximumCandidates = 12
): readonly (readonly string[])[] {
  if (initialLines.length < 2) return [initialLines]
  const candidateLimit = Math.max(1, Math.floor(maximumCandidates))
  const words = initialLines.flatMap((text) => text.match(/\S+/gu) ?? [])
  const maximumCharacters = Math.max(
    ...initialLines.map((text) => Array.from(text).length)
  )
  const totalCharacters =
    words.reduce((sum, word) => sum + Array.from(word).length, 0) +
    words.length -
    initialLines.length
  const targetCharacters = totalCharacters / initialLines.length
  const memo = new Map<string, readonly TextBalanceCandidate[]>()

  const solve = (
    wordIndex: number,
    remainingLines: number
  ): readonly TextBalanceCandidate[] => {
    const key = `${wordIndex}:${remainingLines}`
    const memoized = memo.get(key)
    if (memoized) return memoized
    if (remainingLines === 0) {
      const result =
        wordIndex === words.length
          ? [
              {
                lines: [],
                finalOrphan: 0,
                singletonLines: 0,
                lengthVariance: 0
              }
            ]
          : []
      memo.set(key, result)
      return result
    }

    const candidates: TextBalanceCandidate[] = []
    const latestEnd = words.length - remainingLines + 1
    for (let end = wordIndex + 1; end <= latestEnd; end += 1) {
      const lineWords = words.slice(wordIndex, end)
      const text = lineWords.join(' ')
      const characterCount = Array.from(text).length
      if (characterCount > maximumCharacters) break
      for (const suffix of solve(end, remainingLines - 1)) {
        candidates.push({
          lines: [text, ...suffix.lines],
          finalOrphan:
            remainingLines === 1 && lineWords.length === 1
              ? 1
              : suffix.finalOrphan,
          singletonLines:
            (lineWords.length === 1 ? 1 : 0) + suffix.singletonLines,
          lengthVariance:
            (characterCount - targetCharacters) ** 2 + suffix.lengthVariance
        })
      }
    }
    const ranked = rankCandidates(candidates, candidateLimit)
    memo.set(key, ranked)
    return ranked
  }

  const ranked = solve(0, initialLines.length).map(({ lines }) => lines)
  return ranked.length ? ranked : [initialLines]
}

function rankCandidates(
  candidates: readonly TextBalanceCandidate[],
  limit: number
): readonly TextBalanceCandidate[] {
  const unique = new Map<string, TextBalanceCandidate>()
  for (const candidate of candidates) {
    unique.set(candidate.lines.join('\u0000'), candidate)
  }
  return [...unique.values()]
    .sort(
      (left, right) =>
        compareTextBalance(left, right) ||
        left.lines.join('\u0000').localeCompare(right.lines.join('\u0000'))
    )
    .slice(0, limit)
}

function compareTextBalance(
  left: TextBalanceCandidate,
  right: TextBalanceCandidate
): number {
  return (
    left.finalOrphan - right.finalOrphan ||
    left.singletonLines - right.singletonLines ||
    left.lengthVariance - right.lengthVariance
  )
}
