import { createServer, IncomingMessage, ServerResponse } from "http"
import { performance } from "perf_hooks"
import { main } from "./main"
import { isError, prepareEnv } from "./prepare-env"

const { PORT } = process.env
const port = parseInt(PORT ?? "")
if (isNaN(port)) {
  throw new Error(`Invalid PORT: ${PORT}`)
}

const handleRun = async (
  _: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const from = performance.now()
  await main()
  const done = performance.now()
  const body = JSON.stringify({ elapsedMilliseconds: done - from })
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body, "utf-8"),
  })
  res.end(body)
}

const handleDefault = async (
  _: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const envOrError = await prepareEnv()
  const body = JSON.stringify({
    ok: !isError(envOrError),
  })
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body, "utf-8"),
  })
  res.end(body)
}

const server = createServer(async (req, res) => {
  switch (`${req.method} ${req.url}`) {
    case "GET /run":
      await handleRun(req, res)
      break
    default:
      await handleDefault(req, res)
      break
  }
})
console.log(`accepting requests on :${port}`)
server.listen(port)
