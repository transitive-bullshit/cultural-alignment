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
  siteDescriptionLong,
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
      title={siteDescriptionLong}
      titleSize='compact'
      introduction={
        <p>
          Cultural Alignment uses familiar scenes from film and television to
          make abstract AI risks easier to picture, discuss, and remember.
        </p>
      }
    >
      <InformationSection index='01' title='Why this exists'>
        <p>
          AI systems are becoming more capable, and understanding what can go
          wrong matters. Yet popular culture often reduces AI risk to Skynet or
          Ultron: an evil machine with an extinction plot. Real concerns are
          broader and messier. A system can optimize for the wrong goal, people
          can misuse it, and competitive pressure can push safety aside.
        </p>
        <p>
          I built this as an experiment to explore whether shared cultural
          references can make those concerns easier to understand and bring more
          people into the conversation.
        </p>
        <p>
          Note that these examples are analogies, not predictions or proof;
          where they break down matters as much as where they fit, but I hope
          they still prove useful regardless.
        </p>
        <p>
          Oh and it also exists for a simpler reason: curating these scenarios
          has been a lot of fun! 😄
        </p>
      </InformationSection>

      <InformationSection index='02' title='How to read a scenario'>
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

      <InformationSection index='03' title='How the archive is organized'>
        <p>
          Every scenario links to its source, AI risk families, and safety
          concepts. Start with any film, series, risk, or concept, then follow
          those links to related entries. Search covers the same index.
        </p>
        <InformationLinks label='Ways to explore the archive'>
          <Link href='/scenarios'>Browse scenarios</Link>
          <Link href='/risk-families'>Explore AI risk families</Link>
          <Link href='/concepts'>Explore AI safety concepts</Link>
        </InformationLinks>
      </InformationSection>

      <InformationSection index='04' title='Code, data, and rights'>
        <p>
          The site&rsquo;s code is{' '}
          <a
            href='https://choosealicense.com/licenses/mit/'
            target='_blank'
            rel='noreferrer'
          >
            MIT-licensed
          </a>
          . The underlying data uses Notion as a CMS which is released under{' '}
          <a
            href='https://choosealicense.com/licenses/cc0-1.0/'
            target='_blank'
            rel='noreferrer'
          >
            CC0 1.0
          </a>
          . Those licenses do not cover third-party film or television imagery,
          clips, titles, or trademarks.
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

      <InformationSection index='05' title='Contributing'>
        <p>
          Cultural Alignment is an independent project made by{' '}
          <a href={xProfileUrl} target='_blank' rel='noreferrer'>
            Travis Fischer
          </a>
          . Its taxonomy and interpretations are editorial judgments and may
          change as entries are reviewed or added.
        </p>
        <p>
          Corrections and contributions are welcome through the{' '}
          <a href={repositoryUrl} target='_blank' rel='noreferrer'>
            GitHub repository
          </a>
        </p>
      </InformationSection>
    </InformationPage>
  )
}
