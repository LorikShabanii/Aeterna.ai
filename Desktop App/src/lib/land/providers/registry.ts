import type { CadastralProvider } from './types'
import { kosovoProvider } from './kosovo'
import { franceProvider } from './france'
import { latviaProvider } from './latvia'
import { spainProvider } from './spain'
import { fallbackProvider } from './fallback'

// Adding a country is: write providers/<country>.ts implementing
// CadastralProvider, then register it here. Nothing outside this file and
// the UI's country picker needs to change.
const providers: Record<string, CadastralProvider> = {
  XK: kosovoProvider,
  FR: franceProvider,
  LV: latviaProvider,
  ES: spainProvider,
}

export function getProvider(countryCode: string): CadastralProvider {
  return providers[countryCode] ?? fallbackProvider
}

export const SUPPORTED_COUNTRY_CODES = Object.keys(providers)
