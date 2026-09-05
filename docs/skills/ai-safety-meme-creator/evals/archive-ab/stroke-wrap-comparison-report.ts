import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { writeStrokeWrapComparisonReport } from './impact-comparison-report'

export async function runStrokeWrapComparisonReportCli(
  args: readonly string[] = process.argv.slice(2)
): Promise<string> {
  if (args.length < 2 || args.length > 3) {
    throw new Error(
      'Usage: node --import tsx stroke-wrap-comparison-report.ts <immutable-v4-manifest.json> <v5-manifest.json> [output.html]'
    )
  }
  const [v4ManifestPath, v5ManifestPath, outputPath] = args
  return writeStrokeWrapComparisonReport({
    v4ManifestPath: resolve(v4ManifestPath!),
    v5ManifestPath: resolve(v5ManifestPath!),
    outputPath: outputPath ? resolve(outputPath) : undefined
  })
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  console.log(await runStrokeWrapComparisonReportCli())
}
