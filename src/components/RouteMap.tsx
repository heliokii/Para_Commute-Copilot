import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { copy } from '../copy'
import { railColor, railLineOf, RAIL_LINES } from '../fares/lines.ts'
import { MODES } from '../lib/modes'
import { getBasemap, MAP_ATTRIBUTION, project, WORLD_HEIGHT, WORLD_WIDTH } from '../map/basemap.ts'
import type { RoutePack, RouteResult } from '../router/types.ts'
import { WALK_ROUTE_ID } from '../router/types.ts'
import { Icon } from './Icon'

// Offline map: OpenStreetMap basemap bundled with the app (src/map/basemap.ts), with
// the route pack's stations and routes on top. No tiles, no network.

const MIN_ZOOM = 1
const MAX_ZOOM = 24
/** A pointer that moves less than this many pixels between down and up is a tap. */
const TAP_SLOP = 6
/** How close, in pixels, a tap must land to a station to pick it. */
const HIT_RADIUS = 22

interface Point {
  x: number
  y: number
}

interface View {
  zoom: number
  x: number
  y: number
}

const HOME: View = { zoom: 1, x: (WORLD_WIDTH - WORLD_HEIGHT) / 2, y: 0 }

/** Stops a leg rides through, board to alight inclusive. */
function legStops(pack: RoutePack, leg: RouteResult['legs'][number]): string[] {
  if (leg.routeId === WALK_ROUTE_ID) return [leg.boardId, leg.alightId]
  const stops = pack.routes.find((route) => route.id === leg.routeId)?.stops ?? []
  const from = stops.findIndex((stop) => stop.landmarkId === leg.boardId)
  const to = stops.findIndex((stop, index) => index > from && stop.landmarkId === leg.alightId)
  if (from < 0 || to < 0) return [leg.boardId, leg.alightId]
  return stops.slice(from, to + 1).map((stop) => stop.landmarkId)
}

/** The square window can show more than the map; keep the map from leaving the window. */
function clampView(view: View): View {
  const zoom = Math.min(Math.max(view.zoom, MIN_ZOOM), MAX_ZOOM)
  const extent = WORLD_HEIGHT / zoom
  const range = (world: number): [number, number] => [Math.min(0, world - extent), Math.max(0, world - extent)]
  const [minX, maxX] = range(WORLD_WIDTH)
  const [minY, maxY] = range(WORLD_HEIGHT)
  return { zoom, x: Math.min(Math.max(view.x, minX), maxX), y: Math.min(Math.max(view.y, minY), maxY) }
}

function fitView(points: Point[]): View {
  if (points.length === 0) return HOME
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 30)
  const zoom = Math.min(Math.max(WORLD_HEIGHT / (span * 1.5), MIN_ZOOM), MAX_ZOOM)
  const extent = WORLD_HEIGHT / zoom
  return clampView({
    zoom,
    x: (Math.min(...xs) + Math.max(...xs)) / 2 - extent / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2 - extent / 2,
  })
}

interface RouteMapProps {
  pack: RoutePack
  /** Selected route. Without one, the whole network is shown. */
  result: RouteResult | null
  /** Stations the rider has picked for a fare lookup: boarding first, alighting second. */
  marked?: { originId: string; destinationId: string }
  /** Called when the rider taps a station. */
  onStationClick?: (landmarkId: string) => void
}

