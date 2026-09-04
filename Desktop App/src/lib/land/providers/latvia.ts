import type { CadastralLookupResult, CadastralMapOverlay, CadastralProvider } from './types'

// TODO: Latvia's cadastre (Kadastrs) is public via VZD's (Valsts zemes
// dienests) WFS/WMS services — not yet investigated. Do the same
// real-endpoint verification pass done for Kosovo
// (src/lib/land/providers/kosovo.ts) before implementing: confirm the
// actual working WFS/WMS URLs and layer names by inspecting real traffic
// or GetCapabilities, don't assume from documentation alone.
export const latviaProvider: CadastralProvider = {
  countryCode: 'LV',

  async lookupParcel(_lat: number, _lng: number): Promise<CadastralLookupResult | null> {
    return null
  },

  getMapOverlay(): CadastralMapOverlay | null {
    return null
  },
}
