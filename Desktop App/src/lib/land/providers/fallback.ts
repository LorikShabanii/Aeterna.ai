import type { CadastralLookupResult, CadastralMapOverlay, CadastralProvider } from './types'

// Default for any country_code with no registered provider (see
// registry.ts) — generic map, manual pin-drop only, no official layer to
// check against. Never lets a missing provider break the flow.
export const fallbackProvider: CadastralProvider = {
  countryCode: '',

  async lookupParcel(_lat: number, _lng: number): Promise<CadastralLookupResult | null> {
    return null
  },

  getMapOverlay(): CadastralMapOverlay | null {
    return null
  },
}
