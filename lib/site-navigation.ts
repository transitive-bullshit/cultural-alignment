export type SiteNavigationLink = {
  readonly description: string
  readonly footerLabel?: string
  readonly href: string
  readonly label: string
}

export const exploreNavigationLinks = [
  {
    href: '/scenarios',
    label: 'Scenarios',
    footerLabel: 'Browse and filter',
    description: 'Browse cultural analogies for real AI risks.'
  },
  {
    href: '/risk-families',
    label: 'AI risk families',
    description: 'See the major families of AI risk.'
  },
  {
    href: '/concepts',
    label: 'AI safety concepts',
    description: 'Explore the ideas behind safer AI systems.'
  },
  {
    href: '/sources',
    label: 'Media sources',
    description: 'Find the stories behind each scenario.'
  }
] as const satisfies readonly SiteNavigationLink[]

export const projectNavigationLinks = [
  {
    href: '/about',
    label: 'About',
    description: 'How the archive is built and organized.'
  },
  {
    href: '/privacy',
    label: 'Privacy',
    description: 'How this project handles visitor data.'
  }
] as const satisfies readonly SiteNavigationLink[]
