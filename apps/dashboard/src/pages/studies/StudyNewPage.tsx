import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { CheckIcon } from '../../components/icons'
import {
  InfoIcon,
  LightbulbIcon,
  PencilIcon,
  UploadIcon,
} from '../../components/studies/StudyIcons'
import {
  formatDate,
  studiesErrorMessage,
  useCreateStudy,
  useStartStudy,
  type Study,
} from '../../api/studies'
import { t } from '../../i18n/studies'
import '../../styles/studies.css'

type ConsentState = {
  text: string
  fileName: string
  editing: boolean
}

type CalendarStyleId = 'fixed' | 'balanced' | 'varied'
type CalendarStyle = { id: CalendarStyleId; dots: { x: number; y: number }[] }

const emptyConsent: ConsentState = { text: '', fileName: '', editing: false }

const calendarStyles: CalendarStyle[] = [
  {
    id: 'fixed',
    dots: [22, 60, 98].flatMap((x) => [9, 20, 31].map((y) => ({ x, y }))),
  },
  {
    id: 'balanced',
    dots: [
      ...[22, 60, 98].map((x) => ({ x, y: 9 })),
      ...[28, 66, 94].map((x) => ({ x, y: 20 })),
    ],
  },
  {
    id: 'varied',
    dots: [
      ...[22, 60, 98].map((x) => ({ x, y: 9 })),
      ...[40, 84, 112].map((x) => ({ x, y: 20 })),
      ...[16, 52, 104].map((x) => ({ x, y: 31 })),
    ],
  },
]

const timezones = ['Europe/Lisbon']

const styleKeys: Record<
  CalendarStyleId,
  { name: 'new.style.fixed.name' | 'new.style.balanced.name' | 'new.style.varied.name'; description: 'new.style.fixed.description' | 'new.style.balanced.description' | 'new.style.varied.description' }
