import { useEffect, useRef } from 'react'
import type * as Leaflet from 'leaflet'
import type { CadastralMapOverlay } from '@/lib/land/providers/types'
import 'leaflet/dist/leaflet.css'

// Kosovo/Pristina — the land-succession use case this feature targets
// (see CLAUDE.md > "What Lovable narrowed") — a reasonable default center
// when there's nothing to fit the view to yet.
const DEFAULT_CENTER: [number, number] = [42.6629, 21.1655]
const DEFAULT_ZOOM = 7

export interface ParcelMarker {
  id: string
  name: string
  lat: number
  lng: number
}

// Plain Leaflet, imperatively managed via refs — not react-leaflet, which
// doesn't yet officially support React 19 (see
// docs/roadmap-differentiation-features.md > Feature 2 implementation
// notes). Leaflet touches `window` at import time, so it's dynamically
// imported inside an effect — this component renders nothing server-side
// and mounts the real map only after hydration.
export function LandParcelMap({
  markers,
  pickable = false,
  draftPosition = null,
  onPick,
  overlay = null,
  className = 'h-64 w-full rounded-md',
}: {
  markers: ParcelMarker[]
  pickable?: boolean
  draftPosition?: { lat: number; lng: number } | null
  onPick?: (lat: number, lng: number) => void
  // A real government cadastral WMS layer (see providers/kosovo.ts) shown
  // as a reference overlay on top of the OSM base tiles — null when the
  // selected country's provider has none to offer.
  overlay?: CadastralMapOverlay | null
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Leaflet.Map | null>(null)
  const markerLayerRef = useRef<Leaflet.LayerGroup | null>(null)
  const draftMarkerRef = useRef<Leaflet.Marker | null>(null)
  const overlayLayerRef = useRef<Leaflet.TileLayer.WMS | null>(null)
  const iconRef = useRef<Leaflet.Icon | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  // Mount once.
  useEffect(() => {
    let cancelled = false

    async function mount() {
      if (!containerRef.current) return
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      // Leaflet's default marker icon (Icon.Default) resolves its asset
      // paths by probing a CSS background-image at runtime, which breaks
      // under Vite's bundling regardless of mergeOptions — so every marker
      // gets an explicit icon built from the real imported asset URLs
      // instead of ever touching Icon.Default.
      const iconRetinaUrl = (await import('leaflet/dist/images/marker-icon-2x.png')).default
      const iconUrl = (await import('leaflet/dist/images/marker-icon.png')).default
      const shadowUrl = (await import('leaflet/dist/images/marker-shadow.png')).default
      iconRef.current = L.icon({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })

      const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      if (pickable) {
        map.on('click', (e: Leaflet.LeafletMouseEvent) => {
          onPickRef.current?.(e.latlng.lat, e.latlng.lng)
        })
      }

      markerLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
    }

    void mount()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // Mount once — pickable/onPick changes are read via onPickRef, not
    // re-triggering a remount.
  }, [])

  // Redraw the read-only markers whenever the list changes.
  useEffect(() => {
    let cancelled = false
    async function draw() {
      const L = (await import('leaflet')).default
      if (cancelled) return
      const layer = markerLayerRef.current
      if (!layer) return
      layer.clearLayers()
      for (const marker of markers) {
        L.marker([marker.lat, marker.lng], { icon: iconRef.current ?? undefined })
          .addTo(layer)
          .bindPopup(marker.name)
      }
      if (markers.length > 0 && mapRef.current) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng]))
        mapRef.current.fitBounds(bounds.pad(0.2), { maxZoom: 14 })
      }
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [markers])

  // Add/replace/remove the official cadastral overlay whenever it changes.
  useEffect(() => {
    let cancelled = false
    async function draw() {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return

      overlayLayerRef.current?.remove()
      overlayLayerRef.current = null

      if (!overlay) return

      overlayLayerRef.current = L.tileLayer
        .wms(overlay.wmsUrl, {
          layers: overlay.layers,
          format: 'image/png',
          transparent: true,
          attribution: overlay.attribution,
        })
        .addTo(mapRef.current)
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [overlay])

  // Move/create the draft (pick-a-spot) marker whenever it changes.
  useEffect(() => {
    let cancelled = false
    async function draw() {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current) return

      if (!draftPosition) {
        draftMarkerRef.current?.remove()
        draftMarkerRef.current = null
        return
      }

      if (draftMarkerRef.current) {
        draftMarkerRef.current.setLatLng([draftPosition.lat, draftPosition.lng])
      } else {
        draftMarkerRef.current = L.marker([draftPosition.lat, draftPosition.lng], {
          icon: iconRef.current ?? undefined,
          opacity: 0.85,
        }).addTo(mapRef.current)
      }
      mapRef.current.panTo([draftPosition.lat, draftPosition.lng])
    }
    void draw()
    return () => {
      cancelled = true
    }
  }, [draftPosition])

  return <div ref={containerRef} className={className} />
}
