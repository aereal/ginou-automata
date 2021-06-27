import { createServer } from "http"
import { performance } from "perf_hooks"
import { main } from "./main"

const { PORT } = process.env
const port = parseInt(PORT ?? "")
if (isNaN(port)) {
  throw new Error(`Invalid PORT: ${PORT}`)
}
const server = createServer(async (req, res) => {
  const from = performance.now()
  await main()
  const done = performance.now()
  const body = JSON.stringify({ elapsedMilliseconds: done - from })
  res.writeHead(200, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body, "utf-8"),
  })
  res.end(body)
})
console.log(`accepting requests on :${port}`)
server.listen(port)
