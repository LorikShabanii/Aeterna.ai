// The public half of the Handover escrow keypair — safe to embed in the
// client bundle, that's the whole point of asymmetric crypto here. Only
// the matching private key (an Edge Function secret, ESCROW_PRIVATE_KEY,
// never given to any client) can unwrap what this encrypts. See
// supabase/migrations/20260907000000_vault_key_escrow.sql for the design
// and its tradeoffs.
const ESCROW_PUBLIC_KEY_SPKI_B64 =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw6G43MutetRRqg0ktXI4Lc9Bd14Y/mWgA6R6PkGYPg3mJMfN1hvZhpBk662AOIg1iA0jbRW/VmYSS6/eODOgznrI9SsI9Rdl3cbNpHKa9drZ/asbK5lYoXPxBUtBt+QWHUyT1TF0Mq3EFBRBXmtb5T4ruEHpnZPDBcUyLlUTejuSSkQHf47aFbsgEx6UyPh7S3lVbNamVwb5/HQlfHhZIbW+SI08GIDf1lzOrjUN6TSYgIiefeniR7J2wmsROsfbW7g6lhuvnmoV+DbSTQtJ6eYI6lwEL3Y3iEcpnDJPKmscFLjaAkhpTV5Q2XJAoRIXbAjI341xln5dotyenfpIVQIDAQAB'

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toBase64(bytes: Uint8Array | ArrayBuffer): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of arr) binary += String.fromCharCode(byte)
  return btoa(binary)
}

let cachedPublicKey: CryptoKey | undefined

async function getEscrowPublicKey(): Promise<CryptoKey> {
  cachedPublicKey ??= await crypto.subtle.importKey(
    'spki',
    fromBase64(ESCROW_PUBLIC_KEY_SPKI_B64),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  return cachedPublicKey
}

export async function wrapKeyForEscrow(rawKey: Uint8Array<ArrayBuffer>): Promise<string> {
  const publicKey = await getEscrowPublicKey()
  const wrapped = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey)
  return toBase64(wrapped)
}
