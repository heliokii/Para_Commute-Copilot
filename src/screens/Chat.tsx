import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { TsupherReply } from '../ai/chat.ts'
import { Badge } from '../components/Badge'
import { Bubble } from '../components/Bubble'
import { Chip } from '../components/Chip'
import { Icon } from '../components/Icon'
import { StatusPill } from '../components/StatusPill'
import { Tsupher } from '../components/Tsupher'
import { VoiceButton } from '../components/VoiceButton'
import { copy } from '../copy'
import { duration, peso } from '../lib/format'
import { MODES } from '../lib/modes'
import { go, OVERLAY_PATHS, TAB_PATHS } from '../lib/nav'
import type { RouteResult } from '../router/types.ts'
import { sendMessage, useChat, type ChatMessage } from '../state/chat'
import { ensurePack, setPlan, usePlan } from '../state/plan'

function OptionCard({ result, number, index, chosen }: { result: RouteResult; number: number; index: number; chosen: boolean }) {
  const rides = result.legs.filter((leg) => leg.mode !== 'walk').length
  return (
    <button
      type="button"
      data-testid="chat-option"
      onClick={() => {
        setPlan({ selectedIndex: index, detailBack: OVERLAY_PATHS.chat })
        go(OVERLAY_PATHS.detail)
      }}
      className="flex w-full items-start gap-2.5 rounded-2xl border border-line bg-white/50 p-3 text-left"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brown-mid text-sm font-semibold text-surface-cream">
        {number}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold">{copy.pref[result.preference]}</span>
          {chosen && <Badge tone="strong">{copy.badge.chosen}</Badge>}
          {result.simulated && <Badge tone="caution">{copy.badge.simulated}</Badge>}
          {result.usedUnverifiedData && <Badge tone="caution">{copy.badge.unverified}</Badge>}
        </span>
        <span className="mt-0.5 block text-sm">
          {result.legs.map((leg) => MODES[leg.mode].label).join(' → ')}
        </span>
        <span className="mt-0.5 block text-sm text-ink-muted tabular-nums">
          <span data-testid="chat-option-fare" className="font-semibold text-ink-dark">
            {peso(result.totalFare)}
          </span>{' '}
          · {duration(result.totalMinutes)} ·{' '}
          {rides === 0 ? copy.results.walkOnly : copy.results.rides(rides)}
          {result.fareAsOf && ` · ${copy.results.asOf(result.fareAsOf)}`}
        </span>
      </span>
      <Icon name="chevron-right" className="mt-1 size-4 shrink-0 text-ink-muted" />
    </button>
  )
}