> = {
  fixed: { name: 'new.style.fixed.name', description: 'new.style.fixed.description' },
  balanced: { name: 'new.style.balanced.name', description: 'new.style.balanced.description' },
  varied: { name: 'new.style.varied.name', description: 'new.style.varied.description' },
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function SectionHeading({
  id,
  step,
  title,
  hint,
}: {
  id: string
  step: number
  title: string
  hint?: string
}) {
  return (
    <div className="st-section-heading">
      <span className="st-step" aria-hidden="true">
        {step}
      </span>
      <div className="st-section-heading-copy">
        <h2 className="h2" id={id}>
          {title}
        </h2>
        {hint ? <p className="st-section-hint">{hint}</p> : null}
      </div>
    </div>
  )
}

function Counter({
  id,
  label,
  help,
  value,
  onChange,
}: {
  id: string
  label: string
  help: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="st-field">
      <label htmlFor={id}>{label}</label>
      <div className="st-counter">
        <button
          type="button"
          className="st-counter-btn"
          aria-label={t('new.counter.decrease')}
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          −
        </button>
        <input
          id={id}
          className="st-counter-input"
          type="number"
          min={1}
          max={12}
          value={value}
          onChange={(event) => {
            const next = Number.parseInt(event.target.value, 10)
            onChange(Number.isNaN(next) ? 1 : Math.min(12, Math.max(1, next)))
          }}
        />
        <button
          type="button"
          className="st-counter-btn"
          aria-label={t('new.counter.increase')}
          onClick={() => onChange(Math.min(12, value + 1))}
        >
          +
        </button>
      </div>
      <span className="st-field-help">{help}</span>
    </div>
  )
}

function StylePreview({ style }: { style: CalendarStyle }) {
  return (
    <svg
      className="st-style-preview"
      viewBox="0 0 132 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect width="132" height="40" rx="6" fill="#F4F6FB" />
      {style.dots.map((dot) => (
        <circle key={`${dot.x}-${dot.y}`} cx={dot.x} cy={dot.y} r="3.4" fill="#2F5BEA" />
      ))}
    </svg>
  )
}

function ConsentCard({
  language,
  title,
  hint,
  required,
  value,
  onChange,
}: {
  language: 'pt' | 'en'
  title: string
  hint: string
  required: boolean
  value: ConsentState
  onChange: (next: ConsentState) => void
}) {
  const hasContent = value.text.trim().length > 0 || value.fileName.length > 0

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      onChange({ ...value, fileName: file.name, editing: false })
    }
    event.target.value = ''
  }

  return (
    <div className="st-consent-card">
      <div className="st-consent-head">
        <span className="st-consent-language">{title}</span>
        <span className={required ? 'st-mini-tag st-mini-tag-required' : 'st-mini-tag'}>
          {required ? t('new.consent.required') : t('new.consent.optional')}
        </span>
      </div>

      {hasContent ? (
        <div className="st-consent-filled">
          {value.fileName ? (
            <span className="st-consent-file mono">{t('new.consent.file', { name: value.fileName })}</span>
          ) : (
            <span className="st-consent-text">{value.text}</span>
          )}
          <button
            type="button"
            className="st-link-button"
            onClick={() => onChange(emptyConsent)}
          >
            {t('new.consent.remove')}
          </button>
        </div>
      ) : (
        <div className="st-consent-empty">
          <span className="st-consent-empty-title">{t('new.consent.emptyTitle')}</span>
          <span className="st-consent-empty-hint">{hint}</span>
        </div>
      )}

      {value.editing ? (
        <textarea
          className="st-textarea st-consent-textarea"
          rows={5}
          autoFocus
          placeholder={t('new.consent.textPlaceholder')}
          value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
        />
      ) : null}

      <div className="st-consent-actions">
        <label className="st-btn st-btn-ghost st-btn-sm" htmlFor={`consent-file-${language}`}>
          <UploadIcon />
          {t('new.consent.upload')}
        </label>
        <input
          id={`consent-file-${language}`}
          type="file"
          className="st-visually-hidden"
          accept=".txt,.pdf,.doc,.docx"
          onChange={handleFile}
        />
        <button
          type="button"
          className="st-btn st-btn-ghost st-btn-sm"
          aria-expanded={value.editing}
          onClick={() => onChange({ ...value, editing: !value.editing })}
        >
          <PencilIcon />
          {t('new.consent.write')}
        </button>
      </div>
    </div>
  )
}

function ChecklistItem({
  done,
  title,
  detail,
}: {
  done: boolean
  title: string
  detail: string
}) {
  return (
    <li className="st-checklist-item">
      <span className={done ? 'st-check-icon st-check-icon-done' : 'st-check-icon st-check-icon-todo'}>
        {done ? <CheckIcon width={14} height={14} /> : <strong>!</strong>}
      </span>
      <span className="st-checklist-copy">
        <span className="st-checklist-title">{title}</span>
        <span className="st-checklist-detail">{detail}</span>
      </span>
    </li>
  )
}

