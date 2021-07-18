import { ElementHandle } from "puppeteer"

export const waitForTransitionEnd = (eh: ElementHandle): Promise<void> =>
  eh.evaluate(
    (el: Element) =>
      new Promise<void>((ok) => {
        const transitionEnd = "transitionend" as const
        const onEnd = () => {
          el.removeEventListener(transitionEnd, onEnd)
          ok()
        }
        el.addEventListener(transitionEnd, onEnd)
      })
  )
