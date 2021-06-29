import { launchPuppeteer } from "./launch-puppeteer"
import { isError, prepareEnv } from "./prepare-env"
import { doReserve } from "./scenarios/do-reserve"
import { getReservations } from "./scenarios/get-reservations"
import { login } from "./scenarios/login"
import { takeScreenshot } from "./take-screenshot"

export const main = async () => {
  const browser = await launchPuppeteer({
    inContainer: process.env.NODE_ENV === "production",
  })
  const envOrError = await prepareEnv()
  if (isError(envOrError)) {
    throw envOrError
  }
  const page = await browser.newPage()

  const loggedIn = await login({
    type: undefined,
    payload: { page, env: envOrError },
  })
  await takeScreenshot({ page, baseName: "after-login", versioned: false })
  const gotReservations = await getReservations(loggedIn)
  console.log(gotReservations.payload.reservations)
  await takeScreenshot({ page, baseName: "reservations", versioned: false })
  await doReserve(gotReservations)
  await takeScreenshot({
    page,
    baseName: "done-reservations",
    versioned: false,
  })

  // const myMenuContent = await page.content()
  // console.log(myMenuContent)

  await browser.close()
}
