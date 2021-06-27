export interface Environment {
  readonly id: string
  readonly password: string
  readonly yoyakuURL: string
}

export const prepareEnv = (): Environment | undefined => {
  const {
    GINOU_LOGIN_ID: id,
    GINOU_LOGIN_PASSWORD: password,
    GINOU_YOYAKU_URL: yoyakuURL,
  } = process.env
  if (id === undefined) {
    return undefined
  }
  if (password === undefined) {
    return undefined
  }
  if (yoyakuURL === undefined) {
    return undefined
  }
  return { id, password, yoyakuURL }
}
