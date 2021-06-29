import { ElementHandle, Frame, Page } from "puppeteer"
import { Reservation } from "../reservation"
import { takeScreenshot } from "../take-screenshot"
import { waitForTransitionEnd } from "../wait-for-transition-end"
import { GotReservations } from "./get-reservations"
import { State } from "./types"

const navigateNextWeek = async (loginFrame: Frame): Promise<void> => {
  await loginFrame.click("label[for=btnNextWeek]")
  await loginFrame.waitForNavigation()
}

const nonNull = <T>(x: T | null): x is T => x !== null

const emptyBadge = "空"

const triedReserveOnPageType: unique symbol = Symbol()

interface TriedReserveOnDayPayload {
  readonly newReservation?: Reservation
}

type TriedReserveOnDay = State<
  typeof triedReserveOnPageType,
  TriedReserveOnDayPayload
>

type PrevTryReserveOnDay = State<
  typeof searchedScheduleOnWeekType,
  {
    readonly currentPage: Page
    readonly loginFrame: Frame
    readonly slotDiv: ElementHandle<Element>
    readonly index: number
  }
>

const tryReserveOnDay = async (
  prev: PrevTryReserveOnDay
): Promise<TriedReserveOnDay> => {
  const {
    payload: { index, loginFrame, slotDiv, currentPage },
  } = prev
  const badgeText = await slotDiv.$eval(".badge", (el) => el.textContent ?? "")
  const hasSlot = badgeText === emptyBadge
  if (!hasSlot) {
    return { type: triedReserveOnPageType, payload: {} }
  }
  const slideSelector = `#pnlSlide_${index}`
  const slide = await loginFrame.$(slideSelector)
  if (slide === null) {
    throw new Error("no slide element found")
  }
  const pulldownButton = await slotDiv.$(".iconarea")
  if (pulldownButton === null) {
    throw new Error("pulldown is null")
  }
  await pulldownButton.click()
  await waitForTransitionEnd(slide)

  const schedulesListSelector = `${slideSelector} .list-container .page`
  await loginFrame.waitForSelector(schedulesListSelector, { timeout: 5000 })
  const scheduleSelector = `${slideSelector} .list-container .page`
  const foundSchedules = await loginFrame.$$(scheduleSelector)
  console.log(`${foundSchedules.length} schedules found`)
  if (foundSchedules.length === 0) {
    return { type: triedReserveOnPageType, payload: {} }
  }
  const [firstSchedule] = foundSchedules
    .map((e) => e.asElement())
    .filter(nonNull)
  if (firstSchedule === null) {
    console.log(`no schedule found`)
    return { type: triedReserveOnPageType, payload: {} }
  }
  await takeScreenshot({ page: currentPage, baseName: "schedule-menu-visible" })
  await firstSchedule.click()
  await loginFrame.waitForNavigation({ timeout: 5 * 1000 })
  const content = await loginFrame.$eval(
    ".zad-contents-area",
    (el) => el.textContent
  )
  console.log(`reserve page = ${content}`)
  // TODO
  return {
    type: triedReserveOnPageType,
    payload: {
      newReservation: {
        subject: "dummy",
        date: new Date(),
        startTime: new Date(),
        finishTime: new Date(),
      },
    },
  }
}

const searchedScheduleOnWeekType: unique symbol = Symbol()

type SearchedScheduleOnWeek = State<
  typeof searchedScheduleOnWeekType,
  {
    readonly lastPage: number
    readonly loginFrame: Frame
    readonly currentPage: Page
    readonly holdingReservations: Reservation[]
  }
>

const searchScheduleOnWeek = async (
  prev: SearchedScheduleOnWeek
): Promise<SearchedScheduleOnWeek> => {
  const {
    payload: { loginFrame, lastPage, holdingReservations, currentPage },
  } = prev
  console.log(
    `---> search page = ${lastPage + 1}; holding ${
      holdingReservations.length
    } reservations`
  )
  const slotDivs = await loginFrame.$$("#lst_lc > .page > div:not(.slide-down)")
  let index = -1
  for (const slotDiv of slotDivs) {
    index++
    const {
      payload: { newReservation },
    } = await tryReserveOnDay({
      type: searchedScheduleOnWeekType,
      payload: { loginFrame, index, slotDiv, currentPage },
    })
    if (newReservation !== undefined) {
      console.log("finish")
      while (holdingReservations.length < maxReservations) {
        holdingReservations.push(holdingReservations[0])
      }
      // TODO
      // if (holdingReservations.length >= maxReservations) {
      return {
        type: searchedScheduleOnWeekType,
        payload: {
          loginFrame,
          holdingReservations,
          lastPage: lastPage + 1,
          currentPage,
        },
      }
      // }
    }
  }

  return {
    type: searchedScheduleOnWeekType,
    payload: {
      loginFrame,
      holdingReservations,
      lastPage: lastPage + 1,
      currentPage,
    },
  }
}

const maxReservations = 3

const reservedType: unique symbol = Symbol()

interface ReservePayload {
  readonly reservations: Reservation[]
}

export type Reserved = State<typeof reservedType, ReservePayload>

type Prev = GotReservations

export const doReserve = async (prev: Prev): Promise<Reserved> => {
  const {
    payload: { loginFrame, reservations, currentPage },
  } = prev
  await loginFrame.click("#btnMenu_Kyoushuuyoyaku")
  await loginFrame.waitForNavigation()

  let lastPage = 0
  let holding = [...reservations]
  while (true) {
    const { payload } = await searchScheduleOnWeek({
      type: searchedScheduleOnWeekType,
      payload: {
        loginFrame,
        holdingReservations: holding,
        lastPage,
        currentPage,
      },
    })
    lastPage = payload.lastPage
    holding = payload.holdingReservations
    if (holding.length >= maxReservations) {
      break
    }
    await navigateNextWeek(payload.loginFrame)
  }

  return {
    type: reservedType,
    payload: {
      reservations: holding,
    },
  }
}
