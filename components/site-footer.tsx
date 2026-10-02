import Link from 'next/link'

import { IntentPrefetchLink } from '@/components/intent-prefetch-link'
import { SiteWordmark } from '@/components/site-wordmark'
import contentManifest from '@/content/snapshot/manifest.json'
import {
  notionSourceUrl,
  repositoryUrl,
  siteTagline,
  xProfileUrl
} from '@/lib/site'
import {
  exploreNavigationLinks,
  projectNavigationLinks
} from '@/lib/site-navigation'

import styles from './site-footer.module.css'

const primaryLinks = [
  { href: '/', label: 'Home' },
  ...exploreNavigationLinks.map((link) => ({
    href: link.href,
    label: 'footerLabel' in link ? link.footerLabel : link.label
  }))
]

const copyrightYear = new Date().getUTCFullYear()

export function SiteFooter() {
  return (
    <footer className={styles.footer} data-site-footer-root>
      <div className={styles.lead}>
        <SiteWordmark className={styles.wordmark} />
        <p>{siteTagline}</p>
      </div>

      <div className={styles.navigation}>
        <nav aria-label='Explore Cultural Alignment'>
          <p>Explore</p>
          <ul>
            {primaryLinks.map((link) => (
              <li key={link.href}>
                {link.href === '/scenarios' ? (
                  <IntentPrefetchLink href={link.href}>
                    {link.label}
                  </IntentPrefetchLink>
                ) : (
                  <Link href={link.href}>{link.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label='Project information'>
          <p>Project</p>
          <ul>
            {projectNavigationLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
            <li>
              {/* The no-break space keeps the ↗ on the label's last line. */}
              <a href={notionSourceUrl} target='_blank' rel='noreferrer'>
                <span className='external-link'>Source notion database</span>
                {'\u00a0'}
                <span className={styles.linkMark} aria-hidden='true'>
                  ↗
                </span>
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <nav className={styles.socials} aria-label='Social links'>
        <a href={repositoryUrl} target='_blank' rel='noreferrer'>
          <span className='external-link'>GitHub</span>
          <span aria-hidden='true'>↗</span>
        </a>
        <a href={xProfileUrl} target='_blank' rel='noreferrer'>
          <span className='external-link'>@transitive_bs</span>
          <span aria-hidden='true'>↗</span>
        </a>
      </nav>

      <div className={styles.baseline}>
        <p>
          <a
            className='external-link'
            href={xProfileUrl}
            target='_blank'
            rel='noreferrer'
          >
            © {copyrightYear} Travis Fischer
          </a>
        </p>
        <p>
          <IntentPrefetchLink href='/scenarios'>
            {contentManifest.counts.scenarios} scenarios
          </IntentPrefetchLink>{' '}
          ·{' '}
          <IntentPrefetchLink href='/sources'>
            {contentManifest.counts.sources} sources
          </IntentPrefetchLink>{' '}
          ·{' '}
          <a
            className='external-link'
            href={notionSourceUrl}
            target='_blank'
            rel='noreferrer'
          >
            CC0 data
          </a>
        </p>
      </div>
    </footer>
  )
}
