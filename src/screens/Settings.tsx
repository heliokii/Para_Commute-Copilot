import { useRef, useState } from 'react'
import { Badge } from '../components/Badge'
import { BottomSheet } from '../components/BottomSheet'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Chip } from '../components/Chip'
import { Icon } from '../components/Icon'
import { TopBar } from '../components/TopBar'
import { copy } from '../copy'
import { backHref } from '../lib/nav'
import { exportContributions, importContributions, saveFile, useContributions } from '../state/contributions'
import { eraseAllData, resetSession } from '../state/session'
import { updateSetting, useSettings } from '../state/settings'

const IMPORT_MAX_BYTES = 1024 * 1024

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Choice<T extends string>({ label, value, options, onChange, testId }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; testId: string }) {
  return (
    <div role="group" aria-label={label} className="px-4 py-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option.value} selected={value === option.value} data-testid={`${testId}-${option.value}`} onClick={() => void onChange(option.value)}>
            {option.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function Settings() {
  const settings = useSettings()
  const contributions = useContributions()
  const [sessionDone, setSessionDone] = useState(false)
  // A new key each time, so the message is announced again even when its words are the same.
  const [note, setNote] = useState({ id: 0, text: '' })
  const message = note.text
  const setMessage = (text: string) => setNote((previous) => ({ id: previous.id + 1, text }))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [withModels, setWithModels] = useState(false)
  const [erased, setErased] = useState<'' | 'done' | 'failed'>('')
  const fileInput = useRef<HTMLInputElement>(null)

  const reports = contributions.filter((row) => row.type === 'route_issue')
  const queued = reports.filter((row) => row.status === 'queued').length

  async function exportAs(format: 'json' | 'csv') {
    const file = await exportContributions(format)
    if (file.count === 0) {
      setMessage(copy.settings.nothingToExport)
      return
    }
    saveFile(file)
    setMessage(copy.settings.exported(file.count, file.filename))
  }

  async function importFile(file: File | undefined) {
    if (!file) return
    if (file.size > IMPORT_MAX_BYTES) {
      setMessage(copy.settings.importErrors.tooBig)
      return
    }
    try {
      const summary = await importContributions(await file.text())
      setMessage(summary.error ? copy.settings.importErrors[summary.error] : copy.settings.imported(summary.added, summary.duplicates, summary.skipped))
    } catch (error) {
      console.error('Import failed', error)
      setMessage(copy.settings.importErrors.read)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  async function erase() {
    try {
      await eraseAllData({ models: withModels })
      setErased('done')
      setMessage('')
      setSessionDone(false)
    } catch (error) {
      console.error('Erase failed', error)
      setErased('failed')
    }
    setConfirmOpen(false)
    setWithModels(false)
  }

  return (
    <div className="backdrop min-h-dvh xl:min-h-full pb-10">
      <TopBar title={copy.settings.title} backHref={backHref()} />
      <div className="flex flex-col gap-5 px-4 pt-2">
        <p className="px-1 text-sm text-on-deep/90">{copy.settings.storage}</p>

        <Section title={copy.settings.language.label}>
          <Card aria-disabled="true" data-testid="settings-language" className="flex min-h-14 items-center gap-3 px-4 py-2">
            <Icon name="globe" className="size-5.5 shrink-0 text-brown-mid" />
            <span className="min-w-0 flex-1 text-sm text-ink-muted">{copy.settings.language.value}</span>
            <Badge>{copy.settings.language.badge}</Badge>
          </Card>
        </Section>

        <Section title={copy.settings.unitsTitle}>
          <Card className="divide-y divide-line">
            <Choice
              label={copy.settings.time}
              testId="setting-time"
              value={settings.timeStyle}
              options={[
                { value: 'hm', label: copy.settings.timeHm },
                { value: 'min', label: copy.settings.timeMin },
              ]}
              onChange={(value) => updateSetting('timeStyle', value)}
            />
            <Choice
              label={copy.settings.distance}
              testId="setting-distance"
              value={settings.distanceUnit}
              options={[
                { value: 'km', label: copy.settings.distanceKm },
                { value: 'mi', label: copy.settings.distanceMi },
              ]}
              onChange={(value) => updateSetting('distanceUnit', value)}
            />
          </Card>
          <p className="px-1 text-xs text-on-deep/80">{copy.settings.unitsNote}</p>
        </Section>

        <Section title={copy.settings.sessionTitle}>
          <Card className="p-4">
            <p className="text-sm text-ink-muted">{copy.settings.sessionBody}</p>
            <Button
              variant="dark"
              data-testid="reset-session"
              className="mt-3"
              onClick={() => {
                resetSession()
                setSessionDone(true)
              }}
            >
              {copy.settings.sessionButton}
            </Button>
            {sessionDone && (
              <p role="status" data-testid="session-done" className="mt-2 text-sm font-semibold">
                {copy.settings.sessionDone}
              </p>
            )}
          </Card>
        </Section>

        <Section title={copy.settings.contribTitle}>
          <Card className="p-4">
            <p className="text-sm text-ink-muted">{copy.settings.contribBody}</p>
            <p data-testid="contrib-count" className="mt-2 text-sm font-semibold tabular-nums">
              {copy.settings.contribCount(queued, reports.length)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="dark" data-testid="export-json" onClick={() => void exportAs('json')}>
                {copy.settings.exportJson}
              </Button>
              <Button variant="dark" data-testid="export-csv" onClick={() => void exportAs('csv')}>
                {copy.settings.exportCsv}
              </Button>
            </div>
            <label className="mt-3 block text-sm font-semibold">
              {copy.settings.importLabel}
              <input
                ref={fileInput}
                type="file"
                accept=".json,.csv,application/json,text/csv"
                data-testid="import-file"
                onChange={(event) => void importFile(event.target.files?.[0])}
                className="mt-1 block min-h-11 w-full text-sm font-normal"
              />
            </label>
            {message && (
              <p key={note.id} role="status" data-testid="contrib-message" className="mt-2 text-sm font-semibold">
                {message}
              </p>
            )}
          </Card>
        </Section>

        <Section title={copy.settings.dangerTitle}>
          <Card className="p-4">
            <p className="text-sm text-ink-muted">{copy.settings.dangerBody}</p>
            <Button variant="dark" data-testid="erase-open" className="mt-3" onClick={() => setConfirmOpen(true)}>
              {copy.settings.dangerButton}
            </Button>
            {erased && (
              <p role="status" data-testid="erase-result" className="mt-2 text-sm font-semibold">
                {erased === 'done' ? copy.settings.erased : copy.settings.eraseFailed}
              </p>
            )}
          </Card>
        </Section>
      </div>

      <BottomSheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title={copy.settings.confirmTitle}>
        <div data-testid="erase-confirm">
          <p className="mt-2 text-sm font-semibold">{copy.settings.dangerBody}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {copy.settings.confirmList.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-muted">{copy.settings.confirmKeeps}</p>
          <label className="mt-3 flex min-h-11 items-start gap-3 rounded-2xl border border-line p-3 text-sm">
            <input type="checkbox" data-testid="erase-models" checked={withModels} onChange={(event) => setWithModels(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-brown-mid" />
            {copy.settings.confirmModels}
          </label>
          <div className="mt-4 flex gap-2">
            <Button variant="dark" data-testid="erase-cancel" className="flex-1" onClick={() => setConfirmOpen(false)}>
              {copy.settings.confirmNo}
            </Button>
            <Button data-testid="erase-confirm-yes" className="flex-1" onClick={() => void erase()}>
              {copy.settings.confirmYes}
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
