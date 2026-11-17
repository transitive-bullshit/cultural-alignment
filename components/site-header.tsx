import {
  DesktopSiteNavigation,
  MobileSiteNavigation
} from '@/components/site-navigation'
import { SiteWordmark } from '@/components/site-wordmark'
import { GlobalSearch } from '@/features/search/global-search'

import styles from './site-header.module.css'

export function SiteHeader({
  fixedOnMobile = false
}: { readonly fixedOnMobile?: boolean } = {}) {
  return (
    <header
      className={styles.header}
      data-fixed-on-mobile={fixedOnMobile || undefined}
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
