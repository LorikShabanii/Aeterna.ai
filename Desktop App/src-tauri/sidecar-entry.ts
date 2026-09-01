// Standalone production server for the Tauri sidecar. TanStack Start's own
// built server.js is a pure SSR/API fetch handler with no static-file
// serving (normally a reverse proxy's job in a real Node deployment) — this
// wraps it with static serving for dist/client, then compiles to a single
// self-contained .exe via `bun build --compile` (see package.json's
// desktop:build:sidecar script). Resolves dist/client relative to this
// file's own compiled location so it works both in src-tauri/ during build
// and once Tauri copies the exe + resources into the installed app.
import serverHandler from '../dist/server/server.js'
import { dirname, join } from 'node:path'

// import.meta.url doesn't resolve to a real filesystem path once this is
// compiled into a standalone .exe (bun build --compile) — process.execPath
// (the running binary's own location) is what actually works there.
// Tauri places bundle.resources entries in a "resources" folder next to
// the sidecar/main executable once installed (see build-sidecar.mjs for
// why the client build lives at src-tauri/resources/client rather than
// being referenced at ../dist/client directly).
const clientDir = join(dirname(process.execPath), 'resources', 'client')

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/assets/')) {
      const file = Bun.file(join(clientDir, url.pathname))
      if (await file.exists()) return new Response(file)
    }
    return serverHandler.fetch(req)
  },
})

console.log(`Aeterna server listening on port ${Number(process.env.PORT) || 3000}`)
