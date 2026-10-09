import { useState, type FormEvent } from 'react'
import { copy } from '../copy'
import { ISSUES, NOTE_MAX, type ContributionPayload, type Issue } from '../lib/contributions'
import { addContribution } from '../state/contributions'
import { BottomSheet } from './BottomSheet'
import { Button } from './Button'

interface ReportSheetProps {
  open: boolean
  onClose: () => void
  /** Everything about the route except what the rider types. */
  context: Omit<ContributionPayload, 'uid' | 'issue' | 'note'>
}

/** "May mali ba?": what is wrong, an optional note, saved on this device only. */
export function ReportSheet({ open, onClose, context }: ReportSheetProps) {
  const [issue, setIssue] = useState<Issue | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'form' | 'saved' | 'error'>('form')

  function close() {
    setIssue(null)
    setNote('')
    setState('form')
    onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!issue) return
    try {
      await addContribution({ ...context, issue, note: note.trim() })
      setState('saved')
    } catch (error) {
      console.error('Report not saved', error)
      setState('error')
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title={copy.report.title}>
      {state === 'saved' ? (
        <div data-testid="report-saved">
          <p className="mt-2 font-semibold">{copy.report.savedTitle}</p>
          <p className="mt-1 text-sm text-ink-muted">{copy.report.savedBody}</p>
          <Button variant="dark" className="mt-4 w-full" onClick={close}>
            {copy.report.close}
          </Button>
        </div>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="max-h-[70dvh] overflow-y-auto">
          <p className="mt-1 text-sm text-ink-muted">{copy.report.intro}</p>
          <fieldset className="mt-3 min-w-0">
            <legend className="text-sm font-semibold">{copy.report.issueLabel}</legend>
            <div className="mt-1 flex flex-col gap-1.5">
              {ISSUES.map((value) => (
                <label key={value} className="flex min-h-11 items-center gap-3 rounded-2xl border border-line px-3">
                  <input
                    type="radio"
                    name="issue"
                    value={value}
                    data-testid={`report-issue-${value}`}
                    checked={issue === value}
                    onChange={() => setIssue(value)}
                    className="size-5 accent-brown-mid"
                  />
                  {copy.report.issues[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 block text-sm font-semibold">
            {copy.report.noteLabel}
            <textarea
              data-testid="report-note"
              value={note}
              maxLength={NOTE_MAX}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
              placeholder={copy.report.notePlaceholder}
              className="mt-1 w-full rounded-2xl border border-line bg-white/60 p-3 text-base font-normal outline-none placeholder:text-ink-muted focus:border-brown-mid"
            />
            <span className="block text-right text-xs font-normal text-ink-muted tabular-nums">
              {copy.report.noteCount(note.length, NOTE_MAX)}
            </span>
          </label>
          {state === 'error' && (
            <p role="alert" className="mt-2 text-sm font-semibold">
              {copy.report.error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="dark" className="flex-1" onClick={close}>
              {copy.report.cancel}
            </Button>
            <Button type="submit" data-testid="report-submit" className="flex-1" disabled={!issue}>
              {copy.report.submit}
            </Button>
          </div>
        </form>
      )}
    </BottomSheet>
  )
}
