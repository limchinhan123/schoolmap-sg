'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Map, { Marker, Source, Layer, type MapRef, type MapMouseEvent } from 'react-map-gl/mapbox'
import type { GeoJSONSource, GeoJSONFeature } from 'mapbox-gl'
import type { FeatureCollection, GeoJsonProperties, Point } from 'geojson'
import type { School } from '@/lib/types'

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const SINGAPORE = { longitude: 103.8198, latitude: 1.3521, zoom: 11 }
const BOUNDS: [[number, number], [number, number]] = [[103.58, 1.16], [104.08, 1.48]]

const COLOR_MAP: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  orange: '#f97316',
  grey: '#4C1D95',
}
const COLOR_SCORE: Record<string, number> = { green: 4, amber: 3, orange: 2, grey: 1 }

function getPinClass(school: School, isSelected: boolean) {
  const size = 'large'
  const limited = school.pr_limited_data ? ' limited' : ''
  const sel = isSelected ? ' selected' : ''
  return `school-pin pr-${school.pr_color} ${size}${limited}${sel}`
}

export default function MapView({
  schools,
  selected,
  onSelect,
}: {
  schools: School[]
  selected: School | null
  onSelect: (s: School | null) => void
}) {
  const mapRef = useRef<MapRef>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(SINGAPORE.zoom)

  // Part B — force a resize after the map finishes its initial load so it
  // fills whatever container size the CSS has settled on at that moment.
  const handleMapLoad = useCallback(() => {
    mapRef.current?.resize()
  }, [])

  // Part B — watch the wrapper div for any subsequent size changes
  // (panel open/close, window resize, orientation change) and relay to Mapbox.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const geojson = useMemo<FeatureCollection<Point, GeoJsonProperties>>(() => ({
    type: 'FeatureCollection',
    features: schools.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.gate_lng, s.gate_lat] },
      properties: {
        id: s.id,
        pr_color: s.pr_color,
        color_score: COLOR_SCORE[s.pr_color] ?? 1,
      },
    })),
  }), [schools])

  // Fly to selected school
  useEffect(() => {
    if (selected && mapRef.current) {
      mapRef.current.easeTo({
        center: [selected.gate_lng, selected.gate_lat],
        zoom: Math.max(zoom, 14),
        duration: 500,
        offset: [0, -100],
      })
    }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMapClick = useCallback((e: MapMouseEvent & { features?: GeoJSONFeature[] }) => {
    const feature = e.features?.[0]

    if (feature?.layer?.id === 'clusters') {
      const clusterId = feature.properties?.cluster_id as number
      const coords = (feature.geometry as Point).coordinates as [number, number]
      const source = mapRef.current?.getSource('schools') as GeoJSONSource | undefined
      source?.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
        if (err || expansionZoom == null) return
        mapRef.current?.easeTo({ center: coords, zoom: expansionZoom + 0.5, duration: 400 })
      })
      return
    }

    onSelect(null)
  }, [onSelect])

  const showIndividualPins = zoom >= 13

  return (
    <div ref={containerRef} className="w-full h-full">
    <Map
      ref={mapRef}
      mapboxAccessToken={TOKEN}
      initialViewState={SINGAPORE}
      maxBounds={BOUNDS}
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: '100%', height: '100%' }}
      interactiveLayerIds={['clusters']}
      onLoad={handleMapLoad}
      onClick={handleMapClick}
      onZoom={e => setZoom(e.viewState.zoom)}
    >
      {/* MRT station dots — subtle, neighbourhood-orientation only at zoom ≥ 13 */}
      <Layer
        {...{
          id: 'mrt-stations',
          type: 'circle',
          source: 'composite',
          'source-layer': 'transit_stop_label',
          filter: ['==', ['get', 'stop_type'], 'subway'],
          minzoom: 13,
          paint: {
            'circle-color': '#1e3a5f',
            'circle-radius': 4,
            'circle-opacity': 0.55,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.85,
          },
        }}
      />

      <Source
        id="schools"
        type="geojson"
        data={geojson}
        cluster
        clusterMaxZoom={12}
        clusterRadius={50}
        clusterProperties={{ best_score: ['max', ['get', 'color_score']] }}
      >
        {/* Cluster circles */}
        <Layer
          id="clusters"
          type="circle"
          source="schools"
          filter={['has', 'point_count']}
          paint={{
            'circle-color': [
              'step', ['get', 'best_score'],
              COLOR_MAP.grey, 2, COLOR_MAP.orange, 3, COLOR_MAP.amber, 4, COLOR_MAP.green,
            ],
            'circle-radius': ['step', ['get', 'point_count'], 20, 10, 28, 50, 36],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#fff',
            'circle-opacity': 0.92,
          }}
        />

        {/* Cluster count labels */}
        <Layer
          id="cluster-count"
          type="symbol"
          source="schools"
          filter={['has', 'point_count']}
          layout={{
            'text-field': '{point_count_abbreviated}',
            'text-size': 13,
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          }}
          paint={{ 'text-color': '#fff' }}
        />

        {/* Unclustered dots — visible only when zoom < 13 */}
        <Layer
          id="unclustered-dot"
          type="circle"
          source="schools"
          filter={['!', ['has', 'point_count']]}
          layout={{ visibility: showIndividualPins ? 'none' : 'visible' }}
          paint={{
            'circle-color': [
              'match', ['get', 'pr_color'],
              'green', COLOR_MAP.green,
              'amber', COLOR_MAP.amber,
              'orange', COLOR_MAP.orange,
              COLOR_MAP.grey,
            ],
            'circle-radius': 9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          }}
        />
      </Source>

      {/* Individual React Markers at zoom ≥ 13 (gives full CSS control for dotted border etc.) */}
      {showIndividualPins &&
        schools.map(school => (
          <Marker
            key={school.id}
            longitude={school.gate_lng}
            latitude={school.gate_lat}
            anchor="center"
            onClick={e => {
              e.originalEvent.stopPropagation()
              onSelect(school)
            }}
          >
            <div
              className={getPinClass(school, selected?.id === school.id)}
              title={school.name}
            />
          </Marker>
        ))}
    </Map>
    </div>
  )
}
