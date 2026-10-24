import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CopyIcon,
  GripIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  QrIcon,
  TrashIcon,
  WarningIcon,
  XIcon,
} from '../../components/activities/ActivityIcons'
import Modal from '../../components/activities/Modal'
import Toggle from '../../components/activities/Toggle'
import {
  activities,
  demoStudyId,
  getStudySettings,
  type PosterOptions,
  type QuestionType,
  type ScheduleStyleId,
  type StudyQuestion,
  type StudySettings,
  type TeamMember,
} from '../../fake/activities'
import { t, type ActivitiesKey } from '../../i18n/activities'
import '../../styles/activities.css'

const scheduleStyles: { id: ScheduleStyleId; label: ActivitiesKey; hint: ActivitiesKey }[] = [
  { id: 'fixed', label: 'settings.style.fixed', hint: 'settings.style.fixedHint' },
  { id: 'balanced', label: 'settings.style.balanced', hint: 'settings.style.balancedHint' },
  { id: 'varied', label: 'settings.style.varied', hint: 'settings.style.variedHint' },
]

const questionTypeLabels: Record<QuestionType, ActivitiesKey> = {
  single: 'settings.questions.single',
  multiple: 'settings.questions.multiple',
  yesno: 'settings.questions.yesno',
}

const questionTypePills: Record<QuestionType, string> = {
  single: 'pr',
  multiple: 'pr',
  yesno: 'ne',
}

type QuestionEditor = {
  id: string | null
  text: string
  type: QuestionType
  optionsText: string
}

