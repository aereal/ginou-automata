import { launch } from "puppeteer-core"
import { prepareEnv } from "./prepare-env"
import { getReservations } from "./scenarios/get-reservations"
import { login } from "./scenarios/login"
import { takeScreenshot } from "./take-screenshot"
;(async () => {
  const browser = await launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    timeout: 5000,
  })
  const env = prepareEnv()
  if (env === undefined) {
    throw new Error(
      "Missing credentials; LOGIN_ID and LOGIN_PASSWORD are required"
    )
  }
  const page = await browser.newPage()

  const loggedIn = await login({ type: undefined, payload: { page, env } })
  await takeScreenshot({ page, baseName: "after-login", versioned: false })
  const {
    payload: { reservations },
  } = await getReservations(loggedIn)
  console.log(reservations)
  await takeScreenshot({ page, baseName: "reservations", versioned: false })

  // const myMenuContent = await page.content()
  // console.log(myMenuContent)

  await browser.close()
})()
