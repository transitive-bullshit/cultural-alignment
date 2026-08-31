import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  exploreNavigationLinks,
  projectNavigationLinks
} from '../../lib/site-navigation'

const exploreHrefs = exploreNavigationLinks.map((link) => link.href).toSorted()
const projectHrefs = projectNavigationLinks.map((link) => link.href).toSorted()
const allHrefs = [...exploreHrefs, ...projectHrefs].toSorted()

test.describe('desktop site navigation', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('keeps the archive hierarchy visible and Project keyboard-accessible', async ({
    page
  }) => {
    await page.goto('/')

    const header = page.locator('[data-site-header]')
    const navigation = header.locator('[data-site-navigation="desktop"]')
    const actions = header.locator('[data-site-header-actions]')
    const projectTrigger = navigation.locator(
      '[data-site-navigation-trigger="project"]'
    )

    await expect(navigation).toBeVisible()
    await expectHrefSet(
      navigation.locator('[data-site-navigation-link]'),
      exploreHrefs
    )
    await expect(
      actions.locator('button[data-search-ready="true"]')
    ).toBeVisible()
    await expect(actions.locator('[data-site-navigation-toggle]')).toBeHidden()
    await expect(actions.locator('a')).toHaveCount(0)

    await projectTrigger.click()
    const projectPanel = page.locator('[data-site-navigation-panel="project"]')
    await expect(projectPanel).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Project navigation' })
    ).toBeVisible()
    await expectHrefSet(
      projectPanel.locator('[data-site-navigation-link]'),
      projectHrefs
    )

    const [popupBox, arrowBox, firstProjectLinkBox] = await Promise.all([
      page.locator('[data-site-navigation-popup]').boundingBox(),
      page.locator('[data-site-navigation-arrow]').boundingBox(),
      projectPanel.locator('[data-site-navigation-link]').first().boundingBox()
    ])
    expect(popupBox).not.toBeNull()
    expect(arrowBox).not.toBeNull()
    expect(firstProjectLinkBox).not.toBeNull()
    expect(arrowBox!.y - popupBox!.y).toBeGreaterThanOrEqual(8)
    expect(
      firstProjectLinkBox!.y - (arrowBox!.y + arrowBox!.height)
    ).toBeGreaterThanOrEqual(6)

    await page.keyboard.press('Escape')
    await expect(projectPanel).toBeHidden()
    await expect(projectTrigger).toBeFocused()
  })

  test('navigates to an archive index and marks it current', async ({
    page
  }) => {
    const target = exploreNavigationLinks[1]

    await page.goto('/')
    await page
      .locator('[data-site-navigation="desktop"]')
      .locator(`[href="${target.href}"]`)
      .click()

    await expect(page).toHaveURL(new RegExp(`${target.href}$`))
    await expect(
      page
        .locator('[data-site-navigation="desktop"]')
        .locator(`[href="${target.href}"]`)
    ).toHaveAttribute('aria-current', 'page')
  })

  test('closes Project when the current project link is activated', async ({
    page
  }) => {
    const target = projectNavigationLinks[0]

    await page.goto(target.href)
    await page.locator('[data-site-navigation-trigger="project"]').click()

    const projectPanel = page.locator('[data-site-navigation-panel="project"]')
    await expect(projectPanel).toBeVisible()
    await projectPanel.locator(`[href="${target.href}"]`).click()
    await expect(projectPanel).toBeHidden()
  })

  test('does not overlap or overflow at the narrow desktop boundary', async ({
    page
  }) => {
    await page.setViewportSize({ width: 901, height: 800 })
    await page.goto('/')

    const header = page.locator('[data-site-header]')
    const wordmark = header.locator('a').first()
    const navigation = header.locator('[data-site-navigation="desktop"]')
    const actions = header.locator('[data-site-header-actions]')

    const [wordmarkBox, navigationBox, actionsBox] = await Promise.all([
      wordmark.boundingBox(),
      navigation.boundingBox(),
      actions.boundingBox()
    ])

    expect(wordmarkBox).not.toBeNull()
    expect(navigationBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect(wordmarkBox!.x + wordmarkBox!.width).toBeLessThanOrEqual(
      navigationBox!.x
    )
    expect(navigationBox!.x + navigationBox!.width).toBeLessThanOrEqual(
      actionsBox!.x
    )
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      )
      .toBe(true)
  })

  test('uses background hover states and the native pointer over gallery headers', async ({
    page
  }) => {
    for (const href of ['/', '/scenarios']) {
      await page.goto(href)

      const header = page.locator('[data-site-header]')
      const navigationLinks = header.locator(
        '[data-site-navigation="desktop"] [data-site-navigation-link]'
      )
      const hoveredLink = navigationLinks.nth(href === '/scenarios' ? 1 : 0)
      const adjacentLink = navigationLinks.nth(href === '/scenarios' ? 2 : 1)
      const crosshair = page.locator('[data-gallery-cursor]')
      const wordmark = header.locator('a').first()
      const accentColor = await resolveCssColor(page, '--brand-accent')

      await expect(wordmark).toHaveCSS('cursor', 'pointer')
      await expect(hoveredLink).toHaveCSS('cursor', 'pointer')
      await expect(
        header.locator('button[data-search-ready="true"]')
      ).toHaveCSS('cursor', 'pointer')

      await page.mouse.move(720, 450)
      await expect(crosshair).toHaveCSS('opacity', '1')

      await wordmark.hover()
      await expect(wordmark).toHaveCSS('color', accentColor)

      const restingBackground = await hoveredLink.evaluate(
        (element) => getComputedStyle(element).backgroundColor
      )
      await hoveredLink.hover()
      await expect(hoveredLink).toHaveCSS('color', accentColor)
      await expect
        .poll(() =>
          hoveredLink.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
        )
        .not.toBe(restingBackground)
      await expect
        .poll(() =>
          adjacentLink.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
        )
        .toBe(restingBackground)
      await expect(crosshair).toHaveCSS('opacity', '0')
    }

    const projectTrigger = page.locator(
      '[data-site-navigation-trigger="project"]'
    )
    await projectTrigger.click()

    const popup = page.locator('[data-site-navigation-popup]')
    const projectLink = popup.locator('[data-site-navigation-link]').first()
    await expect(popup).toBeVisible()
    await expect(projectLink).toHaveCSS('cursor', 'pointer')
    await popup.hover()
    await expect(page.locator('[data-gallery-cursor]')).toHaveCSS(
      'opacity',
      '0'
    )
  })
})

