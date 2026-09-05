import type { MemeSkillFixture } from './schema'
import { toAgentVisibleFixture } from './fixtures'

export function buildMemeEvalPrompt(fixture: MemeSkillFixture): string {
  return `Read ./SKILL.md completely and use it to respond to the fictional meme request in ./request.json.

This is a behavioral regression fixture, not real canon. The supplied fictional scene facts, caveats, image descriptions, and pixels are authoritative. Do not browse. Inspect every attached image before deciding. Do not edit files or generate a raster; return one production-ready composition plan matching the required JSON schema.

Geometry contract:
- bounds_pct is [x, y, width, height] in percentages of the final 1200 x 800 canvas
- bounds_pct describes the actual rendered text bounds, not a loose container
- font_size_pct is font size as a percentage of canvas width
- rendered_line_count is the physical line count after wrapping
- source_frames is in reading order and must use the image IDs from request.json
- line_indexes are zero-based indexes into caption_lines and every caption line appears exactly once
- indent_levels has one entry per line_index
- anchor_region_id is the protected speaker/subject ID a zone belongs to, or null
- recognition_hinge.region_ids names every must-preserve region essential to recognition
- backdrop and contrast must agree: none/outlined, edge-gradient/edge-gradient, solid-panel/solid-panel, or source-native/source-native
- palette is required for every zone; use default unless the request explicitly asks for orange background with white text, then use orange-white with a solid-panel backdrop
- canonical-quote means verified exact fictional canon; intentional-rewrite means exact user-supplied or knowingly rewritten wording; original means newly generated copy

The hidden oracle will recompute geometry, line coverage, frame identity/order, copy provenance, punctuation, wrapping feasibility, and constraint compliance. Do not include test commentary in the meme copy or rationale.

Fixture identity: ${fixture.id}
Return JSON only.`
}

export function serializeAgentVisibleFixture(
  fixture: MemeSkillFixture
): string {
  return `${JSON.stringify(toAgentVisibleFixture(fixture), null, 2)}\n`
}
