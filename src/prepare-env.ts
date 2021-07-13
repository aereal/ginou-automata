import {
  protos,
  SecretManagerServiceClient,
} from "@google-cloud/secret-manager"

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
    let secret:
      | protos.google.cloud.secretmanager.v1.IAccessSecretVersionResponse
      | undefined
    try {
      const resp = await client.accessSecretVersion({
        name: `projects/ginou-automata/secrets/${name}/versions/latest`,
      })
      secret = resp[0]
    } catch (e: unknown) {
      if (e instanceof Error) {
        return e
      }
      return new Error(`unknown error: ${e}`)
    }
    const data = secret.payload?.data
    if (data === null || data === undefined) {
      return new Error(`secret ${name} is empty`)
    }
    if (typeof data === "string") {
      return data
    }
    return new TextDecoder().decode(data)
  })
  const [id, password, yoyakuURL] = await Promise.all(reqs)
  if (id instanceof Error) {
    return id
  }
  if (password instanceof Error) {
    return password
  }
  if (yoyakuURL instanceof Error) {
    return yoyakuURL
  }
  return { id, password, yoyakuURL }
}

export const prepareEnv = async (
  nodeEnv: string
): Promise<Environment | Error> => {
  return prepareEnvFromEnvironmentVariables()
}
