import { useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { copy } from '../copy'
import { MODES } from '../lib/modes'
import type { Landmark, RoutePack, RouteResult } from '../router/types.ts'
import { WALK_ROUTE_ID } from '../router/types.ts'
import { Icon } from './Icon'

// Schematic map drawn from the route pack only. No tiles, no network.

const SIZE = 1000
const PAD = 170
const MIN_ZOOM = 1
const MAX_ZOOM = 6

interface Point {
  x: number
  y: number
}

interface View {
  zoom: number
  x: number
  y: number
}

const HOME: View = { zoom: 1, x: 0, y: 0 }

/** Stops a leg rides through, board to alight inclusive. */
function legStops(pack: RoutePack, leg: RouteResult['legs'][number]): string[] {
  if (leg.routeId === WALK_ROUTE_ID) return [leg.boardId, leg.alightId]
  const stops = pack.routes.find((route) => route.id === leg.routeId)?.stops ?? []
  const from = stops.findIndex((stop) => stop.landmarkId === leg.boardId)
  const to = stops.findIndex((stop, index) => index > from && stop.landmarkId === leg.alightId)
  if (from < 0 || to < 0) return [leg.boardId, leg.alightId]
  return stops.slice(from, to + 1).map((stop) => stop.landmarkId)
}

function clampView(view: View): View {
  const zoom = Math.min(Math.max(view.zoom, MIN_ZOOM), MAX_ZOOM)
  const limit = SIZE - SIZE / zoom
  return {
    zoom,
    x: Math.min(Math.max(view.x, 0), limit),
    y: Math.min(Math.max(view.y, 0), limit),
  }
}

interface RouteMapProps {
  pack: RoutePack
  /** Selected route. Without one, the whole network is shown. */
  result: RouteResult | null
}

export function RouteMap({ pack, result }: RouteMapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const [view, setView] = useState<View>(HOME)

  const { points, legs, focusIds } = useMemo(() => {
    const legPaths = (result?.legs ?? []).map((leg) => ({ leg, stops: legStops(pack, leg) }))
    const focus = new Set(legPaths.flatMap((path) => path.stops))
    // Fit to the selected route, or to everything when nothing is selected.
    const fit: Landmark[] =
      focus.size > 0 ? pack.landmarks.filter((landmark) => focus.has(landmark.id)) : pack.landmarks

    const midLat = fit.reduce((sum, landmark) => sum + landmark.lat, 0) / Math.max(fit.length, 1)
    const scaleLon = Math.cos((midLat * Math.PI) / 180)
    const raw = (landmark: Landmark) => ({ x: landmark.lon * scaleLon, y: -landmark.lat })
    const xs = fit.map((landmark) => raw(landmark).x)
    const ys = fit.map((landmark) => raw(landmark).y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1
    const scale = (SIZE - 2 * PAD) / span
    const offsetX = (SIZE - (Math.max(...xs) - minX) * scale) / 2
    const offsetY = (SIZE - (Math.max(...ys) - minY) * scale) / 2

    const projected = new Map<string, Point>()
    for (const landmark of pack.landmarks) {
      const point = raw(landmark)
      projected.set(landmark.id, {
        x: (point.x - minX) * scale + offsetX,
        y: (point.y - minY) * scale + offsetY,
      })
    }
    return { points: projected, legs: legPaths, focusIds: focus }
  }, [pack, result])

  const line = (ids: string[]) =>
    ids
      .map((id) => points.get(id))
      .filter((point): point is Point => Boolean(point))
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' ')

  const name = (id: string) => pack.landmarks.find((landmark) => landmark.id === id)?.name ?? id
  const originId = result?.legs[0]?.boardId
  const destinationId = result?.legs.at(-1)?.alightId
  const transferIds = new Set(result?.legs.slice(1).map((leg) => leg.boardId) ?? [])

  function zoomBy(factor: number, center: Point = { x: 0.5, y: 0.5 }) {
    setView((current) => {
      const zoom = Math.min(Math.max(current.zoom * factor, MIN_ZOOM), MAX_ZOOM)
      const before = SIZE / current.zoom
      const after = SIZE / zoom
      return clampView({
        zoom,
        x: current.x + (before - after) * center.x,
        y: current.y + (before - after) * center.y,
      })
    })
  }

  const unitsPerPixel = () => SIZE / view.zoom / (svgRef.current?.clientWidth || SIZE)

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
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
    pointers.current.delete(event.pointerId)
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    zoomBy(event.deltaY < 0 ? 1.2 : 1 / 1.2, {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    })
  }

  const extent = SIZE / view.zoom
  // Keep strokes and labels the same on-screen size at every zoom level.
  const k = 1 / view.zoom
  const controlClass =
    'flex size-11 items-center justify-center rounded-full bg-surface-cream text-ink-dark shadow-card'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[#F1E9DC]">
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
        {/* Whole network, faint, for context. */}
        <g opacity={result ? 0.28 : 0.75}>
          {pack.routes.map((route) => (
            <polyline
              key={route.id}
              points={line(route.stops.map((stop) => stop.landmarkId))}
              fill="none"
              stroke={MODES[route.mode].color}
              strokeWidth={5 * k}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {pack.landmarks.map((landmark) => {
            const point = points.get(landmark.id)!
            return (
              <g key={landmark.id}>
                <circle cx={point.x} cy={point.y} r={7 * k} fill="#FAF4ED" stroke="#76655F" strokeWidth={2.5 * k} />
                {!result && (
                  <text x={point.x + 14 * k} y={point.y + 6 * k} fontSize={22 * k} fill="#260D09">
                    {landmark.name}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* Selected route, one coloured line per leg. */}
        {legs.map(({ leg, stops }, index) => (
          <polyline
            key={index}
            data-leg={leg.routeId}
            points={line(stops)}
            fill="none"
            stroke={MODES[leg.mode].color}
            strokeWidth={11 * k}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={leg.mode === 'walk' ? `${4 * k} ${18 * k}` : undefined}
          />
        ))}

        {[...focusIds].map((id, index) => {
          const point = points.get(id)
          if (!point) return null
          const isOrigin = id === originId
          const isDestination = id === destinationId
          const isTransfer = transferIds.has(id)
          const major = isOrigin || isDestination || isTransfer
          const fill = isOrigin ? '#28763A' : isDestination ? '#B3261E' : '#FAF4ED'
          const tag = isOrigin
            ? copy.map.origin
            : isDestination
              ? copy.map.destination
              : isTransfer
                ? copy.map.transfer
                : ''
          // Labels alternate below and above the line so neighbours do not collide,
          // and hug the inside edge near the left and right borders.
          const below = index % 2 === 0
          const anchor = point.x < 220 ? 'start' : point.x > SIZE - 220 ? 'end' : 'middle'
          const labelX = anchor === 'start' ? point.x - 14 * k : anchor === 'end' ? point.x + 14 * k : point.x
          const fontSize = (major ? 27 : 22) * k
          const labelY = below ? point.y + 24 * k + fontSize : point.y - 24 * k - (tag ? 24 * k : 0)
          return (
            <g key={id} data-stop={id}>
              <circle
                cx={point.x}
                cy={point.y}
                r={(major ? 15 : 9) * k}
                fill={fill}
                stroke="#260D09"
                strokeWidth={(major ? 4 : 3) * k}
              />
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fontSize={fontSize}
                fontWeight={major ? 700 : 500}
                fill="#260D09"
                stroke="#F1E9DC"
                strokeWidth={6 * k}
                paintOrder="stroke"
              >
                {name(id)}
                {tag && (
                  <tspan x={labelX} dy={24 * k} fontSize={20 * k} fontWeight={500}>
                    {tag}
                  </tspan>
                )}
              </text>
            </g>
          )
        })}
      </svg>

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
