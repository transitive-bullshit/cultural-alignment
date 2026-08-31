import type { ReactNode } from 'react'

import { SiteHeader } from '@/components/site-header'

import styles from './information-page.module.css'

export function InformationPage({
  children,
  eyebrow,
  introduction,
  title,
  titleSize = 'default'
}: {
  readonly children: ReactNode
  readonly eyebrow: ReactNode
  readonly introduction: ReactNode
  readonly title: ReactNode
  readonly titleSize?: 'compact' | 'default'
}) {
  return (
    <main className={`experience-scope ${styles.page}`}>
      <SiteHeader className={styles.siteHeader} inset />

      <article className={styles.article}>
        <header className={styles.introduction}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 data-size={titleSize}>{title}</h1>
          <div className={styles.introductionCopy}>{introduction}</div>
        </header>

        <div className={styles.sections}>{children}</div>
      </article>
    </main>
  )
}

export function InformationSection({
  children,
  index,
  title
}: {
  readonly children: ReactNode
  readonly index: string
  readonly title: string
}) {
  return (
    <section className={styles.section}>
      <p className={styles.sectionIndex}>{index}</p>
      <h2>{title}</h2>
      <div className={styles.sectionCopy}>{children}</div>
    </section>
  )
}

export function InformationLinks({
  children,
  label
}: {
  readonly children: ReactNode
  readonly label: string
}) {
  return (
    <nav className={styles.links} aria-label={label}>
      {children}
    </nav>
  )
}