export default function StudyNewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [start, setStart] = useState(todayIso())
  const [end, setEnd] = useState(addDaysIso(todayIso(), 13))
  const [timezone, setTimezone] = useState('Europe/Lisbon')
  const [calendarStyle, setCalendarStyle] = useState<CalendarStyleId>('varied')
  const [maxPerDay, setMaxPerDay] = useState(3)
  const [maxPerSlot, setMaxPerSlot] = useState(2)
  const [consentPt, setConsentPt] = useState<ConsentState>(emptyConsent)
  const [consentEn, setConsentEn] = useState<ConsentState>(emptyConsent)
  const [poolInvite, setPoolInvite] = useState(true)
  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [formError, setFormError] = useState('')
  const [teamError, setTeamError] = useState('')
  const [created, setCreated] = useState<Study | null>(null)
  const createStudy = useCreateStudy()
  const startStudy = useStartStudy(created?.id ?? '')

  const ownerEmail = user?.email ?? ''
  const ownerInitials = ownerEmail.split('@')[0].slice(0, 2).toUpperCase()
  const selectedStyle = styleKeys[calendarStyle]
  const styleName = t(selectedStyle.name)
  const titleDatesDone =
    title.trim().length > 0 && start.trim().length > 0 && end.trim().length > 0
  const consentDone = consentPt.text.trim().length > 0 || consentPt.fileName.length > 0
  const consentDetail = consentDone
    ? consentPt.fileName || consentPt.text
    : t('new.checklist.consentMissing')
  const canStart = created !== null && created.status === 'draft'
  const saving = createStudy.isPending
  const starting = startStudy.isPending

  function addCollaborator() {
    const email = collaboratorEmail.trim()
    if (!email.includes('@') || !email.includes('.')) {
      setTeamError(t('new.team.errorInvalid'))
      return
    }
    if (collaborators.includes(email) || email === ownerEmail) {
      setTeamError(t('new.team.errorDuplicate'))
      return
    }
    setCollaborators((current) => [...current, email])
    setCollaboratorEmail('')
    setTeamError('')
  }

  function saveDraft() {
    setFormError('')
    if (!title.trim()) {
      setFormError(t('new.error.title'))
      return
    }
    if (!start || !end || end < start) {
      setFormError(t('new.error.dates'))
      return
    }
    createStudy.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        starts_on: start,
        ends_on: end,
        timezone,
        max_prompts_per_day: maxPerDay,
        max_prompts_per_slot: maxPerSlot,
        schedule_style: calendarStyle,
      },
      {
        onSuccess: (study) => {
          setCreated(study)
        },
      },
    )
  }

  function startCreatedStudy() {
    if (!created) {
      return
    }
    startStudy.mutate(undefined, {
      onSuccess: (study) => {
        setCreated(study)
        navigate(`/estudos/${study.id}/visao-geral`)
      },
    })
  }

  return (
    <div className="st-page">
      <header className="st-page-header">
        <div className="st-header-copy">
          <h1 className="st-title">{t('new.title')}</h1>
          <p className="st-subtitle">{t('new.subtitle')}</p>
        </div>
      </header>

      <div className="st-new-layout">
        <div className="st-new-form">
          <section className="card st-section" aria-labelledby="new-info">
            <SectionHeading id="new-info" step={1} title={t('new.section.info')} />
            <div className="st-field">
              <label htmlFor="study-title">{t('new.field.title')}</label>
              <input
                id="study-title"
                className="st-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="st-field">
              <label htmlFor="study-description">{t('new.field.description')}</label>
              <textarea
                id="study-description"
                className="st-textarea"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="st-grid-3">
              <div className="st-field">
                <label htmlFor="study-start">{t('new.field.start')}</label>
                <input
                  id="study-start"
                  className="st-input"
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="st-field">
                <label htmlFor="study-end">{t('new.field.end')}</label>
                <input
                  id="study-end"
                  className="st-input"
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
              <div className="st-field">
                <label htmlFor="study-timezone">{t('new.field.timezone')}</label>
                <select
                  id="study-timezone"
                  className="st-input"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <span className="st-field-help">{t('new.daysNote')}</span>
          </section>

          <section className="card st-section" aria-labelledby="new-calendar">
            <SectionHeading
              id="new-calendar"
              step={2}
              title={t('new.section.calendar')}
              hint={t('new.section.calendarHint')}
            />
            <div
              className="st-style-options"
              role="radiogroup"
              aria-label={t('new.style.label')}
            >
              {calendarStyles.map((style) => {
                const keys = styleKeys[style.id]
                const active = calendarStyle === style.id
                return (
                  <label
                    key={style.id}
                    className={active ? 'st-style-card st-style-card-active' : 'st-style-card'}
                  >
                    <input
                      type="radio"
                      name="calendar-style"
                      value={style.id}
                      checked={active}
                      onChange={() => setCalendarStyle(style.id)}
                      className="st-radio"
                    />
                    <span className="st-style-name">{t(keys.name)}</span>
                    <span className="st-style-description">{t(keys.description)}</span>
                    <StylePreview style={style} />
                    <span className="st-style-caption">{t('new.style.preview')}</span>
                  </label>
                )
              })}
            </div>

            <div className="st-grid-2">
              <Counter
                id="max-per-day"
                label={t('new.counter.maxDay')}
                help={t('new.counter.maxDayHelp')}
                value={maxPerDay}
                onChange={setMaxPerDay}
              />
              <Counter
                id="max-per-slot"
                label={t('new.counter.maxSlot')}
                help={t('new.counter.maxSlotHelp')}
                value={maxPerSlot}
                onChange={setMaxPerSlot}
              />
            </div>

            <div className="st-note st-note-info">
              <LightbulbIcon />
              <span>
                <strong>{t('new.suggestion.lead')}</strong> {t('new.suggestion.body')}
              </span>
            </div>
          </section>

          <section className="card st-section" aria-labelledby="new-consent">
            <SectionHeading
              id="new-consent"
              step={3}
              title={t('new.section.consent')}
              hint={t('new.section.consentHint')}
            />
            <div className="st-grid-2">
              <ConsentCard
                language="pt"
                title={t('new.consent.pt')}
                hint={t('new.consent.emptyHintPt')}
                required
                value={consentPt}
                onChange={setConsentPt}
              />
              <ConsentCard
                language="en"
                title={t('new.consent.en')}
                hint={t('new.consent.emptyHintEn')}
                required={false}
                value={consentEn}
                onChange={setConsentEn}
              />
            </div>
            <div className="st-note st-note-info">
              <InfoIcon />
              <span>{t('new.fallback.consent')}</span>
            </div>
          </section>

          <section className="card st-section" aria-labelledby="new-recruitment">
            <SectionHeading
              id="new-recruitment"
              step={4}
              title={t('new.section.recruitment')}
              hint={t('new.section.recruitmentHint')}
            />
            <div className="st-recruit-row st-recruit-row-static">
              <span className="st-check-square st-check-square-muted" aria-hidden="true">
                <CheckIcon width={14} height={14} />
              </span>
              <span className="st-recruit-copy">
                <span className="st-recruit-title">
                  {t('new.recruitment.code.title')}
                  <span className="st-mini-tag">{t('new.recruitment.code.badge')}</span>
                </span>
                <span className="st-recruit-description">
                  {t('new.recruitment.code.description')}
                </span>
              </span>
            </div>

            <label
              className={
                poolInvite ? 'st-recruit-row st-recruit-row-active' : 'st-recruit-row'
              }
            >
              <input
                type="checkbox"
                className="st-checkbox"
                checked={poolInvite}
                onChange={(event) => setPoolInvite(event.target.checked)}
              />
              <span className="st-recruit-copy">
                <span className="st-recruit-title">{t('new.recruitment.pool.title')}</span>
                <span className="st-recruit-description">
                  {t('new.recruitment.pool.description')}
                </span>
              </span>
            </label>

            <div className="st-note st-note-info">
              <InfoIcon />
              <span>
                {t('new.recruitment.criteriaBefore')}
                <strong>{t('new.recruitment.criteriaStrong')}</strong>
                {t('new.recruitment.criteriaAfter')}
              </span>
            </div>
            <div className="st-note st-note-info">
              <InfoIcon />
              <span>{t('new.fallback.recruitment')}</span>
            </div>
          </section>

          <section className="card st-section" aria-labelledby="new-team">
            <SectionHeading
              id="new-team"
              step={5}
              title={t('new.section.team')}
              hint={t('new.section.teamHint')}
            />
            <div className="st-team-list">
              <div className="st-team-row">
                <span className="st-team-avatar">{ownerInitials}</span>
                <span className="st-team-copy">
                  <span className="st-team-name">{ownerEmail}</span>
                  <span className="st-team-email">{ownerEmail}</span>
                </span>
                <span className="st-mini-tag">{t('new.team.owner')}</span>
              </div>
              {collaborators.map((email) => (
                <div className="st-team-row" key={email}>
                  <span className="st-team-avatar st-team-avatar-alt">
                    {email.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="st-team-copy">
                    <span className="st-team-name">{email}</span>
                    <span className="st-team-email">{email}</span>
                  </span>
                  <span className="st-mini-tag">{t('new.team.collaborator')}</span>
                </div>
              ))}
            </div>

            <div className="st-team-add">
              <div className="st-field">
                <label htmlFor="collaborator-email">{t('new.team.addLabel')}</label>
                <input
                  id="collaborator-email"
                  className="st-input"
                  type="email"
                  placeholder={t('new.team.addPlaceholder')}
                  value={collaboratorEmail}
                  onChange={(event) => {
                    setCollaboratorEmail(event.target.value)
                    setTeamError('')
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addCollaborator()
                    }
                  }}
                />
                {teamError ? (
                  <span className="st-field-error" role="alert">
                    {teamError}
                  </span>
                ) : null}
              </div>
              <button type="button" className="st-btn st-btn-ghost" onClick={addCollaborator}>
                {t('new.team.add')}
              </button>
            </div>
            <span className="st-field-help">{t('new.team.note')}</span>
            <div className="st-note st-note-info">
              <InfoIcon />
              <span>{t('new.fallback.team')}</span>
            </div>
          </section>
        </div>

        <aside className="st-new-aside" aria-label={t('new.checklist.title')}>
          <section className="card st-checklist-card">
            <h2 className="h2">{t('new.checklist.title')}</h2>
            <ul className="st-checklist">
              <ChecklistItem
                done={titleDatesDone}
                title={t('new.checklist.titleDates')}
                detail={t('new.checklist.titleDatesDetail', {
                  start: formatDate(start),
                  end: formatDate(end),
                })}
              />
              <ChecklistItem
                done
                title={t('new.checklist.calendar')}
                detail={t('new.checklist.calendarDetail', { style: styleName, max: maxPerDay })}
              />
              <ChecklistItem
                done={false}
                title={t('new.checklist.activities')}
                detail={t('new.checklist.activitiesMissing')}
              />
              <ChecklistItem
                done={consentDone}
                title={t('new.checklist.consent')}
                detail={consentDetail}
              />
            </ul>
          </section>

          <section className="card st-save-card">
            {formError ? (
              <span className="st-field-error" role="alert">
                {formError}
              </span>
            ) : null}
            {createStudy.error ? (
              <span className="st-field-error" role="alert">
                {studiesErrorMessage(createStudy.error)}
              </span>
            ) : null}
            {startStudy.error ? (
              <span className="st-field-error" role="alert">
                {studiesErrorMessage(startStudy.error)}
              </span>
            ) : null}
            <button
              type="button"
              className="st-btn st-btn-outline st-btn-lg"
              onClick={saveDraft}
              disabled={saving || created !== null}
            >
              {saving ? t('new.saving') : t('new.saveDraft')}
            </button>
            <button
              type="button"
              className={canStart ? 'st-btn st-btn-primary st-btn-lg' : 'st-btn st-btn-off st-btn-lg'}
              disabled={!canStart || starting}
              aria-describedby="start-study-note"
              onClick={startCreatedStudy}
            >
              {starting ? t('new.starting') : t('new.start')}
            </button>
            <span id="start-study-note" className="st-field-help">
              {canStart ? t('new.startReady') : t('new.startNote')}
            </span>
            <span className="st-saved" role="status" aria-live="polite">
              {created ? t('new.saved') : ''}
            </span>
            {created ? (
              <div className="st-saved-links">
                <Link className="st-link" to={`/estudos/${created.id}/atividades`}>
                  {t('new.addActivities')}
                </Link>
                <Link className="st-link" to={`/estudos/${created.id}/visao-geral`}>
                  {t('new.openCreated')}
                </Link>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}
