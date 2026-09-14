// Knip evaluates the Playwright config but never starts its web server.
// Keep the Portless guard intact for actual browser journeys.
process.env.PORTLESS_URL ??= 'http://127.0.0.1:3000'
process.env.PORT ??= '3000'

export default {
  entry: [
    'docs/skills/ai-safety-meme-creator/evals/generate-fixture-images.ts',
    'docs/skills/ai-safety-meme-creator/scripts/compose-meme.ts'
  ],
  // Next.js resolves this environment-boundary marker internally.
  ignoreDependencies: ['server-only']
}
