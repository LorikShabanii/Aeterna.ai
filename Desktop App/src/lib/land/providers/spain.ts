import type { CadastralLookupResult, CadastralMapOverlay, CadastralProvider } from './types'

// TODO: Spain's cadastre (Catastro) is public via the Dirección General
// del Catastro's WFS/WMS INSPIRE services (ovc.catastro.meh.es) — not yet
// investigated. Do the same real-endpoint verification pass done for
// Kosovo (src/lib/land/providers/kosovo.ts) before implementing: confirm
// the actual working WFS/WMS URLs and layer names by inspecting real
// traffic or GetCapabilities, don't assume from documentation alone.
export const spainProvider: CadastralProvider = {
  countryCode: 'ES',

  async lookupParcel(_lat: number, _lng: number): Promise<CadastralLookupResult | null> {
    return null
  },

  getMapOverlay(): CadastralMapOverlay | null {
    return null
  },
}
