import type { Intent, RoutePack, RouteResult } from './types.ts'

export type RouterRequest =
  | { id: number; type: 'setPack'; pack: RoutePack }
  | { id: number; type: 'planRoute'; intent: Intent }
  | { id: number; type: 'planOptions'; intent: Intent }

export type RouterResponse =
  | { id: number; ok: true; result: RouteResult | RouteResult[] | null }
  | { id: number; ok: false; error: string }
