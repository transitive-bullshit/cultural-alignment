# Icon and text alignment references

Research date: 2026-09-26. Reference notes, not an implementation plan or change to the design contract.

## Sources

- [Google Material Design: Metrics & keylines](https://m1.material.io/layout/metrics-keylines.html). Legacy first-party guidance explicitly distinguishes the outer margin from the inset for text associated with icons or avatars. Its annotated examples demonstrate intentional multiple alignment lines. Use the structural principle, not its historical dimensions as universal requirements.
- [Nielsen Norman Group: Good Visual Design, Explained](https://www.nngroup.com/articles/good-visual-design/). Explains grids with illustrated narrow- and wide-gutter examples. Gutter width depends on purpose; content can span columns and gutters.
- [Nielsen Norman Group: Proximity Principle in Visual Design](https://www.nngroup.com/articles/gestalt-proximity/). Explains how spacing communicates relationships, how excessive separation can obscure related elements, and how responsive changes can disrupt grouping.
- [GOV.UK: Brand hierarchy](https://brand.design-system.service.gov.uk/logo-system/brand-hierarchy/). Defines lockups as fixed arrangements of brand elements and text. Relevant to treating a symbol and wordmark as one composition rather than requiring every internal text edge to align with page content.

## Application and tradeoffs

The following is design judgment derived from these sources, not a rule quoted from them.

- An icon column plus a text column supports repeated rows and a consistent reading edge, but consumes horizontal space. A gutter serving repeated content has more justification than one introduced for a single ornament.
- Hanging an icon in an existing margin preserves text width, but requires enough space to avoid a cramped edge or clipping.
- Placing an icon above text preserves the text edge and width, but adds height and gives the icon greater prominence.
- Moving an icon to the opposite edge preserves text alignment, but weakens its perceived connection to the text. This is more suitable for an independent decorative brand mark than an icon carrying essential heading meaning.
- Aligning the outer edge of a brand lockup preserves the brand composition while leaving its internal wordmark inset. Separate visual groups can have different internal alignment rules.

For the supplied social image, the masthead and main title are distinct groups. The current symbol-plus-wordmark alignment is defensible. Moving the symbol to the right would be a stylistic alternative that changes grouping, not an objectively required correction. For a heading and its own paragraph, a shared text edge deserves greater priority.
