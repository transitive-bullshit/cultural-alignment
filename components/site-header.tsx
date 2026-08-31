import {
  DesktopSiteNavigation,
  MobileSiteNavigation
} from '@/components/site-navigation'
import { SiteWordmark } from '@/components/site-wordmark'
import { GlobalSearch } from '@/features/search/global-search'
import { cn } from '@/lib/utils'

import styles from './site-header.module.css'

export type SiteHeaderProps = {
  readonly className?: string
  readonly inset?: boolean
}

export function SiteHeader({ className, inset = false }: SiteHeaderProps) {
  return (
    <header
      className={cn(styles.header, className)}
      data-inset={inset || undefined}
      data-site-header
    >
      <SiteWordmark className={styles.wordmark} />

      <div className={styles.center}>
        <DesktopSiteNavigation />
      </div>

      <div className={styles.actions} data-site-header-actions>
        <GlobalSearch className={styles.searchTrigger} />
        <MobileSiteNavigation />
      </div>
    </header>
  )
}
