# Social-image fonts

`barlow-condensed-latin-800-normal.woff` is the Latin ExtraBold subset of Barlow Condensed v13, copied from `@fontsource/barlow-condensed` so Next.js can trace it into the scenario, source, and franchise social-image functions without depending on a runtime `node_modules` layout.

Copyright 2017 The Barlow Project Authors (<https://github.com/jpt/barlow>). Licensed under the SIL Open Font License, Version 1.1; see `OFL-1.1.txt`.

Dynamic social images use Takumi to render WebP at quality 80. Barlow Condensed is embedded from the local WOFF above; Geist uses Takumi’s bundled Latin font, including its regular and semibold weights. No font is read from Next.js internals or fetched at render time.
