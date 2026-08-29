import type { Metadata } from 'next'
import Link from 'next/link'

import {
  InformationLinks,
  InformationPage,
  InformationSection
} from '@/features/content-navigation/information-page'
import {
  notionSourceUrl,
  repositoryUrl,
  siteSummary,
  siteTagline,
  xProfileUrl
} from '@/lib/site'

export const metadata: Metadata = {
  title: 'About',
  description: siteSummary,
  alternates: { canonical: '/about' }
}

export default function AboutPage() {
  return (
    <InformationPage
      context='About / project'
      eyebrow='Purpose and scope'
      title={siteTagline}
      introduction={
        <p>
          Cultural Alignment pairs scenes from film and television with AI risk
          families and safety concepts. Each entry explains the connection and
          its limits.
        </p>
      }
    >
      <InformationSection index='01' title='How to read a scenario'>
        <p>
          A scenario is an analogy: a way to make an abstract mechanism
          concrete. It is not evidence, a complete account of an AI safety
          problem, or a substitute for the cited research.
        </p>
        <p>
          Every dossier states both <strong>why the analogy works</strong> and{' '}
          <strong>where it breaks</strong>.
        </p>
      </InformationSection>

      <InformationSection index='02' title='How the archive is organized'>
        <p>
          Every scenario links to its source, AI risk families, and safety
          concepts. Start with any film, series, risk, or concept, then follow
          those links to related entries. Search covers the same index.
        </p>
        <InformationLinks label='Ways to explore the archive'>
          <Link href='/scenarios'>Browse scenarios</Link>
          <Link href='/risk-families'>Explore risk families</Link>
          <Link href='/concepts'>Browse concepts</Link>
        </InformationLinks>
      </InformationSection>

      <InformationSection index='03' title='Code, data, and rights'>
        <p>
          The site&rsquo;s code is MIT-licensed. Its authored structured
          snapshot and derived search index are released under CC0 1.0. Those
          licenses do not cover third-party film or television imagery, clips,
          titles, or trademarks.
        </p>
        <InformationLinks label='Project sources'>
          <a href={repositoryUrl} target='_blank' rel='noreferrer'>
            GitHub repository
          </a>
          <a href={notionSourceUrl} target='_blank' rel='noreferrer'>
            Public Notion database
          </a>
        </InformationLinks>
      </InformationSection>

      <InformationSection index='04' title='Editor and corrections'>
        <p>
          Cultural Alignment is an independent project created and edited by{' '}
          <a href={xProfileUrl} target='_blank' rel='noreferrer'>
            Travis Fischer
          </a>
          . Its taxonomy and interpretations are editorial judgments and may
          change as entries are reviewed or added.
        </p>
        <p>
          Corrections and contributions are welcome through the GitHub
          repository.
        </p>
      </InformationSection>
    </InformationPage>
  )
}