test.describe('compact fine-pointer site navigation', () => {
  test.use({ hasTouch: false, viewport: { width: 900, height: 800 } })

  test('keeps the gallery crosshair out of the portaled navigation panel', async ({
    page
  }) => {
    await page.goto('/')

    const crosshair = page.locator('[data-gallery-cursor]')
    await expect
      .poll(async () => {
        await page.mouse.move(449, 400)
        await page.mouse.move(450, 400)
        return crosshair.evaluate(
          (element) => getComputedStyle(element).opacity
        )
      })
      .toBe('1')

    await page.locator('[data-site-navigation-toggle]').click()
    const panel = page.locator('[data-site-navigation-panel="mobile"]')
    await expect(panel).toBeVisible()
    const hoveredLink = panel.locator('[data-site-navigation-link]').first()
    await hoveredLink.hover()
    await expect(hoveredLink).toHaveCSS(
      'color',
      await resolveCssColor(page, '--brand-accent')
    )
    await expect(crosshair).toHaveCSS('opacity', '0')
  })
})

test.describe('mobile site navigation', () => {
  test.use({
    hasTouch: true,
    viewport: { width: 390, height: 844 }
  })

  test('opens the complete hierarchy, restores focus, and closes on navigation', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(exploreNavigationLinks[0].href)

    const header = page.locator('[data-site-header]')
    const toggle = header.locator('[data-site-navigation-toggle]')

    await expect(
      header.locator('[data-site-navigation="desktop"]')
    ).toBeHidden()
    await expect(
      header.locator('button[data-search-ready="true"]')
    ).toBeVisible()
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAccessibleName('Menu')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await toggle.click()
    const panel = page.locator('[data-site-navigation-panel="mobile"]')
    await expect(panel).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expectHrefSet(panel.locator('[data-site-navigation-link]'), allHrefs)
    await expect(panel.locator('[aria-current="page"]')).toHaveCSS(
      'color',
      await resolveCssColor(page, '--brand-accent')
    )

    const headingRow = panel.locator('[data-site-navigation-heading-row]')
    const title = headingRow.locator('[data-site-navigation-title]')
    const closeButton = headingRow.locator('[data-site-navigation-close]')
    await expect(title).toBeVisible()
    await expect(closeButton).toBeVisible()
    await expect(headingRow.locator(':scope > *')).toHaveCount(2)

    const [titleBox, closeButtonBox] = await Promise.all([
      title.boundingBox(),
      closeButton.boundingBox()
    ])
    expect(titleBox).not.toBeNull()
    expect(closeButtonBox).not.toBeNull()
    expect(
      Math.abs(
        titleBox!.y +
          titleBox!.height / 2 -
          (closeButtonBox!.y + closeButtonBox!.height / 2)
      )
    ).toBeLessThanOrEqual(1)

    const mobileLinks = panel.locator('[data-site-navigation-link]')
    await expect
      .poll(() =>
        mobileLinks.evaluateAll((links) =>
          links.every((link) => link.childElementCount === 2)
        )
      )
      .toBe(true)

    const exploreGroup = panel.locator('[data-site-navigation-group="explore"]')
    const projectGroup = panel.locator('[data-site-navigation-group="project"]')
    await expect(
      exploreGroup.locator('[data-site-navigation-index]')
    ).toHaveText(expectedIndexes(exploreNavigationLinks))
    await expect(
      projectGroup.locator('[data-site-navigation-index]')
    ).toHaveText(expectedIndexes(projectNavigationLinks))

    const [exploreCopyBox, projectCopyBox] = await Promise.all([
      exploreGroup
        .locator('[data-site-navigation-link-copy]')
        .first()
        .boundingBox(),
      projectGroup
        .locator('[data-site-navigation-link-copy]')
        .first()
        .boundingBox()
    ])
    expect(exploreCopyBox).not.toBeNull()
    expect(projectCopyBox).not.toBeNull()
    expect(Math.abs(exploreCopyBox!.x - projectCopyBox!.x)).toBeLessThanOrEqual(
      0.5
    )

    const overlay = page.locator('[data-slot="sheet-overlay"]')
    const [headerZIndex, overlayZIndex, panelZIndex] = await Promise.all([
      numericZIndex(header),
      numericZIndex(overlay),
      numericZIndex(panel)
    ])
    expect(overlayZIndex).toBeGreaterThan(headerZIndex)
    expect(panelZIndex).toBeGreaterThan(headerZIndex)
    await expect(overlay).toHaveCSS('animation-name', 'none')
    await expect(panel).toHaveCSS('animation-name', 'none')
    await expect(panel).toHaveCSS('transition-duration', '0s')

    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(toggle).toBeFocused()

    const target = exploreNavigationLinks[2]
    await toggle.click()
    await panel.locator(`[href="${target.href}"]`).click()

    await expect(page).toHaveURL(new RegExp(`${target.href}$`))
    await expect(panel).toBeHidden()
  })
})

async function expectHrefSet(links: Locator, expected: readonly string[]) {
  const hrefs = await links.evaluateAll((elements) =>
    elements
      .map((element) => element.getAttribute('href'))
      .filter((href): href is string => href !== null)
      .toSorted()
  )

  expect(hrefs).toEqual(expected)
}

async function numericZIndex(locator: Locator) {
  return locator.evaluate((element) =>
    Number.parseInt(getComputedStyle(element).zIndex, 10)
  )
}

function expectedIndexes(links: readonly unknown[]) {
  return links.map((_, index) => String(index + 1).padStart(2, '0'))
}

async function resolveCssColor(page: Page, variable: string) {
  return page.evaluate((cssVariable) => {
    const probe = document.createElement('span')
    probe.style.color = `var(${cssVariable})`
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, variable)
}
