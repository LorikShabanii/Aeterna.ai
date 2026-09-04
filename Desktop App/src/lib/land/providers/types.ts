// Pluggable cadastral-provider architecture (docs/roadmap-differentiation-
// features.md > Feature 2). Each country implements this interface as its
// own module under providers/ — never as an inline conditional — so adding
// a new country never touches the UI layer, just the registry below.

export interface CadastralLookupResult {
  cadastralReference: string | null
  boundaryGeoJSON: GeoJSON.Geometry | null
  source: 'official_cadastre'
}

export interface CadastralMapOverlay {
  // A Leaflet WMS tile-layer config (see L.tileLayer.wms in
  // src/components/land-parcel-map.tsx) — the official boundary imagery to
  // show as a reference layer while the user places a pin, for the
  // countries where automated lookup isn't (yet) possible but a real
  // government map layer is.
  wmsUrl: string
  layers: string
  attribution: string
}

export interface CadastralProvider {
  countryCode: string

  // Best-effort automated match: given a point, return the real government
  // parcel it falls in. Returns null whenever no automated match is
  // available — missing coverage, the point is outside the provider's
  // data, or (as with Kosovo today) the provider has no working
  // programmatic lookup at all yet. Never throws for "no match" — only for
  // genuine failures the caller should treat as unexpected.
  lookupParcel(lat: number, lng: number): Promise<CadastralLookupResult | null>

  // A visual reference layer of official boundaries, for when automated
  // lookup isn't available but a real map layer still is. Returns null for
  // providers with nothing to show (the fallback provider, and every
  // not-yet-built stub below).
  getMapOverlay(): CadastralMapOverlay | null
}
