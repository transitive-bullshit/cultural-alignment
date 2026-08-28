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
      eyebrow='Last updated 28 August 2026'
      title='A small site with a small data footprint.'
      introduction={
        <p>
          Cultural Alignment has no accounts, comments, advertising, or
          first-party tracking. This page explains the limited information that
          may still be handled when you visit.
        </p>
      }
    >
      <InformationSection index='01' title='What the site handles'>
        <p>
          The site does not ask you to provide personal information and does not
          currently include its own analytics or advertising scripts. Like most
          websites, the hosting and network providers may process routine
          request data such as an IP address, browser details, requested URL,
          and timestamps for delivery, reliability, and security.
        </p>
        <p>
          Searches from the command palette run against a local index in your
          browser. Searches submitted on the full search page appear in the page
          URL and may therefore be present in ordinary server logs or browser
          history.
        </p>
      </InformationSection>

      <InformationSection index='02' title='Local preferences'>
        <p>
          The spoiler-warning dismissal is stored in your browser&rsquo;s local
          storage so the site can remember that choice. It is not used to
          identify you, and you can remove it by clearing this site&rsquo;s
          browser data.
        </p>
      </InformationSection>

      <InformationSection index='03' title='Video and external services'>
        <p>
          Scenario pages can include YouTube clips. The YouTube player and its
          API are loaded only after you choose to play a clip; from that point,
          YouTube may receive information under its own privacy policy. Links to
          Notion, GitHub, X, and other references also take you to services with
          their own data practices.
        </p>
      </InformationSection>

      <InformationSection index='04' title='Questions and changes'>
        <p>
          This policy will be updated if the site adds accounts, analytics,
          submissions, or another feature that materially changes its data use.
          For privacy questions, email{' '}
          <a href='mailto:travis@transitivebullsh.it'>
            travis@transitivebullsh.it
          </a>
          .
        </p>
      </InformationSection>
    </InformationPage>
  )
}
