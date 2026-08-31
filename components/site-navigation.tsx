'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavigationMenu as NavigationMenuPrimitive } from '@base-ui/react/navigation-menu'
import { ChevronDownIcon, MenuIcon, XIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet'
import {
  exploreNavigationLinks,
  projectNavigationLinks,
  type SiteNavigationLink
} from '@/lib/site-navigation'

import styles from './site-header.module.css'

export function DesktopSiteNavigation() {
  const pathname = usePathname()
  const projectIsActive = projectNavigationLinks.some((link) =>
    isNavigationLinkActive(pathname, link.href)
  )

  return (
    <NavigationMenuPrimitive.Root
      className={styles.desktopNavigation}
      aria-label='Primary navigation'
      data-site-navigation='desktop'
    >
      <NavigationMenuPrimitive.List className={styles.navigationList}>
        {exploreNavigationLinks.map((link) => (
          <NavigationMenuPrimitive.Item
            className={styles.navigationItem}
            key={link.href}
          >
            <NavigationMenuPrimitive.Link
              active={isNavigationLinkActive(pathname, link.href)}
              className={styles.navigationLink}
              data-site-navigation-link={link.href}
              render={<Link href={link.href} />}
            >
              {link.label}
            </NavigationMenuPrimitive.Link>
          </NavigationMenuPrimitive.Item>
        ))}

        <NavigationMenuPrimitive.Item className={styles.navigationItem}>
          <NavigationMenuPrimitive.Trigger
            className={styles.projectTrigger}
            data-current={projectIsActive ? '' : undefined}
            data-site-navigation-trigger='project'
          >
            Project
            <NavigationMenuPrimitive.Icon className={styles.projectTriggerIcon}>
              <ChevronDownIcon aria-hidden='true' />
            </NavigationMenuPrimitive.Icon>
          </NavigationMenuPrimitive.Trigger>
          <NavigationMenuPrimitive.Content
            className={styles.projectContent}
            data-site-navigation-panel='project'
          >
            <ul className={styles.projectLinks}>
              {projectNavigationLinks.map((link) => (
                <li key={link.href}>
                  <NavigationMenuPrimitive.Link
                    active={isNavigationLinkActive(pathname, link.href)}
                    className={styles.projectLink}
                    closeOnClick
                    data-site-navigation-link={link.href}
                    render={<Link href={link.href} />}
                  >
                    <strong>{link.label}</strong>
                    <span>{link.description}</span>
                  </NavigationMenuPrimitive.Link>
                </li>
              ))}
            </ul>
          </NavigationMenuPrimitive.Content>
        </NavigationMenuPrimitive.Item>
      </NavigationMenuPrimitive.List>

      <NavigationMenuPrimitive.Portal>
        <NavigationMenuPrimitive.Positioner
          align='center'
          className={styles.navigationPositioner}
          side='bottom'
          sideOffset={9}
        >
          <NavigationMenuPrimitive.Popup
            aria-label='Project navigation'
            className={styles.navigationPopup}
            data-site-navigation-popup
          >
            <NavigationMenuPrimitive.Arrow
              className={styles.navigationArrow}
              data-site-navigation-arrow
            />
            <NavigationMenuPrimitive.Viewport
              className={styles.navigationViewport}
            />
          </NavigationMenuPrimitive.Popup>
        </NavigationMenuPrimitive.Positioner>
      </NavigationMenuPrimitive.Portal>
    </NavigationMenuPrimitive.Root>
  )
}

export function MobileSiteNavigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 901px)')

    function closeAtDesktop(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false)
    }

    desktopQuery.addEventListener('change', closeAtDesktop)
    return () => desktopQuery.removeEventListener('change', closeAtDesktop)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className={styles.mobileNavigationToggle}
          variant='ghost'
          size='sm'
          data-site-navigation-toggle
        >
          <MenuIcon data-icon='inline-start' />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent
        className='w-[min(88vw,24rem)] gap-0 p-0 sm:max-w-96'
        data-site-navigation-panel='mobile'
        showCloseButton={false}
        side='right'
      >
        <SheetHeader className={styles.mobileNavigationHeader}>
          <div
            className={styles.mobileNavigationHeadingRow}
            data-site-navigation-heading-row
          >
            <SheetTitle
              className={styles.mobileNavigationTitle}
              data-site-navigation-title
            >
              Site navigation
            </SheetTitle>
            <SheetClose asChild>
              <Button
                aria-label='Close site navigation'
                variant='ghost'
                size='icon-lg'
                data-site-navigation-close
              >
                <XIcon data-icon='inline-start' />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className={styles.mobileNavigationDescription}>
            Explore Cultural Alignment by scenario, risk, concept, or source.
          </SheetDescription>
        </SheetHeader>

        <nav
          className={styles.mobileNavigation}
          aria-label='Primary navigation'
          data-site-navigation='mobile'
        >
          <NavigationGroup
            label='Explore'
            links={exploreNavigationLinks}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
          <NavigationGroup
            label='Project'
            links={projectNavigationLinks}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </SheetContent>
    </Sheet>
  )
}

function NavigationGroup({
  label,
  links,
  onNavigate,
  pathname
}: {
  readonly label: string
  readonly links: readonly SiteNavigationLink[]
  readonly onNavigate: () => void
  readonly pathname: string
}) {
  return (
    <section
      className={styles.mobileNavigationGroup}
      data-site-navigation-group={label.toLowerCase()}
    >
      <h2>{label}</h2>
      <ol>
        {links.map((link, index) => (
          <li key={link.href}>
            <SheetClose asChild>
              <Link
                className={styles.mobileNavigationLink}
                href={link.href}
                aria-current={
                  isNavigationLinkActive(pathname, link.href)
                    ? 'page'
                    : undefined
                }
                data-site-navigation-link={link.href}
                onNavigate={onNavigate}
              >
                <span
                  aria-hidden='true'
                  className={styles.mobileNavigationIndex}
                  data-site-navigation-index
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  className={styles.mobileNavigationLinkCopy}
                  data-site-navigation-link-copy
                >
                  <strong>{link.label}</strong>
                  <small>{link.description}</small>
                </span>
              </Link>
            </SheetClose>
          </li>
        ))}
      </ol>
    </section>
  )
}

function isNavigationLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
