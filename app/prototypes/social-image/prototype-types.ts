export type SocialImageScenario = Readonly<{
  slug: string
  title: string
  source: string
  image: Readonly<{
    src: string
    alt: string
    width: number
    height: number
  }>
}>

export type SocialImagePrototypeData = Readonly<{
  scenarios: readonly SocialImageScenario[]
}>

export type SocialImageVariantProps = Readonly<{
  data: SocialImagePrototypeData
}>
