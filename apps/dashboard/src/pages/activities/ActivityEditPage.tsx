import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckIcon,
  ClockIcon,
  FaceIcon,
  InfoIcon,
  MapPinIcon,
  SliderIcon,
  TextLinesIcon,
  WarningIcon,
} from '../../components/activities/ActivityIcons'
import ScalePreview from '../../components/activities/ScalePreview'
import Toggle from '../../components/activities/Toggle'
import TypeIcon from '../../components/activities/TypeIcon'
import {
  activitiesErrorMessage,
  draftFromActivity,
  draftToBody,
  draftValidationError,
  newActivityDraft,
  useActivities,
  useActivity,
  useCreateActivity,
  useDeleteActivity,
  useUpdateActivity,
  type ActivityDraft,
  type CaptureType,
  type ScaleKind,
} from '../../api/activities'
import { studiesErrorMessage, useStudy, useStudyRole } from '../../api/studies'
import { t, type ActivitiesKey } from '../../i18n/activities'
import '../../styles/activities.css'

const typeOrder: CaptureType[] = ['photo', 'text', 'video', 'audio', 'scale']

const typeLabelKeys: Record<CaptureType, ActivitiesKey> = {
  photo: 'type.photo',
  text: 'type.text',
  video: 'type.video',
  audio: 'type.audio',
  scale: 'type.scale',
}

const scaleKinds: ScaleKind[] = ['number', 'faces', 'text', 'bar']
const scalePointChoices = [3, 5, 7, 10] as const

const allowedScalePoints: Record<ScaleKind, readonly number[]> = {
  number: [3, 5, 7, 10],
  faces: [3, 5],
  text: [3, 5, 7],
  bar: [],
}

const scaleKindCopy: Record<ScaleKind, { label: ActivitiesKey; hint: ActivitiesKey }> = {
  number: { label: 'edit.scale.number', hint: 'edit.scale.numberHint' },
  faces: { label: 'edit.scale.faces', hint: 'edit.scale.facesHint' },
  text: { label: 'edit.scale.text', hint: 'edit.scale.textHint' },
  bar: { label: 'edit.scale.bar', hint: 'edit.scale.barHint' },
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10))
  return (hours || 0) * 60 + (minutes || 0)
}

export default function ActivityEditPage() {
  const { studyId = '', activityId } = useParams<{
    studyId: string
    activityId?: string
  }>()

  return (
    <ActivityEditor key={activityId ?? 'nova'} studyId={studyId} activityId={activityId} />
  )
}

