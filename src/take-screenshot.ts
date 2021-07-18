import { Page } from "puppeteer"

interface TakeScreenshotOptions {
  readonly page: Page
  readonly baseName?: string
  readonly versioned?: boolean
}

export const takeScreenshot = async (
  options: TakeScreenshotOptions
): Promise<void> => {
  const suffix = options.versioned ? "-" + new Date().valueOf() : ""
  const base = options.baseName ?? "screenshot"
  await options.page.screenshot({
    path: `./${base}${suffix}.png`,
    fullPage: true,
  })
}
