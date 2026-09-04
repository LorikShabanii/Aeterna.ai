import type { CadastralLookupResult, CadastralMapOverlay, CadastralProvider } from './types'

// TODO: France's cadastre is public via the Cadastre / Plan Cadastral
// Informatisé (PCI) WFS/WMS served through data.gouv.fr / IGN's
// Géoplateforme — not yet investigated. Do the same real-endpoint
// verification pass done for Kosovo (src/lib/land/providers/kosovo.ts)
// before implementing: confirm the actual working WFS/WMS URLs and layer
// names by inspecting real traffic or GetCapabilities, don't assume from
// documentation alone.
export const franceProvider: CadastralProvider = {
  countryCode: 'FR',

  async lookupParcel(_lat: number, _lng: number): Promise<CadastralLookupResult | null> {
    return null
  },

  getMapOverlay(): CadastralMapOverlay | null {
    return null
  },
}
