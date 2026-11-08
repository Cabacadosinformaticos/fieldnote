import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  GripIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  WarningIcon,
  XIcon,
} from '../../components/activities/ActivityIcons'
import Modal from '../../components/activities/Modal'
import { useActivities } from '../../api/activities'
import {
  statusFromApi,
  studiesErrorMessage,
  useAddStudyMember,
  useChangeStudyMemberRole,
  useCloseStudy,
  useCreateQuestion,
  useDeleteQuestion,
  useRemoveStudyMember,
  useReorderQuestions,
  useStudy,
  useStudyConsent,
  useStudyMembers,
  useStudyOverview,
  useStudyQuestions,
  useStudyRole,
  useUpdateQuestion,
  useUpdateStudy,
  type QuestionKind,
  type Study,
  type StudyQuestion,
  type StudyRole,
} from '../../api/studies'
import { formatDayMonthYear } from '../../components/studies/format'
import { t, type ActivitiesKey } from '../../i18n/activities'
import '../../styles/activities.css'

const scheduleStyles: {
  id: Study['schedule_style']
  label: ActivitiesKey
  hint: ActivitiesKey
}[] = [
  { id: 'fixed', label: 'settings.style.fixed', hint: 'settings.style.fixedHint' },
  { id: 'balanced', label: 'settings.style.balanced', hint: 'settings.style.balancedHint' },
  { id: 'varied', label: 'settings.style.varied', hint: 'settings.style.variedHint' },
]

const questionTypeLabels: Record<QuestionKind, ActivitiesKey> = {
  single_choice: 'settings.questions.single',
  multiple_choice: 'settings.questions.multiple',
  yes_no: 'settings.questions.yesno',
  short_text: 'settings.questions.shortText',
}

const questionTypePills: Record<QuestionKind, string> = {
  single_choice: 'pr',
  multiple_choice: 'pr',
  yes_no: 'ne',
  short_text: 'da',
}

const roleLabels: Record<StudyRole, ActivitiesKey> = {
  principal_investigator: 'settings.team.principal',
  co_investigator: 'settings.team.coInvestigator',
  member: 'settings.team.member',
}

const avatarTones = ['teal', 'amber', 'violet', 'blue']

type Draft = {
  title: string
  description: string
  endsOn: string
  scheduleStyle: Study['schedule_style']
  maxDay: string
  maxSlot: string
}

type QuestionEditor = {
  id: string | null
  text: string
  kind: QuestionKind
  optionsText: string
}

function isChoice(kind: QuestionKind): boolean {
  return kind === 'single_choice' || kind === 'multiple_choice'
}

function emailName(email: string): string {
  const localPart = email.split('@')[0] ?? email
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ') || email
  )
}

