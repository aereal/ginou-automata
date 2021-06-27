export type Present<T> = T extends undefined
  ? never
  : T extends null
  ? never
  : T

export const isPresent = <T>(x: T | undefined): x is Present<T> =>
  x !== undefined
