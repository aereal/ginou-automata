import { launchPuppeteer } from "./launch-puppeteer"
import { isError, prepareEnv } from "./prepare-env"
import { doReserve } from "./scenarios/do-reserve"
import { getReservations } from "./scenarios/get-reservations"
import { login } from "./scenarios/login"
import { takeScreenshot } from "./take-screenshot"

export const main = async () => {
  const { NODE_ENV } = process.env
  const isProduction = NODE_ENV === "production"
  const browser = await launchPuppeteer({
    inContainer: isProduction,
  })
  const envOrError = await prepareEnv(NODE_ENV ?? "")
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
  // console.log(gotReservations.payload.reservations)
  await takeScreenshot({ page, baseName: "reservations", versioned: false })
  const reserved = await doReserve(gotReservations)
  await takeScreenshot({
    page,
    baseName: "done-reservations",
    versioned: false,
  })

  process.stdout.write(
    JSON.stringify({
      reservedReservations: reserved.payload.reservations,
      currentReservations: gotReservations.payload.reservations,
    }) + "\n"
  )

  await browser.close()
}
