// Holds the derived vault key in memory only, for the life of this tab —
// never persisted (localStorage/cookies) since that would defeat the
// zero-knowledge promise. A page refresh loses it; the vault UI re-prompts
// for the master password to re-derive it via deriveVaultKey.

let vaultKey: CryptoKey | null = null

export function setVaultKey(key: CryptoKey) {
  vaultKey = key
}

export function getVaultKey() {
  return vaultKey
}

export function clearVaultKey() {
  vaultKey = null
}
