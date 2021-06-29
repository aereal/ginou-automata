import { SecretManagerServiceClient } from "@google-cloud/secret-manager"

const [GINOU_LOGIN_ID, GINOU_LOGIN_PASSWORD, GINOU_YOYAKU_URL] = [
  "GINOU_LOGIN_ID",
  "GINOU_LOGIN_PASSWORD",
  "GINOU_YOYAKU_URL",
] as const

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

const prepareEnvFromEnvironmentVariables = (): Environment | Error => {
  const {
    GINOU_LOGIN_ID: id,
    GINOU_LOGIN_PASSWORD: password,
    GINOU_YOYAKU_URL: yoyakuURL,
  } = process.env
  if (id === undefined) {
    return new MissingRequiredParameterError(GINOU_LOGIN_ID)
  }
  if (password === undefined) {
    return new MissingRequiredParameterError(GINOU_LOGIN_PASSWORD)
  }
  if (yoyakuURL === undefined) {
    return new MissingRequiredParameterError(GINOU_YOYAKU_URL)
  }
  return { id, password, yoyakuURL }
}

const prepareEnvFromSecretManager = async (): Promise<Environment | Error> => {
  const client = new SecretManagerServiceClient()
  const secretNames = [GINOU_LOGIN_ID, GINOU_LOGIN_PASSWORD, GINOU_YOYAKU_URL]
  const reqs = secretNames.map(async (name) => {
    const [secret] = await client.accessSecretVersion({ name })
    const data = secret.payload?.data
    if (typeof data === "string") {
      return data
    }
    throw new Error(`secret ${name} has invalid payload`)
  })
  const [id, password, yoyakuURL] = await Promise.all(reqs)
  return { id, password, yoyakuURL }
}

export const prepareEnv = async (
  nodeEnv: string
): Promise<Environment | Error> => {
  if (nodeEnv === "production") {
    return await prepareEnvFromSecretManager()
  }
  return prepareEnvFromEnvironmentVariables()
}
