import {
  Browser,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
  launch,
  LaunchOptions,
} from "puppeteer"

interface Options {
  readonly inContainer?: boolean
}

type PuppeteerOptions = LaunchOptions &
  BrowserLaunchArgumentOptions &
  BrowserConnectOptions

const buildLaunchOptions = (opts: Options): PuppeteerOptions => ({
  timeout: 5000,
  args: opts.inContainer
    ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    : [],
})

export const launchPuppeteer = (opts: Options): Promise<Browser> =>
  launch(buildLaunchOptions(opts))