function ActivityEditor({ studyId, activityId }: { studyId: string; activityId?: string }) {
  const navigate = useNavigate()
  const basePath = `/estudos/${studyId}/atividades`
  const studyQuery = useStudy(studyId)
  const activitiesQuery = useActivities(studyId)
  const activityQuery = useActivity(studyId, activityId)
  const access = useStudyRole(studyId)
  const createActivity = useCreateActivity(studyId)
  const updateActivity = useUpdateActivity(studyId)
  const deleteActivity = useDeleteActivity(studyId)
  const [draftState, setDraftState] = useState<ActivityDraft | null>(
    activityId ? null : newActivityDraft(),
  )
  const [activeType, setActiveType] = useState<CaptureType>('photo')
  const [saveError, setSaveError] = useState('')

  const draft = draftState ?? (activityQuery.data ? draftFromActivity(activityQuery.data) : null)
  const study = studyQuery.data
  const activities = activitiesQuery.data ?? []
  const loading =
    studyQuery.isLoading || activitiesQuery.isLoading || (activityId && activityQuery.isLoading)
  const loadError =
    studyQuery.error ?? activitiesQuery.error ?? activityQuery.error ?? null
  const canWrite = access.canDesign && study?.status !== 'closed'
  const mutationError =
    createActivity.error ?? updateActivity.error ?? deleteActivity.error ?? null
  const saving = createActivity.isPending || updateActivity.isPending
  const deleting = deleteActivity.isPending

  if (loading && !draft) {
    return (
      <div className="ac-page">
        <p className="ac-empty">{t('state.loading')}</p>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="ac-page">
        <div className="ac-warning-box" role="alert">
          <span>{activitiesErrorMessage(loadError)}</span>
          <button type="button" className="btn btn-sm" onClick={() => void activityQuery.refetch()}>
            {t('state.retry')}
          </button>
        </div>
      </div>
    )
  }

  const draftIndex = activities.findIndex((activity) => activity.id === draft.id)
  const code = draftIndex >= 0 ? `A${draftIndex + 1}` : `A${activities.length + 1}`

  function patch(values: Partial<ActivityDraft>) {
    setDraftState((current) => (current ? { ...current, ...values } : current))
  }

  function patchScale(values: Partial<ActivityDraft['scale']>) {
    setDraftState((current) =>
      current ? { ...current, scale: { ...current.scale, ...values } } : current,
    )
  }

  function toggleType(type: CaptureType) {
    setDraftState((current) => {
      if (!current) {
        return current
      }
      const selected = current.types.includes(type)
      return {
        ...current,
        types: selected ? current.types.filter((item) => item !== type) : [...current.types, type],
      }
    })
  }

  function pickScaleKind(kind: ScaleKind) {
    setDraftState((current) => {
      if (!current) {
        return current
      }
      const allowed = allowedScalePoints[kind]
      let points = current.scale.points
      if (allowed.length > 0 && !allowed.includes(points)) {
        points = allowed.filter((point) => point <= points).pop() ?? allowed[0]
      }
      return { ...current, scale: { ...current.scale, kind, points } }
    })
  }

  function save() {
    setSaveError('')
    const validation = draftValidationError(draft)
    if (validation) {
      setSaveError(validation)
      return
    }
    const body = draftToBody(draft)
    if (draft.id) {
      updateActivity.mutate(
        { activityId: draft.id, body },
        { onSuccess: () => navigate(basePath) },
      )
    } else {
      createActivity.mutate(body, { onSuccess: () => navigate(basePath) })
    }
  }

  function remove() {
    if (!draft.id || !window.confirm(t('edit.deleteConfirm'))) {
      return
    }
    deleteActivity.mutate(draft.id, { onSuccess: () => navigate(basePath) })
  }

  const selectedTypes = typeOrder.filter((type) => draft.types.includes(type))
  const active = selectedTypes.includes(activeType) ? activeType : (selectedTypes[0] ?? null)
  const scale = draft.scale
  const isBar = scale.kind === 'bar'
  const isText = scale.kind === 'text'
  const midDisabled = !isBar && scale.points % 2 === 0
  const showPrefix = !isText
  const scaleSummary = isBar
    ? t('edit.scale.summaryBar')
    : t('edit.scale.summary', {
        points: scale.points,
        type: t(scaleKindCopy[scale.kind].label),
      })
  const pointsNote = t(
    isBar
      ? 'edit.scale.pointsNoteBar'
      : scale.kind === 'faces'
        ? 'edit.scale.pointsNoteFaces'
        : scale.kind === 'text'
          ? 'edit.scale.pointsNoteText'
          : 'edit.scale.pointsNoteNumber',
  )
  const midNote = t(
    isBar
      ? 'edit.scale.midNoteBar'
      : midDisabled
        ? 'edit.scale.midNoteEven'
        : isText
          ? 'edit.scale.midNoteText'
          : 'edit.scale.midNoteOdd',
    { points: scale.points },
  )

  const windowMinutes = Math.max(0, timeToMinutes(draft.windowEnd) - timeToMinutes(draft.windowStart))
  const requiredMinutes = Math.max(0, draft.requestsPerDay - 1) * draft.minGapMinutes
  const fitsWindow = requiredMinutes <= windowMinutes
  const windowHours = windowMinutes / 60
  const windowHoursText = Number.isInteger(windowHours)
    ? String(windowHours)
    : windowHours.toFixed(1)

  const impactRows = activities.map((activity, index) => ({
    code: `A${index + 1}`,
    requests: activity.id === draft.id ? draft.requestsPerDay : activity.prompts_per_day,
    minutes: activity.id === draft.id ? draft.effortMinutes : activity.expected_minutes,
  }))
  if (draft.id === null) {
    impactRows.push({
      code,
      requests: draft.requestsPerDay,
      minutes: draft.effortMinutes,
    })
  }
  const impactTotal = impactRows.reduce(
    (total, row) => total + row.minutes * row.requests,
    0,
  )

  const isNew = draft.id === null
  const title = draft.title.trim() || t('edit.newTitle')
  const studyTitle = study?.title ?? ''

  return (
    <div className="ac-page">
      <header className="ac-header">
        <div className="ac-header-copy">
          <h1 className="ac-title">
            {isNew ? t('edit.newTitle') : t('edit.title', { code })}
          </h1>
          <p className="ac-subtitle">
            {isNew
              ? t('edit.newSubtitle', { study: studyTitle })
              : t('edit.subtitle', { title, study: studyTitle })}
          </p>
        </div>
        <div className="ac-header-actions">
          <Link className="btn" to={basePath}>
            {t('edit.back')}
          </Link>
          {canWrite ? (
            <>
              {!isNew ? (
                <button
                  type="button"
                  className="btn"
                  onClick={remove}
                  disabled={deleting || saving}
                >
                  {deleting ? t('edit.deleting') : t('edit.delete')}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-p"
                onClick={save}
                disabled={saving || deleting}
              >
                {saving ? t('edit.saving') : t('edit.save')}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {!canWrite ? (
        <div className="ac-warning-box" role="alert">
          <WarningIcon />
          <span>{t('edit.noPermission')}</span>
        </div>
      ) : null}

      {loadError ? (
        <div className="ac-warning-box" role="alert">
          <span>{studiesErrorMessage(loadError)}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              void studyQuery.refetch()
              void activitiesQuery.refetch()
            }}
          >
            {t('state.retry')}
          </button>
        </div>
      ) : null}

      {saveError || mutationError ? (
        <div className="ac-warning-box" role="alert">
          <span>{saveError || activitiesErrorMessage(mutationError)}</span>
        </div>
      ) : null}

      <div className="ac-edit-grid">
        <div className="ac-column">
          <section className="card ac-section" aria-label={t('edit.section.ask')}>
            <h2 className="h2">{t('edit.section.ask')}</h2>

            <div className="ac-field">
              <label className="ac-label" htmlFor="activity-title">
                {t('edit.field.title')}
              </label>
              <input
                id="activity-title"
                className="ac-input"
                value={draft.title}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </div>

            <div className="ac-field">
              <label className="ac-label" htmlFor="activity-instruction">
                {t('edit.field.instruction')}
              </label>
              <textarea
                id="activity-instruction"
                className="ac-textarea"
                rows={3}
                value={draft.instruction}
                onChange={(event) => patch({ instruction: event.target.value })}
              />
            </div>

            <div className="ac-warning-box">
              <WarningIcon />
              <span>
                <b>{t('edit.warningTitle')}</b>
                {t('edit.warningBody')}
              </span>
            </div>

            <div className="ac-field">
              <span className="ac-label" id="activity-types">
                {t('edit.types')}
              </span>
              <div
                className="ac-type-toggle-row"
                role="group"
                aria-labelledby="activity-types"
              >
                {typeOrder.map((type) => {
                  const selected = draft.types.includes(type)
                  return (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={selected}
                      className={selected ? 'ac-type-toggle ac-type-toggle-on' : 'ac-type-toggle'}
                      onClick={() => toggleType(type)}
                    >
                      {selected ? <CheckIcon width={16} height={16} /> : null}
                      <TypeIcon type={type} />
                      {t(typeLabelKeys[type])}
                    </button>
                  )
                })}
              </div>
              <span className="ac-sub">{t('edit.typesHint')}</span>
            </div>

            <div className="ac-two-col">
              <div className="ac-field">
                <label className="ac-label" htmlFor="activity-effort">
                  {t('edit.effort')}
                </label>
                <div className="ac-number-row">
                  <input
                    id="activity-effort"
                    className="ac-input ac-input-short mono"
                    type="number"
                    min={1}
                    max={60}
                    value={draft.effortMinutes}
                    onChange={(event) =>
                      patch({
                        effortMinutes: Math.max(
                          1,
                          parseNumber(event.target.value, draft.effortMinutes),
                        ),
                      })
                    }
                  />
                  <span className="ac-unit">{t('common.minutes')}</span>
                </div>
                <span className="ac-sub">{t('edit.effortHint')}</span>
              </div>

              <div className="ac-field">
                <span className="ac-label">{t('edit.location')}</span>
                <div className="ac-switch-row">
                  <Toggle
                    checked={draft.locationRequested}
                    onChange={(checked) => patch({ locationRequested: checked })}
                    label={t('edit.locationToggle')}
                  />
                  <span className="ac-switch-label">{t('edit.locationToggle')}</span>
                </div>
                <span className="ac-sub">{t('edit.locationHint')}</span>
              </div>
            </div>
          </section>

          {draft.types.includes('scale') ? (
            <section className="card ac-section" aria-label={t('edit.scale.section')}>
              <div className="ac-section-head">
                <div className="ac-section-heading">
                  <h2 className="h2">{t('edit.scale.section')}</h2>
                  <p className="ac-sub">{t('edit.scale.subtitle')}</p>
                </div>
                <span className="pill pr ac-summary-pill">{scaleSummary}</span>
              </div>

              <div className="ac-field">
                <span className="ac-label" id="scale-kind">
                  {t('edit.scale.kind')}
                </span>
                <div
                  className="ac-scale-kind-grid"
                  role="radiogroup"
                  aria-labelledby="scale-kind"
                >
                  {scaleKinds.map((kind) => {
                    const selected = scale.kind === kind
                    return (
                      <button
                        key={kind}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        className={
                          selected ? 'ac-scale-kind ac-scale-kind-on' : 'ac-scale-kind'
                        }
                        onClick={() => pickScaleKind(kind)}
                      >
                        <span className="ac-scale-kind-icon">
                          {kind === 'number' ? (
                            <span className="mono ac-scale-kind-number">1 2 3</span>
                          ) : null}
                          {kind === 'faces' ? <FaceIcon width={26} height={26} /> : null}
                          {kind === 'text' ? <TextLinesIcon width={24} height={24} /> : null}
                          {kind === 'bar' ? <SliderIcon width={26} height={26} /> : null}
                        </span>
                        <span className="ac-scale-kind-label">
                          {t(scaleKindCopy[kind].label)}
                        </span>
                        <span className="ac-scale-kind-hint">
                          {t(scaleKindCopy[kind].hint)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="ac-field">
                <span className="ac-label" id="scale-points">
                  {t('edit.scale.points')}
                </span>
                <div
                  className="ac-point-row"
                  role="radiogroup"
                  aria-labelledby="scale-points"
                >
                  {scalePointChoices.map((point) => {
                    const disabled = !allowedScalePoints[scale.kind].includes(point)
                    const selected = !isBar && scale.points === point
                    return (
                      <button
                        key={point}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-disabled={disabled}
                        disabled={disabled}
                        className={
                          selected
                            ? 'ac-point ac-point-on'
                            : disabled
                              ? 'ac-point ac-point-off'
                              : 'ac-point'
                        }
                        onClick={() => patchScale({ points: point })}
                      >
                        {point}
                      </button>
                    )
                  })}
                </div>
                <span className="ac-sub">{pointsNote}</span>
              </div>

              <div className="ac-scale-labels">
                <div className="ac-field">
                  <label className="ac-label" htmlFor="scale-low">
                    {isText ? t('edit.scale.firstWord') : t('edit.scale.low')}
                  </label>
                  <div className="ac-prefix-row">
                    {showPrefix ? (
                      <span className="ac-prefix mono">{isBar ? '0' : '1'} =</span>
                    ) : null}
                    <input
                      id="scale-low"
                      className="ac-input"
                      value={scale.lowLabel}
                      onChange={(event) => patchScale({ lowLabel: event.target.value })}
                    />
                  </div>
                </div>

                <div className="ac-field">
                  <label className="ac-label" htmlFor="scale-mid">
                    {t('edit.scale.mid')}
                  </label>
                  <input
                    id="scale-mid"
                    className="ac-input"
                    disabled={midDisabled}
                    placeholder={
                      midDisabled
                        ? t('edit.scale.midDisabled')
                        : t('edit.scale.midPlaceholder')
                    }
                    value={scale.midLabel}
                    onChange={(event) => patchScale({ midLabel: event.target.value })}
                  />
                </div>

                <div className="ac-field">
                  <label className="ac-label" htmlFor="scale-high">
                    {isText ? t('edit.scale.lastWord') : t('edit.scale.high')}
                  </label>
                  <div className="ac-prefix-row">
                    {showPrefix ? (
                      <span className="ac-prefix mono">{isBar ? '100' : scale.points} =</span>
                    ) : null}
                    <input
                      id="scale-high"
                      className="ac-input"
                      value={scale.highLabel}
                      onChange={(event) => patchScale({ highLabel: event.target.value })}
                    />
                  </div>
                </div>
              </div>
              <span className="ac-sub ac-mid-note">{midNote}</span>

              <div className="ac-preview-box">
                <span className="ac-preview-label">{t('edit.scale.previewLabel')}</span>
                <div className="ac-preview-card" role="img" aria-label={t('edit.scale.previewAria')}>
                  <span className="ac-preview-question">{t('edit.scale.question')}</span>
                  <ScalePreview scale={scale} />
                </div>
              </div>

              <div className="ac-info-box">
                <InfoIcon />
                <span>{t('edit.scale.ordinal')}</span>
              </div>
            </section>
          ) : null}

          <section className="card ac-section" aria-label={t('edit.free.section')}>
            <div className="ac-section-head">
              <div className="ac-section-heading">
                <h2 className="h2">{t('edit.free.section')}</h2>
                <p className="ac-sub">{t('edit.free.subtitle')}</p>
              </div>
              <Toggle
                checked={draft.freeEntriesEnabled}
                onChange={(checked) => patch({ freeEntriesEnabled: checked })}
                label={t('edit.free.section')}
              />
            </div>
            <div className="ac-field">
              <label className="ac-label" htmlFor="free-max">
                {t('edit.free.label')}
              </label>
              <div className="ac-number-row">
                <input
                  id="free-max"
                  className="ac-input ac-input-short mono"
                  type="number"
                  min={1}
                  max={20}
                  disabled={!draft.freeEntriesEnabled}
                  value={draft.freeEntriesPerDay}
                  onChange={(event) =>
                    patch({
                      freeEntriesPerDay: Math.max(
                        1,
                        parseNumber(event.target.value, draft.freeEntriesPerDay),
                      ),
                    })
                  }
                />
                <span className="ac-unit">{t('edit.free.perParticipant')}</span>
              </div>
              <span className="ac-sub">{t('edit.free.hint')}</span>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('edit.when.section')}>
            <h2 className="h2">{t('edit.when.section')}</h2>
            <div className="ac-when-grid">
              <div className="ac-field">
                <label className="ac-label" htmlFor="window-start">
                  {t('edit.when.start')}
                </label>
                <input
                  id="window-start"
                  className="ac-input mono"
                  type="time"
                  value={draft.windowStart}
                  onChange={(event) => patch({ windowStart: event.target.value })}
                />
              </div>
              <div className="ac-field">
                <label className="ac-label" htmlFor="window-end">
                  {t('edit.when.end')}
                </label>
                <input
                  id="window-end"
                  className="ac-input mono"
                  type="time"
                  value={draft.windowEnd}
                  onChange={(event) => patch({ windowEnd: event.target.value })}
                />
              </div>
              <div className="ac-field">
                <label className="ac-label" htmlFor="requests-per-day">
                  {t('edit.when.requests')}
                </label>
                <input
                  id="requests-per-day"
                  className="ac-input mono"
                  type="number"
                  min={1}
                  max={12}
                  value={draft.requestsPerDay}
                  onChange={(event) =>
                    patch({
                      requestsPerDay: Math.max(
                        1,
                        parseNumber(event.target.value, draft.requestsPerDay),
                      ),
                    })
                  }
                />
              </div>
              <div className="ac-field">
                <label className="ac-label" htmlFor="min-gap">
                  {t('edit.when.gap')}
                </label>
                <div className="ac-number-row">
                  <input
                    id="min-gap"
                    className="ac-input mono"
                    type="number"
                    min={0}
                    max={720}
                    value={draft.minGapMinutes}
                    onChange={(event) =>
                      patch({
                        minGapMinutes: Math.max(
                          0,
                          parseNumber(event.target.value, draft.minGapMinutes),
                        ),
                      })
                    }
                  />
                  <span className="ac-unit">{t('common.min')}</span>
                </div>
              </div>
            </div>
            <p className="ac-sub">
              {t('edit.when.hint', {
                timezone: study?.timezone ?? 'Europe/Lisbon',
                code,
                start: draft.windowStart,
                end: draft.windowEnd,
              })}
            </p>
            <div className={fitsWindow ? 'ac-success-box' : 'ac-warning-box'}>
              {fitsWindow ? <CheckIcon /> : <WarningIcon />}
              <span>
                {fitsWindow
                  ? t('edit.when.fits', {
                      hours: windowHoursText,
                      requests: draft.requestsPerDay,
                      gap: draft.minGapMinutes,
                    })
                  : t('edit.when.doesNotFit')}
              </span>
            </div>
          </section>
        </div>

        <aside className="ac-column ac-edit-aside" aria-label={t('edit.preview.title')}>
          <section className="card ac-section ac-preview-section">
            <div className="ac-section-heading">
              <h2 className="h2">{t('edit.preview.title')}</h2>
              <p className="ac-sub">{t('edit.preview.subtitle')}</p>
            </div>

            <div className="ac-phone" role="group" aria-label={t('edit.preview.phoneAria')}>
              <div className="ac-phone-heading">
                <span className="ac-phone-meta">
                  {t('edit.preview.activityMeta', { minutes: draft.effortMinutes })}
                </span>
                <span className="ac-phone-title">{title}</span>
              </div>
              {draft.instruction ? <p className="ac-phone-instruction">{draft.instruction}</p> : null}

              {selectedTypes.length === 0 ? (
                <p className="ac-phone-empty">{t('edit.preview.noTypes')}</p>
              ) : (
                <>
                  <div className="ac-phone-tabs" role="tablist" aria-label={t('list.typesAria')}>
                    {selectedTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        role="tab"
                        aria-selected={active === type}
                        className={active === type ? 'ac-phone-tab ac-phone-tab-on' : 'ac-phone-tab'}
                        onClick={() => setActiveType(type)}
                      >
                        <TypeIcon type={type} size={13} />
                        {t(typeLabelKeys[type])}
                      </button>
                    ))}
                  </div>

                  {active === 'photo' ? (
                    <div className="ac-phone-photo" aria-hidden="true">
                      <svg
                        width="100%"
                        height="100%"
                        viewBox="0 0 264 112"
                        preserveAspectRatio="xMidYMid slice"
                      >
                        <rect width="264" height="112" fill="#CFE3D2" />
                        <circle cx="211.2" cy="26.88" r="13.44" fill="#EBD9A8" />
                        <path d="M0 69.44Q66 50.4 132 67.2T264 61.6V112H0z" fill="#9CC3A6" />
                        <path d="M0 89.6Q79.2 76.16 158.4 89.6T264 85.12V112H0z" fill="#5E9470" />
                        <rect x="36.96" y="33.6" width="7.92" height="44.8" fill="#3E7352" />
                        <circle cx="40.92" cy="33.6" r="19.04" fill="#3E7352" />
                        <circle cx="71.28" cy="42.56" r="12.32" fill="#5E9470" />
                      </svg>
                    </div>
                  ) : null}

                  {active === 'text' ? (
                    <div className="ac-phone-text" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}

                  {active === 'video' ? (
                    <div className="ac-phone-video" aria-hidden="true">
                      <span className="ac-phone-play" />
                    </div>
                  ) : null}

                  {active === 'audio' ? (
                    <div className="ac-phone-audio" aria-hidden="true">
                      {Array.from({ length: 18 }, (_, index) => (
                        <span
                          key={index}
                          style={{ height: `${10 + ((index * 7) % 26)}px` }}
                        />
                      ))}
                    </div>
                  ) : null}

                  {active === 'scale' ? (
                    <div className="ac-phone-scale">
                      <ScalePreview scale={scale} />
                    </div>
                  ) : null}
                </>
              )}

              {draft.locationRequested ? (
                <div className="ac-phone-location">
                  <MapPinIcon width={15} height={15} />
                  <span>
                    {t('edit.preview.location')}
                    <b>{t('edit.preview.why')}</b>
                  </span>
                </div>
              ) : null}

              <div className="ac-phone-save">{t('edit.preview.save')}</div>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('edit.impact.title')}>
            <h2 className="h2">{t('edit.impact.title')}</h2>
            <div className="ac-impact-list">
              {impactRows.map((row) => (
                <div className="ac-impact-row" key={row.code}>
                  <span>
                    {t('edit.impact.row', {
                      code: row.code,
                      requests: row.requests,
                      minutes: row.minutes,
                    })}
                  </span>
                  <b className="mono">{t('list.effortTotal', { total: row.minutes * row.requests })}</b>
                </div>
              ))}
              <div className="ac-impact-total">
                <span>{t('edit.impact.total')}</span>
                <b className="mono">{t('list.effortTotal', { total: impactTotal })}</b>
              </div>
            </div>
            <p className="ac-sub">{t('edit.impact.note')}</p>
            <div className="ac-info-box">
              <ClockIcon />
              <span>{t('edit.impact.schedule')}</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
