// Runs as part of `bun run desktop:build`'s beforeBuildCommand. Prepares
// the two things Tauri's production window needs that plain `vite build`
// doesn't produce: the static client assets placed where the sidecar can
// find them post-install, and the sidecar binary itself. See
// sidecar-entry.ts for why a sidecar is needed at all.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const root = import.meta.dirname

// Tauri resource paths can't start with "../" (it remaps them into an
// awkward _up_/ folder), so the client build is copied inside src-tauri/
// rather than referenced in place at ../dist/client.
const resourceDir = `${root}/resources/client`
rmSync(resourceDir, { recursive: true, force: true })
mkdirSync(`${root}/resources`, { recursive: true })
cpSync(`${root}/../dist/client`, resourceDir, { recursive: true })
console.log('Copied dist/client -> src-tauri/resources/client')

mkdirSync(`${root}/binaries`, { recursive: true })
const target = execFileSync('rustc', ['-vV']).toString().match(/host: (\S+)/)?.[1]
if (!target) throw new Error('Could not determine Rust target triple')

const outfile = `${root}/binaries/server-${target}${target.includes('windows') ? '.exe' : ''}`
execFileSync('bun', ['build', `${root}/sidecar-entry.ts`, '--compile', '--outfile', outfile], {
  stdio: 'inherit',
})
console.log(`Compiled sidecar -> ${outfile}`)
