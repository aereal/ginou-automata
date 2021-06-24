import { Frame, Page } from "puppeteer-core"
import { Environment } from "../prepare-env"
import { State } from "./types"

const loggedInType: unique symbol = Symbol()

interface LoggedInPayload {
  readonly loginFrame: Frame
}

export type LoggedIn = State<typeof loggedInType, LoggedInPayload>

type Prev = State<
  unknown,
  {
    readonly page: Page
    readonly env: Environment
  }
>

const loginFrameID = "frameMenu"

export const login = async (prev: Prev): Promise<LoggedIn> => {
  const {
    payload: { page, env },
  } = prev

  await page.goto(env.yoyakuURL)
  await page.click("#lnkToLogin")

  await page.waitForSelector(`#${loginFrameID}`)
  await Promise.all(
    page
      .mainFrame()
      .childFrames()
      .map((frame) => frame.waitForNavigation())
  )
  let loginFrame: Frame | undefined
  for (const child of page.mainFrame().childFrames()) {
    if (child.name() === loginFrameID) {
      loginFrame = child
    }
    console.log(`child frame: id=${child.name()} url=${child.url()}`)
  }
  if (loginFrame === undefined) {
    throw new Error("login frame not found")
  }

  await loginFrame.type("#txtKyoushuuseiNO", env.id)
  await loginFrame.type("#txtPassword", env.password)
  await loginFrame.click("#btnAuthentication")
  console.log("clicked login button")
  await loginFrame.waitForNavigation()

  return {
    type: loggedInType,
    payload: {
      loginFrame,
    },
  }
}
