import { useSyncExternalStore } from 'react'
import { createSession, handleUtterance, recordReply, type TsupherReply } from '../ai/chat.ts'
import { LLM_SUMMARY_ENABLED, summarizeWithLlm } from '../ai/explain.ts'
import { getLlm, getModelState, peekModel } from '../ai/modelManager.ts'
import { getLastStats } from '../ai/runtime.ts'
import { copy } from '../copy'
import { planOptions, planRoute } from '../router/client.ts'
import { ensurePack, getPlan, setPlan } from './plan'

// Chat state. In memory only: closing or reloading the app forgets the conversation.

export interface DevInfo {
  lane: 'rules' | 'llm'
  latencyMs: number
  tokensPerSecond: number | null
}

export interface ChatMessage {
  id: number
  from: 'user' | 'tsupher'
  /** Lead sentence. For Tsupher it comes from copy, never from a model. */
  text: string
  reply?: TsupherReply
  /** Model-written summary. Present only after it passed the validator. */
  summary?: string
  dev?: DevInfo
}

export interface ChatState {
  messages: ChatMessage[]
  /** Tsupher is working: rules, router, or the model. */
  thinking: boolean
  /** Shown while thinking, e.g. when the model is being loaded from disk. */
  thinkingNote: string
  hasTrip: boolean
}

let nextId = 1
let toldModelFailed = false
const session = createSession()

let state: ChatState = {
  messages: [{ id: nextId++, from: 'tsupher', text: copy.home.intro }],
  thinking: false,
  thinkingNote: '',
  hasTrip: false,
}

const listeners = new Set<() => void>()

function set(patch: Partial<ChatState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export function useChat(): ChatState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

function leadText(reply: TsupherReply): string {
  switch (reply.message) {
    case 'noRoute': {
      const reason = reply.options.find((option) => option.status === 'no_route')?.reason
      return reason ? copy.reason[reason] : copy.results.emptyTitle
    }
    case 'answer':
      return ''
    default:
      return copy.chat[reply.message]
  }
}

function patchMessage(id: number, patch: Partial<ChatMessage>) {
  set({ messages: state.messages.map((message) => (message.id === id ? { ...message, ...patch } : message)) })
}

/** Sends one rider message through Understand, Plan and Explain. */
export async function sendMessage(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed || state.thinking) return
  set({
    messages: [...state.messages, { id: nextId++, from: 'user', text: trimmed }],
    thinking: true,
    thinkingNote: '',
  })

  const started = performance.now()
  try {
    await Promise.all([ensurePack(), peekModel()])
    const pack = getPlan().pack
    if (!pack) throw new Error('Route pack not loaded')
    const llm = getLlm()
    if (llm && getModelState().status === 'cached') set({ thinkingNote: copy.chat.wakingModel })

    const statsBefore = getLastStats()
    const reply = await handleUtterance(session, trimmed, {
      pack,
      router: { planOptions, planRoute },
      llm,
    })
    const stats = getLastStats()
    const usedModel = reply.lane === 'llm' && stats !== statsBefore

    const message: ChatMessage = {
      id: nextId++,
      from: 'tsupher',
      text: leadText(reply),
      reply,
      dev: {
        lane: reply.lane,
        latencyMs: performance.now() - started,
        tokensPerSecond: usedModel ? (stats?.tokensPerSecond ?? null) : null,
      },
    }
    recordReply(session, [message.text, ...reply.facts].join(' '))

    // Keep the Ruta and Mapa tabs in step with the conversation.
    if (reply.kind === 'options' || reply.kind === 'no_route') {
      setPlan({
        status: 'done',
        options: reply.options,
        chosenIndex: reply.chosenIndex,
        selectedIndex: 0,
        searched: reply.intent,
        originId: reply.intent?.originId ?? '',
        destinationId: reply.intent?.destinationId ?? '',
      })
    }
    // The model failed to load during this message: say so once, then carry on with rules.
    const modelJustFailed = llm !== undefined && getModelState().status === 'error' && !toldModelFailed
    if (modelJustFailed) toldModelFailed = true
    set({
      messages: [
        ...state.messages,
        ...(modelJustFailed ? [{ id: nextId++, from: 'tsupher' as const, text: copy.chat.modelFailed }] : []),
        message,
      ],
      thinking: false,
      thinkingNote: '',
      hasTrip: session.intent !== null,
    })

    // Optional friendlier summary from the on-device model. It appears only if
    // every number and name in it checks out against the RouteResult.
    const best = reply.kind === 'options' ? reply.options[Math.max(reply.chosenIndex, 0)] : null
    if (LLM_SUMMARY_ENABLED && best && llm && getModelState().status !== 'error') {
      set({ thinking: true, thinkingNote: '' })
      const summaryStarted = performance.now()
      const summary = await summarizeWithLlm(best, pack, llm)
      if (summary.text) {
        patchMessage(message.id, {
          summary: summary.text,
          dev: {
            lane: 'llm',
            latencyMs: performance.now() - summaryStarted,
            tokensPerSecond: getLastStats()?.tokensPerSecond ?? null,
          },
        })
      } else if (import.meta.env.DEV) {
        console.info('Model summary discarded, template kept:', summary.rejected)
      }
      set({ thinking: false })
    }
  } catch (error) {
    console.error('Chat failed', error)
    set({
      messages: [...state.messages, { id: nextId++, from: 'tsupher', text: copy.chat.error }],
      thinking: false,
      thinkingNote: '',
    })
  }
}