function emailInitials(email: string): string {
  const words = emailName(email).split(' ').filter(Boolean)
  return (
    words
      .map((word) => word.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NC'
  )
}

export default function StudySettingsPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()

  const studyQuery = useStudy(studyId)
  const activitiesQuery = useActivities(studyId)
  const access = useStudyRole(studyId)
  const membersQuery = useStudyMembers(studyId)
  const questionsQuery = useStudyQuestions(studyId)
  const consentQuery = useStudyConsent(studyId)
  const overviewQuery = useStudyOverview(studyId)

  const updateStudy = useUpdateStudy(studyId)
  const createQuestion = useCreateQuestion(studyId)
  const updateQuestion = useUpdateQuestion(studyId)
  const deleteQuestion = useDeleteQuestion(studyId)
  const reorderQuestions = useReorderQuestions(studyId)
  const addMember = useAddStudyMember(studyId)
  const changeRole = useChangeStudyMemberRole(studyId)
  const removeMember = useRemoveStudyMember(studyId)
  const closeStudy = useCloseStudy(studyId)

  const study = studyQuery.data
  const questions = questionsQuery.data ?? []
  const members = membersQuery.data ?? []
  const status = study ? statusFromApi(study.status) : 'draft'
  const closed = status === 'finished'
  const canManage = access.canManage && !closed
  const canDesign = access.canDesign && !closed
  const activeParticipants = overviewQuery.data?.participants.active

  const [draft, setDraft] = useState<Draft | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaboratorRole, setCollaboratorRole] = useState<StudyRole>('co_investigator')
  const [teamError, setTeamError] = useState('')
  const [questionEditor, setQuestionEditor] = useState<QuestionEditor | null>(null)
  const [questionError, setQuestionError] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [endOpen, setEndOpen] = useState(false)
  const [endText, setEndText] = useState('')

  useEffect(() => {
    if (!study) {
      return
    }
    setDraft({
      title: study.title,
      description: study.description ?? '',
      endsOn: study.ends_on ?? '',
      scheduleStyle: study.schedule_style,
      maxDay: String(study.max_prompts_per_day),
      maxSlot: String(study.max_prompts_per_slot),
    })
  }, [study])

  function patch(values: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...values } : current))
    setSaved(false)
    setSaveError('')
  }

  function saveStudy() {
    if (!draft || !canManage) {
      return
    }
    const maxDay = Number.parseInt(draft.maxDay, 10)
    const maxSlot = Number.parseInt(draft.maxSlot, 10)
    if (!draft.title.trim() || !Number.isFinite(maxDay) || !Number.isFinite(maxSlot) || maxDay < 1 || maxSlot < 1) {
      setSaveError(t('settings.plan.invalidLimits'))
      return
    }
    updateStudy.mutate(
      {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        ends_on: draft.endsOn || null,
        schedule_style: draft.scheduleStyle,
        max_prompts_per_day: maxDay,
        max_prompts_per_slot: maxSlot,
      },
      {
        onSuccess: () => {
          setSaved(true)
          setSaveError('')
        },
      },
    )
  }

  function addCollaborator() {
    const email = collaboratorEmail.trim()
    if (!email || !canManage) {
      return
    }
    addMember.mutate(
      { email, role: collaboratorRole },
      {
        onSuccess: () => {
          setCollaboratorEmail('')
          setTeamError('')
        },
      },
    )
  }

  function removeTeamMember(userId: string) {
    if (!canManage) {
      return
    }
    removeMember.mutate(userId)
  }

  function openNewQuestion() {
    setQuestionEditor({ id: null, text: '', kind: 'single_choice', optionsText: '' })
    setQuestionError('')
  }

  function openQuestion(question: StudyQuestion) {
    setQuestionEditor({
      id: question.id,
      text: question.text,
      kind: question.kind,
      optionsText: question.options.join('\n'),
    })
    setQuestionError('')
  }

  function saveQuestion() {
    if (!questionEditor || !canDesign) {
      return
    }
    const editor = questionEditor
    const text = editor.text.trim()
    const options = isChoice(editor.kind)
      ? editor.optionsText
          .split('\n')
          .map((option) => option.trim())
          .filter(Boolean)
      : []

    if (!text || (isChoice(editor.kind) && options.length < 2)) {
      setQuestionError(t('settings.questions.error'))
      return
    }

    const onSuccess = () => {
      setQuestionEditor(null)
      setQuestionError('')
    }

    if (editor.id) {
      updateQuestion.mutate(
        {
          questionId: editor.id,
          body: { text, kind: editor.kind, options },
        },
        { onSuccess },
      )
    } else {
      createQuestion.mutate({ text, kind: editor.kind, options }, { onSuccess })
    }
  }

  function removeQuestion(questionId: string) {
    if (!canDesign) {
      return
    }
    deleteQuestion.mutate(questionId)
  }

  function moveQuestion(index: number, delta: number) {
    if (!canDesign) {
      return
    }
    const to = index + delta
    if (to < 0 || to >= questions.length) {
      return
    }
    const ids = questions.map((question) => question.id)
    const [moved] = ids.splice(index, 1)
    ids.splice(to, 0, moved)
    reorderQuestions.mutate(ids)
  }

  function reorderQuestion(targetId: string) {
    if (!dragId || dragId === targetId || !canDesign) {
      setDragId(null)
      return
    }
    const ids = questions.map((question) => question.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from === -1 || to === -1) {
      setDragId(null)
      return
    }
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    reorderQuestions.mutate(ids)
    setDragId(null)
  }

  function confirmTerminate() {
    if (!study || endText.trim() !== study.title.trim()) {
      return
    }
    closeStudy.mutate(undefined, {
      onSuccess: () => {
        setEndOpen(false)
        setEndText('')
      },
    })
  }

  if (studyQuery.isLoading && !study) {
    return (
      <div className="ac-page">
        <p className="ac-sub">{t('state.loading')}</p>
      </div>
    )
  }

  if (!study || !draft) {
    return (
      <div className="ac-page">
        <div className="st-note st-note-error" role="alert">
          <span>{studiesErrorMessage(studyQuery.error)}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => void studyQuery.refetch()}
          >
            {t('state.retry')}
          </button>
        </div>
      </div>
    )
  }

  const statusNote =
    status === 'draft'
      ? 'settings.subtitleDraft'
      : status === 'finished'
        ? 'settings.subtitleClosed'
        : 'settings.subtitleRunning'
  const questionMutationError =
    createQuestion.error ?? updateQuestion.error ?? deleteQuestion.error ?? reorderQuestions.error
  const teamMutationError = addMember.error ?? changeRole.error ?? removeMember.error
  const requestsPerDay = (activitiesQuery.data ?? []).reduce(
    (total, activity) => total + activity.prompts_per_day,
    0,
  )

  return (
    <div className="ac-page">
      <header className="ac-header">
        <div className="ac-header-copy">
          <h1 className="ac-title">{t('settings.title')}</h1>
          <p className="ac-subtitle">
            {t('settings.subtitle', { study: study.title })} {t(statusNote)}
          </p>
        </div>
        <div className="ac-header-actions">
          <Link className="btn" to={`/estudos/${studyId}/visao-geral`}>
            {t('settings.cancel')}
          </Link>
          <button
            type="button"
            className="btn btn-p"
            disabled={!canManage || updateStudy.isPending}
            onClick={saveStudy}
          >
            {updateStudy.isPending ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </header>

      {!access.isLoading && !access.canManage ? (
        <p className="ac-info-box" role="status">
          <InfoIcon />
          <span>{closed ? t('settings.closedNote') : t('settings.readOnly')}</span>
        </p>
      ) : null}

      {closed && access.canManage ? (
        <p className="ac-info-box" role="status">
          <LockIcon width={16} height={16} />
          <span>{t('settings.closedNote')}</span>
        </p>
      ) : null}

      {saved ? (
        <p className="ac-saved-note" role="status">
          {t('settings.saved')}
        </p>
      ) : null}

      {saveError || updateStudy.error ? (
        <p className="ac-field-error" role="alert">
          {saveError || studiesErrorMessage(updateStudy.error)}
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
                value={draft.title}
                disabled={!canManage}
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
                value={draft.description}
                disabled={!canManage}
                onChange={(event) => patch({ description: event.target.value })}
              />
              <span className="ac-sub">{t('settings.field.descriptionHint')}</span>
            </div>

            <div className="ac-two-col">
              <div className="ac-field">
                <span className="ac-label">{t('settings.field.start')}</span>
                <div className="ac-locked-field">
                  <LockIcon width={16} height={16} />
                  {formatDayMonthYear(study.starts_on)}
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
                  type="date"
                  value={draft.endsOn}
                  disabled={!canManage}
                  onChange={(event) => patch({ endsOn: event.target.value })}
                />
                <span className="ac-sub">{t('settings.field.endHint')}</span>
              </div>
            </div>

            <div className="ac-field">
              <span className="ac-label">{t('settings.field.timezone')}</span>
              <div className="ac-locked-field">
                <LockIcon width={16} height={16} />
                {study.timezone}
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
                  const selected = draft.scheduleStyle === style.id
                  return (
                    <button
                      key={style.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={!canManage}
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
                  value={draft.maxDay}
                  disabled={!canManage}
                  onChange={(event) => patch({ maxDay: event.target.value })}
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
                  value={draft.maxSlot}
                  disabled={!canManage}
                  onChange={(event) => patch({ maxSlot: event.target.value })}
                />
                <span className="ac-sub">{t('settings.plan.maxPerWindowHint')}</span>
                {activeParticipants !== undefined ? (
                  <span className="ac-sub">
                    {t(
                      activeParticipants === 1
                        ? 'settings.plan.suggestedOne'
                        : 'settings.plan.suggested',
                      {
                        suggested: study?.max_prompts_per_slot ?? draft.maxSlot,
                        count: activeParticipants,
                      },
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.section.consent')}>
            <div className="ac-section-head">
              <div className="ac-section-heading">
                <h2 className="h2">{t('settings.section.consent')}</h2>
                <p className="ac-sub">
                  {consentQuery.data
                    ? t(
                        consentQuery.data.accepted === 1
                          ? 'settings.consent.subtitleOne'
                          : 'settings.consent.subtitle',
                        {
                          version: consentQuery.data.version,
                          count: consentQuery.data.accepted,
                        },
                      )
                    : t('state.loading')}
                </p>
              </div>
              {consentQuery.data ? (
                <span className="pill ok">
                  {t('settings.consent.pill', { version: consentQuery.data.version })}
                </span>
              ) : null}
            </div>

            <div className="ac-info-box">
              <InfoIcon />
              <span>
                {consentQuery.data
                  ? t('settings.consent.info', { version: consentQuery.data.version })
                  : t('settings.consent.dialogHint')}
              </span>
            </div>
          </section>

          <section className="card ac-section" aria-label={t('settings.section.questions')}>
            <div className="ac-section-head">
              <div className="ac-section-heading">
                <h2 className="h2">{t('settings.section.questions')}</h2>
                <p className="ac-sub">{t('settings.questions.subtitle')}</p>
              </div>
              <span className="pill ne">
                {questions.length === 1
                  ? t('settings.questions.countOne')
                  : t('settings.questions.count', { count: questions.length })}
              </span>
            </div>

            {!canDesign ? (
              <p className="ac-sub">{t('settings.questions.permission')}</p>
            ) : null}

            {questionsQuery.isLoading ? (
              <p className="ac-sub">{t('state.loading')}</p>
            ) : questions.length === 0 ? (
              <p className="ac-sub">{t('settings.questions.empty')}</p>
            ) : (
              <ol className="ac-question-list">
                {questions.map((question, index) => (
                  <li
                    key={question.id}
                    className="ac-question-item"
                    draggable={canDesign}
                    onDragStart={() => canDesign && setDragId(question.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderQuestion(question.id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    <button
                      type="button"
                      className="ac-grip"
                      disabled={!canDesign}
                      aria-label={t('settings.questions.reorderAria', { number: index + 1 })}
                    >
                      <GripIcon />
                    </button>
                    <div className="ac-question-copy">
                      <div className="ac-question-title-row">
                        <span className="ac-question-title">
                          {index + 1}. {question.text}
                        </span>
                        <span className={`pill ${questionTypePills[question.kind]}`}>
                          {t(questionTypeLabels[question.kind])}
                        </span>
                      </div>
                      <span className="ac-sub">{question.options.join(' · ')}</span>
                    </div>
                    <div className="ac-question-actions">
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        disabled={!canDesign || index === 0 || reorderQuestions.isPending}
                        aria-label={t('settings.questions.moveUpAria', { number: index + 1 })}
                        onClick={() => moveQuestion(index, -1)}
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        disabled={
                          !canDesign ||
                          index === questions.length - 1 ||
                          reorderQuestions.isPending
                        }
                        aria-label={t('settings.questions.moveDownAria', { number: index + 1 })}
                        onClick={() => moveQuestion(index, 1)}
                      >
                        <span aria-hidden="true">↓</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        disabled={!canDesign}
                        aria-label={t('settings.questions.editAria', { number: index + 1 })}
                        onClick={() => openQuestion(question)}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        disabled={!canDesign || deleteQuestion.isPending}
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
              <button type="button" className="btn" disabled={!canDesign} onClick={openNewQuestion}>
                <PlusIcon />
                {t('settings.questions.add')}
              </button>
            </div>

            {questionMutationError ? (
              <p className="ac-field-error" role="alert">
                {studiesErrorMessage(questionMutationError)}
              </p>
            ) : null}

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
              {members.length === 0 ? (
                <p className="ac-sub">{t('settings.team.empty')}</p>
              ) : null}
              {members.map((member, index) => (
                <div className="ac-team-row" key={member.user_id}>
                  <span className={`ac-avatar ac-avatar-${avatarTones[index % avatarTones.length]}`}>
                    {emailInitials(member.email)}
                  </span>
                  <div className="ac-team-copy">
                    <span className="ac-team-name">{emailName(member.email)}</span>
                    <span className="ac-team-note">{member.email}</span>
                  </div>
                  {canManage ? (
                    <div className="ac-team-actions">
                      <select
                        className="ac-input ac-role-select"
                        aria-label={t('settings.team.role')}
                        value={member.role}
                        disabled={changeRole.isPending}
                        onChange={(event) =>
                          changeRole.mutate({
                            userId: member.user_id,
                            role: event.target.value as StudyRole,
                          })
                        }
                      >
                        {(Object.keys(roleLabels) as StudyRole[]).map((role) => (
                          <option key={role} value={role}>
                            {t(roleLabels[role])}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-sm ac-icon-only"
                        disabled={removeMember.isPending}
                        aria-label={t('settings.team.removeAria', {
                          name: emailName(member.email),
                        })}
                        onClick={() => removeTeamMember(member.user_id)}
                      >
                        <XIcon width={16} height={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="pill ne">{t(roleLabels[member.role])}</span>
                  )}
                </div>
              ))}
            </div>

            {canManage ? (
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
                  <select
                    className="ac-input ac-role-select"
                    aria-label={t('settings.team.addRole')}
                    value={collaboratorRole}
                    onChange={(event) => setCollaboratorRole(event.target.value as StudyRole)}
                  >
                    {(Object.keys(roleLabels) as StudyRole[]).map((role) => (
                      <option key={role} value={role}>
                        {t(roleLabels[role])}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-p"
                    disabled={addMember.isPending}
                    onClick={addCollaborator}
                  >
                    {t('settings.team.add')}
                  </button>
                </div>
                {teamError ? (
                  <span className="ac-field-error" role="alert">
                    {teamError}
                  </span>
                ) : null}
                {teamMutationError ? (
                  <span className="ac-field-error" role="alert">
                    {studiesErrorMessage(teamMutationError)}
                  </span>
                ) : null}
                <span className="ac-sub">{t('settings.team.hint')}</span>
              </div>
            ) : null}
          </section>

          <section className="card ac-danger-card" aria-label={t('settings.section.end')}>
            <div className="ac-danger-head">
              <WarningIcon width={22} height={22} />
              <h2 className="ac-danger-title">{t('settings.section.end')}</h2>
            </div>
            {closed ? (
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
                  disabled={!access.canManage || status !== 'ongoing'}
                  onClick={() => setEndOpen(true)}
                >
                  {t('settings.end.button')}
                </button>
                <p className="ac-sub">
                  {status === 'ongoing' ? t('settings.end.hint') : t('settings.end.onlyRunning')}
                </p>
              </>
            )}
          </section>
        </div>
      </div>

      {questionEditor ? (
        <Modal
          title={
            questionEditor.id
              ? t('settings.questions.editTitle')
              : t('settings.questions.addTitle')
          }
          closeLabel={t('common.close')}
          onClose={() => setQuestionEditor(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setQuestionEditor(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-p"
                disabled={createQuestion.isPending || updateQuestion.isPending}
                onClick={saveQuestion}
              >
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
              value={questionEditor.kind}
              onChange={(event) =>
                setQuestionEditor((current) =>
                  current
                    ? { ...current, kind: event.target.value as QuestionKind }
                    : current,
                )
              }
            >
              {(Object.keys(questionTypeLabels) as QuestionKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {t(questionTypeLabels[kind])}
                </option>
              ))}
            </select>
          </div>

          {isChoice(questionEditor.kind) ? (
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
          ) : null}

          {questionError || createQuestion.error || updateQuestion.error ? (
            <span className="ac-field-error" role="alert">
              {questionError ||
                studiesErrorMessage(createQuestion.error ?? updateQuestion.error)}
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
                disabled={endText.trim() !== study.title.trim() || closeStudy.isPending}
                onClick={confirmTerminate}
              >
                {closeStudy.isPending ? t('settings.saving') : t('settings.end.dialogConfirm')}
              </button>
            </>
          }
        >
          <span className="ac-sub">{t('settings.end.dialogText')}</span>
          <p className="ac-dialog-study-title">{study.title}</p>
          <input
            className="ac-input"
            placeholder={t('settings.end.dialogPlaceholder')}
            value={endText}
            onChange={(event) => setEndText(event.target.value)}
          />
          {closeStudy.error ? (
            <span className="ac-field-error" role="alert">
              {studiesErrorMessage(closeStudy.error)}
            </span>
          ) : null}
        </Modal>
      ) : null}
    </div>
  )
}
