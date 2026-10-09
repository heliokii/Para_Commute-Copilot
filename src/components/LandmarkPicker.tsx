import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { copy } from '../copy'
import { searchLandmarks } from '../match/fuzzy.ts'
import type { Landmark } from '../router/types.ts'

interface LandmarkPickerProps {
  label: string
  landmarks: Landmark[]
  /** Selected landmark id, or '' when nothing is chosen. */
  value: string
  onChange: (id: string) => void
  /** Stable hook for end-to-end tests. */
  testId: string
}

/** Combobox with fuzzy autocomplete over landmark names and aliases. */
export function LandmarkPicker({ label, landmarks, value, onChange, testId }: LandmarkPickerProps) {
  const inputId = useId()
  const listId = useId()
  const selected = landmarks.find((landmark) => landmark.id === value)
  // null means "show the selected landmark's name".
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const text = draft ?? selected?.name ?? ''
  const suggestions = useMemo(() => {
    const query = draft?.trim() ?? ''
    if (!query) {
      return [...landmarks]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((landmark) => ({ landmark, matchedOn: landmark.name }))
    }
    return searchLandmarks(query, landmarks, 8)
  }, [draft, landmarks])

  function choose(landmark: Landmark) {
    onChange(landmark.id)
    setDraft(null)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (index + step + suggestions.length) % Math.max(suggestions.length, 1))
    } else if (event.key === 'Enter' && open && suggestions[active]) {
      event.preventDefault()
      choose(suggestions[active].landmark)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setDraft(null)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={inputId}
        data-testid={testId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={text}
        placeholder={copy.plan.pickerPlaceholder}
        onFocus={(event) => {
          // Typing over a previous choice should replace it, not edit it.
          event.currentTarget.select()
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => {
          // Typed text that was never picked is dropped; the last choice stays.
          setDraft(null)
          setOpen(false)
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          setOpen(true)
          setActive(0)
          if (value) onChange('')
        }}
        onKeyDown={handleKeyDown}
        className="mt-1 min-h-12 w-full rounded-2xl border border-line bg-white/60 px-4 text-base outline-none placeholder:text-ink-muted focus:border-brown-mid"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface-cream py-1 shadow-card"
        >
          {suggestions.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink-muted">{copy.plan.pickerEmpty}</li>
          )}
          {suggestions.map(({ landmark, matchedOn }, index) => (
            <li
              key={landmark.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown fires before the input's blur, so the choice is not lost.
              onMouseDown={(event) => {
                event.preventDefault()
                choose(landmark)
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex min-h-11 cursor-pointer flex-col justify-center px-4 py-1.5 ${index === active ? 'bg-surface-warm' : ''}`}
            >
              <span className="font-medium">{landmark.name}</span>
              {matchedOn !== landmark.name && (
                <span className="text-xs text-ink-muted">
                  {copy.plan.pickerAlias} “{matchedOn}”
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
