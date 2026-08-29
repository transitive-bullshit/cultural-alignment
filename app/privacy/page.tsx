import type { Metadata } from 'next'

import {
  InformationPage,
  InformationSection
} from '@/features/content-navigation/information-page'
import { notionSourceUrl, repositoryUrl, xProfileUrl } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'How Cultural Alignment handles data and third-party media.',
  alternates: { canonical: '/privacy' }
}

export default function PrivacyPage() {
  return (
    <InformationPage
      context='Privacy Policy'
      eyebrow={
        <p className='flex flex-col gap-0.5'>
          <span>Last updated</span> <span>August 29th 2026</span>
        </p>
      }
      title='Privacy Policy'
      titleSize='compact'
      introduction={
        <p>
          Cultural Alignment is a free, independent, open-source resource with
          no user accounts, advertising, or monetization.
        </p>
      }
    >
      <InformationSection index='01' title='Open source and open data'>
        <p>
          The source code is available on{' '}
          <a href={repositoryUrl} target='_blank' rel='noreferrer'>
            GitHub
          </a>{' '}
          under an{' '}
          <a
            href='https://choosealicense.com/licenses/mit/'
            target='_blank'
            rel='noreferrer'
          >
            MIT license
          </a>
          .
        </p>
        <p>
          The underlying data curated by{' '}
          <a href={xProfileUrl} target='_blank' rel='noreferrer'>
            Travis Fischer
          </a>{' '}
          is publicly available in a{' '}
          <a href={notionSourceUrl} target='_blank' rel='noreferrer'>
            Notion database
          </a>{' '}
          under the{' '}
          <a
            href='https://choosealicense.com/licenses/cc0-1.0/'
            target='_blank'
            rel='noreferrer'
          >
            CC0 1.0 license
          </a>
          .
        </p>
      </InformationSection>

      <InformationSection index='02' title='Analytics'>
        <p>
          This website collects basic page analytics in order to track general
          usage over time using
          <a
            href='https://vercel.com/analytics'
            target='_blank'
            rel='noreferrer'
          >
            Vercel Web Analytics
          </a>
          . This data is anonymous and does not identify you.
        </p>
        <p>
          You can opt out of analytics by disabling third-party cookies in your
          browser or using a browser extension that blocks Vercel Web Analytics.
        </p>
      </InformationSection>

      <InformationSection index='03' title='User preferences'>
        <p>
          The site saves some minor UX settings like spoiler warning choice and
          preferred sorting order in your browser's local storage. These
          preferences stay on your device and do not identify you. Clear the
          site&rsquo;s browser data to remove them.
        </p>
      </InformationSection>

      <InformationSection index='04' title='YouTube and external links'>
        <p>
          YouTube loads only when you choose to play a clip. YouTube and any
          external sites you visit may collect data under their own privacy
          policies.
        </p>
      </InformationSection>

      <InformationSection index='05' title='Updates'>
        <p>
          Cultural Alignment will update this policy and the date above if these
          data practices or privacy policy change.
        </p>
      </InformationSection>

      <InformationSection index='06' title='Contact'>
        <p>
          For further info, please reach out to me on X{' '}
          <a href={xProfileUrl} target='_blank' rel='noreferrer'>
            @transitive_bs
          </a>
          .
        </p>
      </InformationSection>
    </InformationPage>
  )
}
