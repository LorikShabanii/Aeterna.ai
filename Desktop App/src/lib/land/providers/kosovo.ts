import type { CadastralLookupResult, CadastralMapOverlay, CadastralProvider } from './types'

// Kosovo Cadastral Agency (AKK) Geoportal — confirmed by inspecting the
// portal's own real network traffic (geoportal.rks-gov.net/portal/main),
// not from documentation alone:
//
// - Public WMS proxy in front of a real GeoServer instance:
//     https://geoportal.rks-gov.net/kgp/api/GeoServerProxy/wms
// - Real parcel geometry layer: KCM_DEV_WS:ParcelGeomView (queryable="1"
//   per GetCapabilities, CRS:84/WGS84 supported alongside the native
//   "KosovoRef01" CRS the portal calls EPSG:7392 internally)
// - GetMap (rendering the layer as map imagery) works publicly, no auth.
//
// What does NOT work, confirmed by testing rather than assumed:
// - GetFeatureInfo (the operation that would answer "what parcel is at
//   this point, give me its data") returns HTTP 204 with no body — tested
//   at 10 points across and inside the layer's own declared coverage
//   area, with several WMS version/CRS parameter combinations. This
//   proxy appears to only forward GetMap, not general WMS query ops.
// - Raw WFS (GetFeature — the standard way to pull vector geometry
//   directly) 404s on every path tried.
// - GetMap (the map-imagery operation, otherwise confirmed working
//   against KG_DEV_WS:MunicipalityKGP as a control — real 200 responses,
//   real image bytes) also returns HTTP 204 with zero bytes for BOTH
//   parcel layers specifically, at every location and zoom tested,
//   including live requests fired by this app's own map component. The
//   layer is correctly registered (valid capabilities, bbox, CRS,
//   queryable="1") but has no retrievable feature data behind it via
//   public access.
// - /kgp/api/Authentication 401s, suggesting an authenticated tier that
//   may expose more — not something obtainable from inside this codebase.
// - "KCM_DEV_WS" (both parcel layers live here) reads as a dev/pilot
//   workspace that was likely never populated, not the production
//   cadastre — KG_DEV_WS (which DOES render) is a different workspace.
//
// So both lookupParcel() and getMapOverlay() honestly return null/nothing
// — there is currently no working programmatic match AND no renderable
// official layer, despite the endpoint and layer names being real and
// correctly wired. If AKK ever populates KCM_DEV_WS (or exposes a
// production-workspace equivalent), getMapOverlay() below is where to
// point at it — the rest of the app (land.tsx's visual-confirm checkbox)
// already handles a working overlay correctly, it's just never exercised
// while this returns null. See
// docs/roadmap-differentiation-features.md > Feature 2 for the full
// writeup.
export const kosovoProvider: CadastralProvider = {
  countryCode: 'XK',

  async lookupParcel(_lat: number, _lng: number): Promise<CadastralLookupResult | null> {
    return null
  },

  getMapOverlay(): CadastralMapOverlay | null {
    return null
  },
}
