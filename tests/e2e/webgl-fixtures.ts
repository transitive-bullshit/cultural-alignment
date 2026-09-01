import type { Page } from '@playwright/test'

export async function disableWebGl2(page: Page) {
  await page.addInitScript(() => {
    // oxlint-disable-next-line typescript/unbound-method -- The original method is invoked with the canvas instance via Reflect.apply below.
    const getContext = HTMLCanvasElement.prototype.getContext

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, contextId: string, ...options: unknown[]) {
        if (contextId === 'webgl2') return null

        return Reflect.apply(getContext, this, [contextId, ...options])
      }
    })
  })
}
