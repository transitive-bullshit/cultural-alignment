import type { Metadata } from 'next'
import Link from 'next/link'

import {
  InformationLinks,
  InformationPage,
  InformationSection
} from '@/features/content-navigation/information-page'
import { notionSourceUrl, repositoryUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'About',
  description:
    'About Cultural Alignment, an open-source archive of pop-culture analogies for AI safety and alignment.',
  alternates: { canonical: '/about' }
}

export default function AboutPage() {
  return (
    <InformationPage
      context='About / project'
      eyebrow='Why this archive exists'
      title='Start with a story you already know.'
      introduction={
        <p>
          Cultural Alignment uses scenes from film and television as on-ramps to
          the less familiar language of AI safety. Recognition comes first; the
          technical idea follows.
        </p>
      }
    >
      <InformationSection index='01' title='A bridge, not a textbook'>
        <p>
          Each scenario connects a memorable cultural moment to one or more AI
          risk families and safety concepts. The analogy is there to make an
          abstract mechanism easier to see—not to replace the underlying
          research or collapse a complicated debate into a movie plot.
        </p>
        <p>
          That is why every dossier includes both{' '}
          <strong>why the analogy works</strong> and{' '}
          <strong>where it breaks</strong>.
        </p>
      </InformationSection>

      <InformationSection index='02' title='Curated, relational, explorable'>
        <p>
          The collection is organized as a network. You can begin with a story,
          follow it to a risk family, compare related concepts, or search across
          the whole archive. There is no required reading order.
        </p>
        <InformationLinks label='Ways to explore the archive'>
          <Link href='/scenarios'>Browse scenarios</Link>
          <Link href='/risk-families'>Explore risk families</Link>
          <Link href='/concepts'>Browse concepts</Link>
        </InformationLinks>
      </InformationSection>

      <InformationSection index='03' title='Open source, open data'>
        <p>
          The site is open source. Its structured scenario snapshot is released
          under CC0 so others can study it, remix it, and build on it.
          Third-party imagery, clips, titles, and trademarks remain the property
          of their respective owners.
        </p>
        <InformationLinks label='Project sources'>
          <a href={repositoryUrl} target='_blank' rel='noreferrer'>
            View the code on GitHub
          </a>
          <a href={notionSourceUrl} target='_blank' rel='noreferrer'>
            Open the public Notion database
          </a>
        </InformationLinks>
      </InformationSection>

      <InformationSection index='04' title='Made by Travis Fischer'>
        <p>
          Cultural Alignment is an independent project by Travis Fischer. It is
          an evolving editorial archive, so the taxonomy and individual
          interpretations will continue to sharpen as the collection grows.
        </p>
        <p>
          Corrections and thoughtful contributions are welcome through the
          project repository.
        </p>
      </InformationSection>
    </InformationPage>
  )
}
