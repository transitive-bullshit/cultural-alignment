import type { Metadata } from 'next'

import {
  InformationPage,
  InformationSection
} from '@/features/content-navigation/information-page'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Cultural Alignment handles data and third-party media.',
  alternates: { canonical: '/privacy' }
}

export default function PrivacyPage() {
  return (
    <InformationPage
      context='Privacy / policy'
      eyebrow='Last updated 29 August 2026'
      title='What this site stores—and what it does not.'
      introduction={
        <p>
          Cultural Alignment has no accounts, comments, advertising, or
          first-party tracking. The remaining data flows are routine web
          requests, searches, local preferences, and media you choose to load.
        </p>
      }
    >
      <InformationSection index='01' title='Requests and search'>
        <p>
          The site does not ask for personal information or run its own
          analytics. Hosting and network providers may process routine request
          data—such as an IP address, browser details, requested URL, and
          timestamps—to deliver and secure the site.
        </p>
        <p>
          Command-palette searches stay in your browser. Searches on the full
          search page appear in the page URL, so they may also appear in browser
          history and routine server logs.
        </p>
      </InformationSection>

      <InformationSection index='02' title='Preferences on this device'>
        <p>
          This site stores two choices in your browser&rsquo;s local storage:
          whether you dismissed the spoiler warning, and your preferred scenario
          sort order. They are not used to identify you. Clear this site&rsquo;s
          browser data to remove them.
        </p>
      </InformationSection>

      <InformationSection index='03' title='YouTube and outbound links'>
        <p>
          Scenario pages can include YouTube clips. The player and YouTube API
          load only after you choose to play one. From that point, YouTube may
          receive information under its own privacy policy. Following a link to
          Notion, GitHub, X, or another referenced site takes you to that
          service, where its privacy policy applies.
        </p>
      </InformationSection>

      <InformationSection index='04' title='Updates and contact'>
        <p>
          If accounts, analytics, submissions, or another feature materially
          changes the site&rsquo;s data use, this policy and its date will be
          updated. For privacy questions, email{' '}
          <a href='mailto:travis@transitivebullsh.it'>
            travis@transitivebullsh.it
          </a>
          .
        </p>
      </InformationSection>
    </InformationPage>
  )
}
