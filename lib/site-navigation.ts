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
    footerLabel: 'All scenarios',
    description: 'Browse the full collection of cultural analogies.'
  },
  {
    href: '/risk-families',
    label: 'AI risk families',
    description: 'Explore the high-level categories of AI risk.'
  },
  {
    href: '/concepts',
    label: 'AI safety concepts',
    description: 'Explore the ideas behind safer AI systems.'
  },
  {
    href: '/sources',
    label: 'Media sources',
    description: 'Explore the movies and shows behind the scenarios.'
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
