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
  { href: '/', label: 'Featured scenarios' },
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
              <a href={notionSourceUrl} target='_blank' rel='noreferrer'>
                Source notion database <span aria-hidden='true'>↗</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <nav className={styles.socials} aria-label='Social links'>
        <a href={repositoryUrl} target='_blank' rel='noreferrer'>
          <GithubIcon />
          <span>GitHub</span>
          <span aria-hidden='true'>↗</span>
        </a>
        <a href={xProfileUrl} target='_blank' rel='noreferrer'>
          <XIcon />
          <span>@transitive_bs</span>
          <span aria-hidden='true'>↗</span>
        </a>
      </nav>

      <div className={styles.baseline}>
        <p>
          <a href={xProfileUrl} target='_blank' rel='noreferrer'>
            © {copyrightYear} Travis Fischer
          </a>
        </p>
        <p>
          {contentManifest.counts.scenarios} scenarios ·{' '}
          {contentManifest.counts.sources} sources ·{' '}
          <a href={notionSourceUrl} target='_blank' rel='noreferrer'>
            CC0 data
          </a>
        </p>
      </div>
    </footer>
  )
}

function GithubIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
      <path
        fill='currentColor'
        d='M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.77 2.72 1.26 3.38.96.1-.75.4-1.26.74-1.55-2.57-.3-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.16 1.18a10.9 10.9 0 0 1 5.76 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.25c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z'
      />
    </svg>
  )
}

function XIcon() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
      <path
        fill='currentColor'
        d='M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.72 6.24 5.44-6.24Zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64Z'
      />
    </svg>
  )
}