export function RouteMap({ pack, result, marked, onStationClick }: RouteMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const downAt = useRef<Point | null>(null)
  const [view, setView] = useState<View>(HOME)
  const [width, setWidth] = useState(360)
  const base = useMemo(() => getBasemap(), [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setWidth(svg.clientWidth || 360))
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const { points, legs, focusIds } = useMemo(() => {
    const projected = new Map<string, Point>()
    for (const landmark of pack.landmarks) projected.set(landmark.id, project(landmark.lon, landmark.lat))
    const legPaths = (result?.legs ?? []).map((leg) => ({ leg, stops: legStops(pack, leg) }))
    return { points: projected, legs: legPaths, focusIds: new Set(legPaths.flatMap((path) => path.stops)) }
  }, [pack, result])

  // Frame the selected route when it changes, the whole map when it is cleared.
  const [framedFor, setFramedFor] = useState<RouteResult | null>(null)
  if (framedFor !== result) {
    setFramedFor(result)
    const fit = [...focusIds].map((id) => points.get(id)).filter((point): point is Point => Boolean(point))
    setView(result ? fitView(fit) : HOME)
  }

  const line = (ids: string[]) =>
    ids
      .map((id) => points.get(id))
      .filter((point): point is Point => Boolean(point))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ')

  const name = (id: string) => pack.landmarks.find((landmark) => landmark.id === id)?.name ?? id
  const originId = result?.legs[0]?.boardId ?? marked?.originId
  const destinationId = result?.legs.at(-1)?.alightId ?? marked?.destinationId
  const transferIds = new Set(result?.legs.slice(1).map((leg) => leg.boardId) ?? [])
  const stations = pack.landmarks.filter((landmark) => railLineOf(landmark.id))

  function zoomBy(factor: number, center: Point = { x: 0.5, y: 0.5 }) {
    setView((current) => {
      const zoom = Math.min(Math.max(current.zoom * factor, MIN_ZOOM), MAX_ZOOM)
      const before = WORLD_HEIGHT / current.zoom
      const after = WORLD_HEIGHT / zoom
      return clampView({
        zoom,
        x: current.x + (before - after) * center.x,
        y: current.y + (before - after) * center.y,
      })
    })
  }

  const extent = WORLD_HEIGHT / view.zoom
  /** World units per screen pixel at this zoom. Sizes below are in pixels times this. */
  const px = extent / width
  const unitsPerPixel = () => extent / (svgRef.current?.clientWidth || width)

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    downAt.current = pointers.current.size === 1 ? { x: event.clientX, y: event.clientY } : null
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const next = { x: event.clientX, y: event.clientY }
    if (pointers.current.size === 2) {
      // Pinch: compare finger spacing before and after this move.
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)![1]
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(next.x - other.x, next.y - other.y)
      if (before > 0) zoomBy(after / before)
    } else {
      const scale = unitsPerPixel()
      setView((current) =>
        clampView({
          ...current,
          x: current.x - (next.x - previous.x) * scale,
          y: current.y - (next.y - previous.y) * scale,
        }),
      )
    }
    pointers.current.set(event.pointerId, next)
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    const start = downAt.current
    pointers.current.delete(event.pointerId)
    downAt.current = null
    if (!start || !onStationClick || event.type === 'pointercancel') return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP) return
    // A tap: pick the nearest station within reach, measured in screen pixels.
    const box = event.currentTarget.getBoundingClientRect()
    const wx = view.x + ((event.clientX - box.left) / box.width) * extent
    const wy = view.y + ((event.clientY - box.top) / box.height) * extent
    let best: { id: string; distance: number } | null = null
    for (const station of stations) {
      const point = points.get(station.id)
      if (!point) continue
      const distance = Math.hypot(point.x - wx, point.y - wy) / unitsPerPixel()
      if (distance <= HIT_RADIUS && (!best || distance < best.distance)) best = { id: station.id, distance }
    }
    if (best) onStationClick(best.id)
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    zoomBy(event.deltaY < 0 ? 1.2 : 1 / 1.2, {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    })
  }

  const controlClass =
    'flex size-11 items-center justify-center rounded-full bg-surface-cream text-ink-dark shadow-card'
  // Roads fade in as the rider zooms; stroke widths are screen pixels (non-scaling), grown a little with zoom.
  const grow = 1 + Math.log2(view.zoom) * 0.22
  const road = (cls: keyof typeof base.roads, color: string, widthPx: number) => (
    <path d={base.roads[cls]} fill="none" stroke={color} strokeWidth={widthPx * grow} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  )
  const showNames = view.zoom >= 3.5
  const visibleStations = view.zoom >= 4

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#EEE5D4]">
      <svg
        ref={svgRef}
        role="img"
        aria-label={
          result && originId && destinationId
            ? copy.map.describe(name(originId), name(destinationId), result.legs.length)
            : copy.map.describeNetwork
        }
        data-testid="route-map"
        viewBox={`${view.x} ${view.y} ${extent} ${extent}`}
        className="block aspect-square w-full touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        {/* Land: NCR a little lighter than its surroundings. */}
        <path d={base.boundary} fill="#F8F2E7" stroke="#9C7B63" strokeWidth={1.4} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        {/* Water over the offshore part of the boundary. */}
        <path d={base.sea} fill="#BCD4DC" />
        <path d={base.lakes} fill="#BCD4DC" />
        <path d={base.waterways} fill="none" stroke="#BCD4DC" strokeWidth={1.6 * grow} vectorEffect="non-scaling-stroke" />
        <path d={base.coast} fill="none" stroke="#8FB3C0" strokeWidth={1} vectorEffect="non-scaling-stroke" />

        <g data-testid="basemap-roads">
          {view.zoom >= 5 && road('tertiary', '#E4D8C4', 0.9)}
          {view.zoom >= 2.2 && road('secondary', '#FFFFFF', 1.3)}
          {road('primary', '#F2D28C', 1.9)}
          {road('trunk', '#E3A93E', 2.4)}
          {road('motorway', '#D68A2D', 2.8)}
        </g>

        {/* Rail track, one colour per line. */}
        <g data-testid="basemap-rail" opacity={result ? 0.45 : 1}>
          <path d={base.rail.other} fill="none" stroke="#8B7B74" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          {RAIL_LINES.map((railLine) => (
            <path key={railLine.id} d={base.rail[railLine.id]} fill="none" stroke={railLine.color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {/* Names. */}
        <g fill="#5A4A44" fontWeight={500} stroke="#F8F2E7" strokeWidth={3 * px} paintOrder="stroke" textAnchor="middle" pointerEvents="none">
          {base.places
            .filter((place) => (place.district ? view.zoom >= 5 : true))
            .map((place) => (
              <text key={place.name + place.x} x={place.x} y={place.y} fontSize={(place.district ? 9.5 : 11) * px} opacity={place.district ? 0.8 : 0.95}>
                {place.name}
              </text>
            ))}
          {showNames &&
            base.roadNames.map((road) => (
              <text key={road.name} x={road.x} y={road.y} fontSize={9.5 * px} fontWeight={500} fill="#7A5C20">
                {road.name}
              </text>
            ))}
        </g>

        {/* Whole pack network from its routes, faint, for context. */}
        {pack.routes.length > 0 && (
          <g opacity={result ? 0.28 : 0.75}>
            {pack.routes.map((route) => (
              <polyline key={route.id} points={line(route.stops.map((stop) => stop.landmarkId))} fill="none" stroke={MODES[route.mode].color} strokeWidth={3.5 * px} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </g>
        )}

        {/* Rail stations. */}
        {stations.map((station) => {
          const point = points.get(station.id)
          if (!point) return null
          const picked = station.id === originId || station.id === destinationId
          if (!picked && !visibleStations && view.zoom < 2.5) return null
          return (
            <g key={station.id} data-station={station.id}>
              <circle cx={point.x} cy={point.y} r={(picked ? 8 : visibleStations ? 5.5 : 3.6) * px} fill={station.id === originId ? '#28763A' : station.id === destinationId ? '#B3261E' : '#FFFFFF'} stroke={picked ? '#260D09' : railColor(station.id)} strokeWidth={(picked ? 2.5 : 2) * px} />
              {(picked || visibleStations) && (
                <text x={point.x + 9 * px} y={point.y + 3.5 * px} fontSize={(picked ? 12 : 10.5) * px} fontWeight={picked ? 700 : 500} fill="#260D09" stroke="#F8F2E7" strokeWidth={3 * px} paintOrder="stroke" pointerEvents="none">
                  {station.name.replace(/ \((LRT-1|LRT-2|MRT-3)\)$/, '')}
                </text>
              )}
            </g>
          )
        })}

        {/* Selected route (packs with routes), one coloured line per leg. */}
        {legs.map(({ leg, stops }, index) => (
          <polyline key={index} data-leg={leg.routeId} points={line(stops)} fill="none" stroke={MODES[leg.mode].color} strokeWidth={7 * px} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={leg.mode === 'walk' ? `${3 * px} ${12 * px}` : undefined} />
        ))}
        {result &&
          [...focusIds].map((id) => {
            const point = points.get(id)
            if (!point) return null
            const isOrigin = id === originId
            const isDestination = id === destinationId
            const isTransfer = transferIds.has(id)
            const major = isOrigin || isDestination || isTransfer
            const fill = isOrigin ? '#28763A' : isDestination ? '#B3261E' : '#FAF4ED'
            return (
              <g key={id} data-stop={id}>
                <circle cx={point.x} cy={point.y} r={(major ? 9 : 6) * px} fill={fill} stroke="#260D09" strokeWidth={2.5 * px} />
                <text x={point.x + 12 * px} y={point.y + 4 * px} fontSize={(major ? 13 : 11) * px} fontWeight={major ? 700 : 500} fill="#260D09" stroke="#F8F2E7" strokeWidth={3 * px} paintOrder="stroke">
                  {name(id)}
                </text>
              </g>
            )
          })}
      </svg>

      <p className="pointer-events-none absolute bottom-1 left-2 rounded bg-surface-cream/85 px-1.5 py-0.5 text-[10px] text-ink-muted">
        {MAP_ATTRIBUTION}
      </p>

      <div className="absolute right-2 bottom-2 flex flex-col gap-2">
        <button type="button" aria-label={copy.map.zoomIn} className={controlClass} onClick={() => zoomBy(1.5)}>
          <Icon name="plus" className="size-5" />
        </button>
        <button type="button" aria-label={copy.map.zoomOut} className={controlClass} onClick={() => zoomBy(1 / 1.5)}>
          <Icon name="minus" className="size-5" />
        </button>
        <button type="button" aria-label={copy.map.reset} className={controlClass} onClick={() => setView(HOME)}>
          <Icon name="target" className="size-5" />
        </button>
      </div>
    </div>
  )
}
