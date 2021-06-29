export interface Environment {
  readonly id: string
  readonly password: string
  readonly yoyakuURL: string
}

export class MissingRequiredParameterError extends Error {
  constructor(public readonly parameterName: string) {
    super(`Parameter ${parameterName} is required but not given`)
  }
}

export const isError = (x: unknown): x is Error => x instanceof Error

export const prepareEnv = (): Environment | Error => {
  const {
    GINOU_LOGIN_ID: id,
    GINOU_LOGIN_PASSWORD: password,
    GINOU_YOYAKU_URL: yoyakuURL,
  } = process.env
  if (id === undefined) {
    return new MissingRequiredParameterError("GINOU_LOGIN_ID")
  }
  if (password === undefined) {
    return new MissingRequiredParameterError("GINOU_LOGIN_PASSWORD")
  }
  if (yoyakuURL === undefined) {
    return new MissingRequiredParameterError("GINOU_YOYAKU_URL")
  }
  return { id, password, yoyakuURL }
}
