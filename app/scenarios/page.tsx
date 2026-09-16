import type { Metadata } from 'next'

import { ScenarioArchivePage } from './scenario-archive-page'

export const metadata: Metadata = {
  title: 'All scenarios',
  description: 'Browse every cultural analogy by risk family.',
  alternates: { canonical: '/scenarios' }
}

export default function ScenariosPage() {
  return <ScenarioArchivePage familySlug={null} />
}
