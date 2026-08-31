// Client-side AES-256-GCM encryption via the Web Crypto API, per
// CLAUDE.md > Encryption approach. The vault key is derived from the
// user's master password with PBKDF2 and never leaves the browser —
// only the (non-secret) salt is persisted, in the Supabase auth user's
// metadata, so the same password re-derives the same key on any device.

const PBKDF2_ITERATIONS = 210_000
const IV_LENGTH = 12

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function generateSaltB64() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveVaultKey(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

// iv is prefixed to the ciphertext so both stay one envelope.
// Uint8Array<ArrayBuffer> (not the wider ArrayBufferLike default) is what
// BufferSource/BlobPart actually require — .slice()/.subarray() keep that
// narrowing at runtime (always a fresh, non-shared buffer) but TS's lib
// types don't propagate it, hence the casts.
async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return combined
}

async function decryptBytes(
  key: CryptoKey,
  envelope: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = envelope.slice(0, IV_LENGTH) as Uint8Array<ArrayBuffer>
  const ciphertext = envelope.slice(IV_LENGTH) as Uint8Array<ArrayBuffer>
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new Uint8Array(plaintext)
}

// Text letters are stored in the vault_items.encrypted_payload text column, so pack as base64.
export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  return toBase64(await encryptBytes(key, new TextEncoder().encode(plaintext)))
}

export async function decryptText(key: CryptoKey, payload: string): Promise<string> {
  return new TextDecoder().decode(await decryptBytes(key, fromBase64(payload)))
}

// Documents/photos/videos go to Supabase Storage as raw bytes — no base64
// overhead needed since the object store isn't a text column.
export async function encryptFile(key: CryptoKey, file: File): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  return new Blob([await encryptBytes(key, bytes)])
}

export async function decryptToBlob(key: CryptoKey, encrypted: Blob, mimeType?: string): Promise<Blob> {
  const bytes = new Uint8Array(await encrypted.arrayBuffer())
  const plaintext = await decryptBytes(key, bytes)
  return new Blob([plaintext], mimeType ? { type: mimeType } : undefined)
}