/** Reveals already-validated text a few words at a time. Cosmetic: the text is final before it shows. */
function Reveal({ text }: { text: string }) {
  const words = text.split(' ')
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [shown, setShown] = useState(reduced ? words.length : 0)

  useEffect(() => {
    if (shown >= words.length) return
    const timer = setTimeout(() => setShown((count) => count + 2), 60)
    return () => clearTimeout(timer)
  }, [shown, words.length])

  return (
    <span>
      <span aria-hidden="true">{words.slice(0, shown).join(' ')}</span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

function ReplyBody({ reply, onPick }: { reply: TsupherReply; onPick: (text: string) => void }) {
  const found = reply.options.filter((option) => option.status === 'ok')
  return (
    <>
      {reply.simulated && reply.kind === 'options' && reply.message !== 'whatIf' && (
        <p className="mt-1 text-xs text-ink-muted">{copy.results.simulatedNote}</p>
      )}
      {reply.kind === 'answer' && (
        <ul className="space-y-1.5">
          {reply.facts.map((fact, index) => (
            <li key={index}>{reply.facts.length > 1 ? `${index + 1}. ${fact}` : fact}</li>
          ))}
        </ul>
      )}
      {reply.kind === 'options' && (
        <div className="mt-2 flex flex-col gap-2">
          {found.map((result, index) => (
            <OptionCard
              key={index}
              result={result}
              number={index + 1}
              index={reply.options.indexOf(result)}
              chosen={reply.options.indexOf(result) === reply.chosenIndex}
            />
          ))}
        </div>
      )}
      {reply.kind === 'no_route' && reply.simulated && (
        <p className="mt-1.5">
          <Badge tone="caution">{copy.badge.simulated}</Badge>
        </p>
      )}
      {reply.candidates?.map((candidate) => (
        <div key={candidate.field} className="mt-2 flex flex-wrap gap-2">
          {candidate.options.map((option) => (
            <Chip
              key={option.id}
              onClick={() =>
                onPick(candidate.field === 'origin' ? copy.chat.pickOrigin(option.name) : copy.chat.pickDestination(option.name))
              }
            >
              {option.name}
            </Chip>
          ))}
        </div>
      ))}
    </>
  )
}

function TsupherMessage({ message, onPick }: { message: ChatMessage; onPick: (text: string) => void }) {
  const kind = message.reply?.kind
  const confused = kind === 'unsupported' || kind === 'no_route'
  return (
    <div className="flex items-end gap-2">
      <Tsupher
        state={confused ? 'confused' : kind === 'options' ? 'thumbs-up' : 'happy'}
        size="sm"
        decorative={!confused}
      />
      <div className="min-w-0 flex-1">
        <Bubble from="tsupher" wide={kind === 'options'}>
          <div data-testid="tsupher-message" data-kind={kind ?? 'text'}>
            {message.text && <p>{message.text}</p>}
            {message.reply && <ReplyBody reply={message.reply} onPick={onPick} />}
            {message.summary && (
              <p data-testid="llm-summary" className="mt-2 border-t border-line pt-2 text-sm">
                <Reveal text={message.summary} />
              </p>
            )}
          </div>
        </Bubble>
        {import.meta.env.DEV && message.dev && (
          <p className="mt-0.5 pl-2 text-[0.65rem] text-on-deep/70 tabular-nums">
            {message.dev.lane} · {Math.round(message.dev.latencyMs)} ms
            {message.dev.tokensPerSecond ? ` · ${message.dev.tokensPerSecond.toFixed(0)} tok/s` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

export function Chat() {
  const chat = useChat()
  const plan = usePlan()
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void ensurePack()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [chat.messages, chat.thinking])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const text = draft
    setDraft('')
    void sendMessage(text)
  }

  // Quick replies come from what the pack can actually act on.
  const tags = [...new Set(plan.pack?.routes.flatMap((route) => route.tags) ?? [])]
  const quickReplies = chat.hasTrip
    ? [copy.chat.quickCheaper, ...tags.map((tag) => copy.chat.quickAvoid(tag)), copy.chat.quickFewer]
    : []

  return (
    <div className="backdrop flex h-dvh flex-col xl:h-full">
      <header className="flex min-h-16 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <a
          href={`#${TAB_PATHS.home}`}
          aria-label={copy.nav.back}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <Icon name="back" />
        </a>
        <Tsupher state="happy" size="sm" eager decorative />
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="font-display text-xl font-semibold">{copy.app.mascot}</h1>
          <p className="text-xs text-on-deep/85">{copy.chat.subtitle}</p>
        </div>
        <StatusPill />
      </header>

      <div
        role="log"
        aria-live="polite"
        aria-label={copy.chat.logLabel}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
      >
        {plan.pack?.note && (
          <p className="self-center">
            <Badge>{copy.app.sampleData}</Badge>
          </p>
        )}
        {chat.messages.map((message) =>
          message.from === 'user' ? (
            <Bubble key={message.id} from="user">
              {message.text}
            </Bubble>
          ) : (
            <TsupherMessage key={message.id} message={message} onPick={(text) => void sendMessage(text)} />
          ),
        )}
        {chat.thinking && (
          <div data-testid="typing" className="flex items-end gap-2">
            <Tsupher state="thinking" size="sm" bob />
            <Bubble from="tsupher">
              <span className="flex items-center gap-1.5">
                <span className="sr-only">{copy.chat.thinking}</span>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    aria-hidden="true"
                    className="size-2 animate-pulse rounded-full bg-ink-muted motion-reduce:animate-none"
                    style={{ animationDelay: `${dot * 180}ms` }}
                  />
                ))}
                {chat.thinkingNote && <span className="ml-1 text-sm text-ink-muted">{chat.thinkingNote}</span>}
              </span>
            </Bubble>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {quickReplies.length > 0 && (
        <div className="surface flex gap-2 overflow-x-auto px-3 pb-2">
          {quickReplies.map((text) => (
            <Chip key={text} disabled={chat.thinking} className="shrink-0" onClick={() => void sendMessage(text)}>
              {text}
            </Chip>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="surface flex items-center gap-2 rounded-t-card bg-surface-cream px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-ink-dark"
      >
        <label htmlFor="chat-input" className="sr-only">
          {copy.home.promptLabel}
        </label>
        <input
          id="chat-input"
          data-testid="chat-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.chat.placeholder}
          autoComplete="off"
          enterKeyHint="send"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-white/60 px-4 text-base outline-none placeholder:text-ink-muted focus:border-brown-mid"
        />
        <VoiceButton disabled={chat.thinking} onText={(text) => void sendMessage(text)} />
        <button
          type="submit"
          aria-label={copy.chat.send}
          disabled={chat.thinking || !draft.trim()}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brown-mid text-surface-cream disabled:opacity-50"
        >
          <Icon name="send" />
        </button>
      </form>
    </div>
  )
}