export default function StudySettingsPage() {
  const { studyId = demoStudyId } = useParams<{ studyId: string }>()
  const [settings, setSettings] = useState<StudySettings>(() => getStudySettings())
  const [saved, setSaved] = useState(false)
  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [teamError, setTeamError] = useState('')
  const [consentLang, setConsentLang] = useState<'pt' | 'en' | null>(null)
  const [consentDraft, setConsentDraft] = useState('')
  const [questionEditor, setQuestionEditor] = useState<QuestionEditor | null>(null)
  const [questionError, setQuestionError] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [endText, setEndText] = useState('')
  const [terminated, setTerminated] = useState(false)
  const [copied, setCopied] = useState(false)

  function patch(values: Partial<StudySettings>) {
    setSettings((current) => ({ ...current, ...values }))
    setSaved(false)
  }

  function patchPoster(values: Partial<PosterOptions>) {
    setSettings((current) => ({
      ...current,
      poster: { ...current.poster, ...values },
    }))
    setSaved(false)
  }

  function addCollaborator() {
    const email = collaboratorEmail.trim()
    if (!email) {
      return
    }

    if (settings.team.some((member) => member.email.toLowerCase() === email.toLowerCase())) {
      setTeamError(t('settings.team.duplicate'))
      return
    }

    const localPart = email.split('@')[0] ?? email
    const words = localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    const name = words.join(' ') || email
    const initials =
      words
        .map((word) => word.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'NC'
    const member: TeamMember = {
      id: `u-${Date.now()}`,
      initials,
      name,
      email,
      note: t('settings.team.anonymous'),
      role: 'collaborator',
      tone: 'teal',
    }

    setSettings((current) => ({ ...current, team: [...current.team, member] }))
    setCollaboratorEmail('')
    setTeamError('')
    setSaved(false)
  }

  function removeMember(memberId: string) {
    setSettings((current) => ({
      ...current,
      team: current.team.filter((member) => member.id !== memberId),
    }))
    setSaved(false)
  }

  function openConsent(lang: 'pt' | 'en') {
    setConsentLang(lang)
    setConsentDraft(lang === 'pt' ? settings.consentPt : settings.consentEn)
  }

  function saveConsent() {
    if (consentLang === 'pt') {
      patch({ consentPt: consentDraft })
    } else if (consentLang === 'en') {
      patch({ consentEn: consentDraft })
    }
    setConsentLang(null)
  }

  function openNewQuestion() {
    setQuestionEditor({ id: null, text: '', type: 'single', optionsText: '' })
    setQuestionError('')
  }

  function openQuestion(question: StudyQuestion) {
    setQuestionEditor({
      id: question.id,
      text: question.text,
      type: question.type,
      optionsText: question.options.join('\n'),
    })
    setQuestionError('')
  }

  function saveQuestion() {
    if (!questionEditor) {
      return
    }

    const editor = questionEditor
    const text = editor.text.trim()
    const options =
      editor.type === 'yesno'
        ? [t('settings.questions.yes'), t('settings.questions.no')]
        : editor.optionsText
            .split('\n')
            .map((option) => option.trim())
            .filter(Boolean)

    if (!text || (editor.type !== 'yesno' && options.length < 2)) {
      setQuestionError(t('settings.questions.error'))
      return
    }

    const nextQuestion: StudyQuestion = {
      id: editor.id ?? `q-${Date.now()}`,
      text,
      type: editor.type,
      options,
    }

    setSettings((current) => {
      const exists = current.questions.some((question) => question.id === editor.id)
      return {
        ...current,
        questions: exists
          ? current.questions.map((question) =>
              question.id === editor.id ? nextQuestion : question,
            )
          : [...current.questions, nextQuestion],
      }
    })
    setSaved(false)
    setQuestionEditor(null)
    setQuestionError('')
  }

  function removeQuestion(questionId: string) {
    setSettings((current) => ({
      ...current,
      questions: current.questions.filter((question) => question.id !== questionId),
    }))
    setSaved(false)
  }

  function reorderQuestion(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      return
    }

    setSettings((current) => {
      const questions = [...current.questions]
      const from = questions.findIndex((question) => question.id === dragId)
      const to = questions.findIndex((question) => question.id === targetId)
      if (from === -1 || to === -1) {
        return current
      }

      const [moved] = questions.splice(from, 1)
      questions.splice(to, 0, moved)
      return { ...current, questions }
    })
    setSaved(false)
    setDragId(null)
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(settings.poster.studyCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function confirmTerminate() {
    if (endText.trim() !== settings.title.trim()) {
      return
    }

    setTerminated(true)
    setEndOpen(false)
    setEndText('')
  }

  const activeQuestion = questionEditor
    ? editorIsNew(questionEditor)
      ? t('settings.questions.addTitle')
      : t('settings.questions.editTitle')
    : ''
  const requestsPerDay = activities.reduce(
    (total, activity) => total + activity.requestsPerDay,
    0,
  )

  return (
    <div className="ac-page">
      <header className="ac-header">
        <div className="ac-header-copy">
          <h1 className="ac-title">{t('settings.title')}</h1>
          <p className="ac-subtitle">{t('settings.subtitle', { study: settings.title })}</p>
        </div>
        <div className="ac-header-actions">
          <Link className="btn" to={`/estudos/${studyId}/visao-geral`}>
            {t('settings.cancel')}
          </Link>
          <button type="button" className="btn btn-p" onClick={() => setSaved(true)}>
            {t('settings.save')}
          </button>
        </div>
      </header>

      {saved ? (
        <p className="ac-saved-note" role="status">
          {t('settings.saved')}
        </p>
      ) : null}

      <div className="ac-settings-layout">
        <div className="ac-column">
          <section className="card ac-section" aria-label={t('settings.section.data')}>
            <h2 className="h2">{t('settings.section.data')}</h2>

            <div className="ac-field">
              <label className="ac-label" htmlFor="study-title">
                {t('settings.field.title')}
              </label>
              <input
                id="study-title"
                className="ac-input"
                value={settings.title}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </div>

            <div className="ac-field">
              <label className="ac-label" htmlFor="study-description">
                {t('settings.field.description')}
              </label>
              <textarea
                id="study-description"
                className="ac-textarea"
                rows={2}
                value={settings.description}
                onChange={(event) => patch({ description: event.target.value })}
              />
              <span className="ac-sub">{t('settings.field.descriptionHint')}</span>
            </div>

            <div className="ac-two-col">
              <div className="ac-field">
                <span className="ac-label">{t('settings.field.start')}</span>
                <div className="ac-locked-field">
                  <LockIcon width={16} height={16} />
                  {settings.startDate}
                </div>
                <span className="ac-sub">{t('settings.field.started')}</span>
              </div>
              <div className="ac-field">
                <label className="ac-label" htmlFor="study-end">
                  {t('settings.field.end')}
                </label>
                <input
                  id="study-end"
                  className="ac-input"
                  value={settings.endDate}
                  onChange={(event) => patch({ endDate: event.target.value })}
                />
                <span className="ac-sub">{t('settings.field.endHint')}</span>
              </div>
            </div>

            <div className="ac-field">
              <span className="ac-label">{t('settings.field.timezone')}</span>
              <div className="ac-locked-field">
                <LockIcon width={16} height={16} />
                {settings.timezone}
              </div>
              <span className="ac-sub">{t('settings.field.timezoneHint')}</span>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.section.plan')}>
            <div className="ac-section-heading">
              <h2 className="h2">{t('settings.section.plan')}</h2>
              <p className="ac-sub">{t('settings.plan.hint')}</p>
            </div>

            <div className="ac-field">
              <span className="ac-label" id="schedule-style">
                {t('settings.plan.style')}
              </span>
              <div
                className="ac-segmented"
                role="radiogroup"
                aria-labelledby="schedule-style"
              >
                {scheduleStyles.map((style) => {
                  const selected = settings.scheduleStyle === style.id
                  return (
                    <button
                      key={style.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={selected ? 'ac-segment ac-segment-on' : 'ac-segment'}
                      onClick={() => patch({ scheduleStyle: style.id })}
                    >
                      <span className="ac-segment-label">{t(style.label)}</span>
                      <span className="ac-segment-hint">{t(style.hint)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="ac-two-col">
              <div className="ac-field">
                <label className="ac-label" htmlFor="max-per-day">
                  {t('settings.plan.maxPerDay')}
                </label>
                <input
                  id="max-per-day"
                  className="ac-input mono"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.maxRequestsPerDay}
                  onChange={(event) =>
                    patch({
                      maxRequestsPerDay:
                        Number.parseInt(event.target.value, 10) || settings.maxRequestsPerDay,
                    })
                  }
                />
                <span className="ac-sub">
                  {t('settings.plan.maxPerDayHint', { count: requestsPerDay })}
                </span>
              </div>
              <div className="ac-field">
                <label className="ac-label" htmlFor="max-per-window">
                  {t('settings.plan.maxPerWindow')}
                </label>
                <input
                  id="max-per-window"
                  className="ac-input mono"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.maxRequestsPerWindow}
                  onChange={(event) =>
                    patch({
                      maxRequestsPerWindow:
                        Number.parseInt(event.target.value, 10) ||
                        settings.maxRequestsPerWindow,
                    })
                  }
                />
                <span className="ac-sub">{t('settings.plan.maxPerWindowHint')}</span>
              </div>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.section.consent')}>
            <div className="ac-section-head">
              <div className="ac-section-heading">
                <h2 className="h2">{t('settings.section.consent')}</h2>
                <p className="ac-sub">
                  {t('settings.consent.subtitle', {
                    version: settings.consentVersion,
                    count: settings.consentAcceptedBy,
                  })}
                </p>
              </div>
              <span className="pill ok">
                {t('settings.consent.pill', { version: settings.consentVersion })}
              </span>
            </div>

            <div className="ac-info-box">
              <InfoIcon />
              <span>{t('settings.consent.info', { version: settings.consentVersion })}</span>
            </div>

            <div className="ac-button-row">
              <button type="button" className="btn" onClick={() => openConsent('pt')}>
                <PencilIcon />
                {t('settings.consent.editPt')}
              </button>
              <button type="button" className="btn" onClick={() => openConsent('en')}>
                <PencilIcon />
                {t('settings.consent.editEn')}
              </button>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.section.questions')}>
            <div className="ac-section-head">
              <div className="ac-section-heading">
                <h2 className="h2">{t('settings.section.questions')}</h2>
                <p className="ac-sub">{t('settings.questions.subtitle')}</p>
              </div>
              <span className="pill ne">
                {settings.questions.length === 1
                  ? t('settings.questions.countOne')
                  : t('settings.questions.count', { count: settings.questions.length })}
              </span>
            </div>

            {settings.questions.length === 0 ? (
              <p className="ac-sub">{t('settings.questions.empty')}</p>
            ) : (
              <ol className="ac-question-list">
                {settings.questions.map((question, index) => (
                  <li
                    key={question.id}
                    className="ac-question-item"
                    draggable
                    onDragStart={() => setDragId(question.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderQuestion(question.id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    <button
                      type="button"
                      className="ac-grip"
                      aria-label={t('settings.questions.reorderAria', { number: index + 1 })}
                    >
                      <GripIcon />
                    </button>
                    <div className="ac-question-copy">
                      <div className="ac-question-title-row">
                        <span className="ac-question-title">
                          {index + 1}. {question.text}
                        </span>
                        <span className={`pill ${questionTypePills[question.type]}`}>
                          {t(questionTypeLabels[question.type])}
                        </span>
                      </div>
                      <span className="ac-sub">{question.options.join(' · ')}</span>
                    </div>
                    <div className="ac-question-actions">
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        aria-label={t('settings.questions.editAria', { number: index + 1 })}
                        onClick={() => openQuestion(question)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        aria-label={t('settings.questions.removeAria', { number: index + 1 })}
                        onClick={() => removeQuestion(question.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div>
              <button type="button" className="btn" onClick={openNewQuestion}>
                <PlusIcon />
                {t('settings.questions.add')}
              </button>
            </div>

            <div className="ac-info-box">
              <InfoIcon />
              <span>{t('settings.questions.info')}</span>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.rules.title')}>
            <h2 className="h2">{t('settings.rules.title')}</h2>
            <div className="ac-rules-list">
              {(
                [
                  {
                    pill: 'ok',
                    pillKey: 'settings.rules.now',
                    titleKey: 'settings.rules.titleDesc',
                    hintKey: 'settings.rules.titleDescHint',
                  },
                  {
                    pill: 'ok',
                    pillKey: 'settings.rules.now',
                    titleKey: 'settings.rules.endTeam',
                    hintKey: 'settings.rules.endTeamHint',
                  },
                  {
                    pill: 'pr',
                    pillKey: 'settings.rules.later',
                    titleKey: 'settings.rules.plan',
                    hintKey: 'settings.rules.planHint',
                  },
                  {
                    pill: 'pr',
                    pillKey: 'settings.rules.later',
                    titleKey: 'settings.rules.consent',
                    hintKey: 'settings.rules.consentHint',
                  },
                  {
                    pill: 'pr',
                    pillKey: 'settings.rules.later',
                    titleKey: 'settings.rules.questions',
                    hintKey: 'settings.rules.questionsHint',
                  },
                  {
                    pill: 'ne',
                    pillKey: 'settings.rules.never',
                    titleKey: 'settings.rules.locked',
                    hintKey: 'settings.rules.lockedHint',
                    locked: true,
                  },
                ] as const
              ).map((row) => (
                <div className="ac-rule-row" key={row.titleKey}>
                  <span>
                    <span className={`pill ${row.pill}`}>
                      {'locked' in row ? <LockIcon width={14} height={14} /> : null}
                      {t(row.pillKey)}
                    </span>
                  </span>
                  <div className="ac-rule-copy">
                    <span className="ac-rule-title">{t(row.titleKey)}</span>
                    <span className="ac-sub">{t(row.hintKey)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="ac-column">
          <section className="card ac-section" aria-label={t('settings.section.team')}>
            <h2 className="h2">{t('settings.section.team')}</h2>
            <div className="ac-team-list">
              {settings.team.map((member) => (
                <div className="ac-team-row" key={member.id}>
                  <span className={`ac-avatar ac-avatar-${member.tone}`}>{member.initials}</span>
                  <div className="ac-team-copy">
                    <span className="ac-team-name">{member.name}</span>
                    <span className="ac-team-note">{member.note || member.email}</span>
                  </div>
                  {member.role === 'owner' ? (
                    <span className="pill pr">{t('settings.team.owner')}</span>
                  ) : (
                    <div className="ac-team-actions">
                      <span className="pill ne">{t('settings.team.collaborator')}</span>
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        aria-label={t('settings.team.removeAria', { name: member.name })}
                        onClick={() => removeMember(member.id)}
                      >
                        <XIcon width={16} height={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="ac-field">
              <label className="ac-label" htmlFor="collaborator-email">
                {t('settings.team.addLabel')}
              </label>
              <div className="ac-add-row">
                <input
                  id="collaborator-email"
                  className="ac-input"
                  type="email"
                  placeholder={t('settings.team.addPlaceholder')}
                  value={collaboratorEmail}
                  onChange={(event) => {
                    setCollaboratorEmail(event.target.value)
                    setTeamError('')
                  }}
                />
                <button type="button" className="btn btn-p" onClick={addCollaborator}>
                  {t('settings.team.add')}
                </button>
              </div>
              {teamError ? (
                <span className="ac-field-error" role="alert">
                  {teamError}
                </span>
              ) : null}
              <span className="ac-sub">{t('settings.team.hint')}</span>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.section.codes')}>
            <div className="ac-section-heading">
              <h2 className="h2">{t('settings.section.codes')}</h2>
              <p className="ac-sub">{t('settings.codes.subtitle')}</p>
            </div>

            <div className="ac-field">
              <span className="ac-label">{t('settings.codes.label')}</span>
              <div className="ac-code-row">
                <span className="ac-code-value mono">{settings.poster.studyCode}</span>
                <button type="button" className="btn btn-sm" onClick={copyCode}>
                  <CopyIcon width={16} height={16} />
                  {copied ? t('settings.codes.copied') : t('settings.codes.copy')}
                </button>
              </div>
            </div>

            <div className="ac-switch-list">
              <div className="ac-switch-item">
                <Toggle
                  checked={settings.poster.acceptCodeEntries}
                  onChange={(checked) => patchPoster({ acceptCodeEntries: checked })}
                  label={t('settings.codes.accept')}
                />
                <span>{t('settings.codes.accept')}</span>
              </div>
              <div className="ac-switch-item">
                <Toggle
                  checked={settings.poster.posterQr}
                  onChange={(checked) => patchPoster({ posterQr: checked })}
                  label={t('settings.codes.qr')}
                />
                <QrIcon width={16} height={16} />
                <span>{t('settings.codes.qr')}</span>
              </div>
              <div className="ac-switch-item">
                <Toggle
                  checked={settings.poster.posterCode}
                  onChange={(checked) => patchPoster({ posterCode: checked })}
                  label={t('settings.codes.print')}
                />
                <span>{t('settings.codes.print')}</span>
              </div>
            </div>

            <p className="ac-sub">{t('settings.codes.hint')}</p>
          </section>

          <section className="card ac-danger-card" aria-label={t('settings.section.end')}>
            <div className="ac-danger-head">
              <WarningIcon width={22} height={22} />
              <h2 className="ac-danger-title">{t('settings.section.end')}</h2>
            </div>
            {terminated ? (
              <div className="ac-end-done">
                <span className="pill ok">{t('settings.end.donePill')}</span>
                <span className="ac-sub">{t('settings.end.done')}</span>
              </div>
            ) : (
              <>
                <p className="ac-sub ac-body-strong">{t('settings.end.text')}</p>
                <button
                  type="button"
                  className="btn btn-d ac-self-start"
                  onClick={() => setEndOpen(true)}
                >
                  {t('settings.end.button')}
                </button>
                <p className="ac-sub">{t('settings.end.hint')}</p>
              </>
            )}
          </section>
        </div>
      </div>

      {consentLang ? (
        <Modal
          title={
            consentLang === 'pt'
              ? t('settings.consent.dialogPt')
              : t('settings.consent.dialogEn')
          }
          closeLabel={t('common.close')}
          onClose={() => setConsentLang(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setConsentLang(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-p" onClick={saveConsent}>
                {t('settings.save')}
              </button>
            </>
          }
        >
          <span className="ac-sub">{t('settings.consent.dialogHint')}</span>
          <textarea
            className="ac-textarea ac-modal-textarea"
            rows={9}
            placeholder={t('settings.consent.placeholder')}
            value={consentDraft}
            onChange={(event) => setConsentDraft(event.target.value)}
          />
        </Modal>
      ) : null}

      {questionEditor ? (
        <Modal
          title={activeQuestion}
          closeLabel={t('common.close')}
          onClose={() => setQuestionEditor(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setQuestionEditor(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-p" onClick={saveQuestion}>
                {t('settings.questions.save')}
              </button>
            </>
          }
        >
          <div className="ac-field">
            <label className="ac-label" htmlFor="question-text">
              {t('settings.questions.text')}
            </label>
            <input
              id="question-text"
              className="ac-input"
              value={questionEditor.text}
              onChange={(event) =>
                setQuestionEditor((current) =>
                  current ? { ...current, text: event.target.value } : current,
                )
              }
            />
          </div>

          <div className="ac-field">
            <label className="ac-label" htmlFor="question-type">
              {t('settings.questions.type')}
            </label>
            <select
              id="question-type"
              className="ac-input"
              value={questionEditor.type}
              onChange={(event) =>
                setQuestionEditor((current) =>
                  current
                    ? { ...current, type: event.target.value as QuestionType }
                    : current,
                )
              }
            >
              {(['single', 'multiple', 'yesno'] as const).map((type) => (
                <option key={type} value={type}>
                  {t(questionTypeLabels[type])}
                </option>
              ))}
            </select>
          </div>

          {questionEditor.type === 'yesno' ? (
            <div className="ac-field">
              <span className="ac-label">{t('settings.questions.options')}</span>
              <p className="ac-sub">
                {t('settings.questions.yes')} · {t('settings.questions.no')}
              </p>
            </div>
          ) : (
            <div className="ac-field">
              <label className="ac-label" htmlFor="question-options">
                {t('settings.questions.options')}
              </label>
              <textarea
                id="question-options"
                className="ac-textarea"
                rows={4}
                value={questionEditor.optionsText}
                onChange={(event) =>
                  setQuestionEditor((current) =>
                    current ? { ...current, optionsText: event.target.value } : current,
                  )
                }
              />
              <span className="ac-sub">{t('settings.questions.optionsHint')}</span>
            </div>
          )}

          {questionError ? (
            <span className="ac-field-error" role="alert">
              {questionError}
            </span>
          ) : null}
        </Modal>
      ) : null}

      {endOpen ? (
        <Modal
          title={t('settings.end.dialogTitle')}
          closeLabel={t('common.close')}
          onClose={() => setEndOpen(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setEndOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-d"
                disabled={endText.trim() !== settings.title.trim()}
                onClick={confirmTerminate}
              >
                {t('settings.end.dialogConfirm')}
              </button>
            </>
          }
        >
          <span className="ac-sub">{t('settings.end.dialogText')}</span>
          <p className="ac-dialog-study-title">{settings.title}</p>
          <input
            className="ac-input"
            placeholder={t('settings.end.dialogPlaceholder')}
            value={endText}
            onChange={(event) => setEndText(event.target.value)}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function editorIsNew(editor: QuestionEditor): boolean {
  return editor.id === null
}
