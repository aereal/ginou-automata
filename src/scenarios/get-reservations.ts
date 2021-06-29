import { eachSlice } from "@aereal/enumerable"
import { parse } from "date-fns"
import { utcToZonedTime } from "date-fns-tz"
import { ElementHandle, Frame, Page } from "puppeteer"
import { isPresent } from "../present"
import { Reservation } from "../reservation"
import { LoggedIn } from "./login"
import { State } from "./types"

const getReservationsType: unique symbol = Symbol()

interface GetReservationsPayload {
  readonly reservations: Reservation[]
  readonly loginFrame: Frame
  readonly currentPage: Page
}

export type GotReservations = State<
  typeof getReservationsType,
  GetReservationsPayload
>

type Prev = LoggedIn

const parseDate = (s: string): Date => parse(s, "yyyy/MM/dd", new Date())

const parseTime = (s: string, base: Date): Date => parse(s, "HH:mm", base)

export const getReservations = async (prev: Prev): Promise<GotReservations> => {
  const {
    payload: { loginFrame, currentPage },
  } = prev
  await loginFrame.click("#btnMenu_YoyakuItiran")
  await loginFrame.waitForNavigation()

  const pullDownButtons = await loginFrame.$$("#lst_lc .blocks .iconarea") // pull-down buttons
  await Promise.all(pullDownButtons.map((handle) => handle.click()))
  await loginFrame.waitForSelector(".slide-down.show") // await animation finish

  const divs = await loginFrame.$$<HTMLDivElement>("#lst_lc > .page > div")
  const pairs = Array.from(eachSlice(2, divs))
  const extractReservation = async (
    pair: ElementHandle<HTMLDivElement>[]
  ): Promise<Reservation> => {
    const [dateDiv, scheduleDiv] = pair
    const rawDate = await dateDiv.evaluate(
      (el) => el.querySelector(".lbl")?.textContent
    )
    if (rawDate === undefined || rawDate === null) {
      throw new Error("date is undefined")
    }
    const date = utcToZonedTime(parseDate(rawDate.slice(0, 10)), "Asia/Tokyo")
    const [
      _1,
      _2,
      _3,
      rawStart,
      _4,
      rawFinish,
      subject,
    ] = await scheduleDiv.evaluate((el) =>
      Array.from(el.querySelectorAll(".page > div .lbl")).map(
        (label) => label.textContent?.trim() ?? ""
      )
    )
    const startTime = parseTime(rawStart, date)
    const finishTime = parseTime(rawFinish, date)
    return {
      date,
      startTime,
      finishTime,
      subject,
    }
  }
  const reservations = (
    await Promise.all(pairs.map(extractReservation))
  ).filter(isPresent)
  await loginFrame.click(`input[type=submit][value="TOPへ"]`)
  await loginFrame.waitForNavigation()
  return {
    type: getReservationsType,
    payload: {
      reservations,
      loginFrame,
      currentPage,
    },
  }
}
