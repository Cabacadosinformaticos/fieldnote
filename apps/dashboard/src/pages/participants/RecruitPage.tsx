import { useMemo, useState } from 'react'
import '../../styles/participants.css'
import { Link, useParams } from 'react-router-dom'
import {
  ParticipantsApiError,
  usePoolCount,
  useSendPoolInvitations,
  useStudy,
  useStudyMembers,
  type PoolCriteria,
} from '../../api/participants'
import { emailDisplayName, formatDate } from '../../components/participants/format'
import ParticipantsTabs from '../../components/participants/ParticipantsTabs'
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  InfoIcon,
  PlusIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserPlusIcon,
  UsersIcon,
} from '../../components/participants/icons'
import { LogoMark } from '../../components/icons'
import { errorKey, t } from '../../i18n/participants'

interface Option {
  id: string
  label: string
}

type AgeBand = NonNullable<PoolCriteria['age_band']>
type Occupation = NonNullable<PoolCriteria['occupation']>

const initialCounties: Option[] = [
  { id: 'Lisboa', label: 'Lisboa' },
  { id: 'Amadora', label: 'Amadora' },
  { id: 'Odivelas', label: 'Odivelas' },
]

const extraCounties: Option[] = [
  { id: 'Setúbal', label: 'Setúbal' },
  { id: 'Sintra', label: 'Sintra' },
  { id: 'Loures', label: 'Loures' },
]

const situations: { id: Occupation; label: string }[] = [
  { id: 'student', label: 'Estudante' },
  { id: 'employee', label: 'Trabalhador por conta de outrem' },
  { id: 'self_employed', label: 'Trabalhador por conta própria' },
  { id: 'unemployed', label: 'Desempregado' },
  { id: 'retired', label: 'Reformado' },
  { id: 'other', label: 'Outra' },
]

const ages: { id: AgeBand; label: string }[] = [
  { id: '18-24', label: '18-24' },
  { id: '25-34', label: '25-34' },
  { id: '35-44', label: '35-44' },
  { id: '45-54', label: '45-54' },
  { id: '55-64', label: '55-64' },
  { id: '65+', label: '65 ou mais' },
]

type OtherKey = 'gender' | 'transport' | 'language' | 'freguesia'

const otherFields: { key: OtherKey; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'gender',
    label: 'Género',
    options: [
      { value: '', label: 'Qualquer' },
      { value: 'female', label: 'Feminino' },
      { value: 'male', label: 'Masculino' },
      { value: 'other', label: 'Outro' },
    ],
  },
  {
    key: 'transport',
    label: 'Como se desloca',
    options: [
      { value: '', label: 'Qualquer' },
      { value: 'walking', label: 'A pé' },
      { value: 'public_transport', label: 'Transporte público' },
      { value: 'car', label: 'Carro' },
      { value: 'bicycle', label: 'Bicicleta' },
      { value: 'scooter', label: 'Tro tinete' },
      { value: 'other', label: 'Outro' },
    ],
  },
  {
    key: 'language',
    label: 'Línguas',
    options: [
      { value: '', label: 'Qualquer' },
      { value: 'pt', label: 'Português' },
      { value: 'en', label: 'Inglês' },
    ],
  },
  {
    key: 'freguesia',
    label: 'Freguesia',
    options: [
      { value: '', label: 'Qualquer' },
      { value: 'Estrela', label: 'Estrela' },
      { value: 'Misericórdia', label: 'Misericórdia' },
      { value: 'Ajuda', label: 'Ajuda' },
    ],
  },
]

const initialOther: Record<OtherKey, string> = {
  gender: '',
  transport: '',
  language: '',
  freguesia: '',
}

export default function RecruitPage() {
  const { studyId = '' } = useParams<{ studyId: string }>()
  const [counties, setCounties] = useState(initialCounties)
  const [county, setCounty] = useState<string | null>('Lisboa')
  const [situation, setSituation] = useState<Occupation | null>('student')
  const [age, setAge] = useState<AgeBand | null>('18-24')
  const [other, setOther] = useState(initialOther)

  const criteria: PoolCriteria = useMemo(
    () => ({
      concelho: county,
      occupation: situation,
      age_band: age,
      gender: (other.gender || null) as PoolCriteria['gender'],
      usual_transport: (other.transport || null) as PoolCriteria['usual_transport'],
      language: (other.language || null) as PoolCriteria['language'],
      freguesia: other.freguesia || null,
    }),
    [county, situation, age, other],
  )

  const countQuery = usePoolCount(studyId, criteria)
  const send = useSendPoolInvitations(studyId)
  const studyQuery = useStudy(studyId)
  const membersQuery = useStudyMembers(studyId)
  const study = studyQuery.data
  const teamLabel =
    (membersQuery.data ?? [])
      .map((member) => emailDisplayName(member.email))
      .join(', ') || '–'
  const datesLabel =
    study?.starts_on || study?.ends_on
      ? t('poster.dateRange', {
          start: formatDate(study.starts_on),
          end: formatDate(study.ends_on),
        })
      : '–'
  const count = countQuery.data?.count ?? null
  const known = typeof count === 'number'
  const bar = typeof count === 'number' ? Math.min(100, (count / 50) * 100) : 0
  const sendError =
    send.error instanceof ParticipantsApiError ? send.error.code : null

  const toggleCounty = (id: string) => {
    setCounty((current) => (current === id ? null : id))
  }

  return (
    <div className="pts-page">
      <header className="pts-page-head">
        <div>
          <h1 className="page-title">{t('tabs.recruit')}</h1>
          <p className="sub pts-lead">{t('recruit.subtitle')}</p>
        </div>
      </header>

      <ParticipantsTabs studyId={studyId} />

      <div className="recruit-layout">
        <div className="recruit-main">
          <section className="card pts-control-card" aria-labelledby="recruit-criteria-title">
            <div className="pts-section-head">
              <div>
                <h2 className="h2" id="recruit-criteria-title">
                  {t('recruit.criteria')}
                </h2>
                <p className="sub">{t('recruit.criteriaSub')}</p>
              </div>
            </div>

            <div className="pts-chip-group">
              <div className="pts-chip-head">
                <span className="pts-label">{t('recruit.county')}</span>
                <small>{t('recruit.selectOne')}</small>
              </div>
              <div className="pts-chips">
                {counties.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={county === item.id ? 'pts-chip is-selected' : 'pts-chip'}
                    aria-pressed={county === item.id}
                    onClick={() => toggleCounty(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
                {counties.length === initialCounties.length ? (
                  <button
                    type="button"
                    className="pts-chip is-dashed"
                    onClick={() => setCounties([...counties, ...extraCounties])}
                  >
                    <PlusIcon />
                    {t('action.addCounty')}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="pts-chip-group">
              <div className="pts-chip-head">
                <span className="pts-label">{t('recruit.situation')}</span>
                <small>{t('recruit.selectOne')}</small>
              </div>
              <div className="pts-chips">
                {situations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={situation === item.id ? 'pts-chip is-selected' : 'pts-chip'}
                    aria-pressed={situation === item.id}
                    onClick={() =>
                      setSituation((current) => (current === item.id ? null : item.id))
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pts-chip-group">
              <div className="pts-chip-head">
                <span className="pts-label">{t('recruit.age')}</span>
                <small>{t('recruit.selectOne')}</small>
              </div>
              <div className="pts-chips">
                {ages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={age === item.id ? 'pts-chip is-selected' : 'pts-chip'}
                    aria-pressed={age === item.id}
                    onClick={() => setAge((current) => (current === item.id ? null : item.id))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pts-chip-group">
              <div className="pts-chip-head">
                <span className="pts-label">{t('recruit.other')}</span>
                <small>{t('recruit.otherHint')}</small>
              </div>
              <div className="pts-other-list">
                {otherFields.map((field) => (
                  <label className="pts-other-row" key={field.key}>
                    <span>{field.label}</span>
                    <span className="pts-select-wrap">
                      <select
                        value={other[field.key]}
                        onChange={(event) =>
                          setOther((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon />
                    </span>
                  </label>
                ))}
              </div>
              <p className="pts-help">{t('recruit.otherHelp')}</p>
            </div>
          </section>

          <section className="card recruit-preview-card" aria-labelledby="recruit-preview-title">
            <div className="pts-section-head">
              <div>
                <h2 className="h2" id="recruit-preview-title">
                  {t('recruit.preview')}
                </h2>
                <p className="sub">{t('recruit.previewSub')}</p>
              </div>
            </div>

            <div className="recruit-preview-grid">
              <div className="recruit-preview-col">
                <span className="pts-label">{t('recruit.notice')}</span>
                <div className="recruit-notice">
                  <span className="recruit-notice-logo">
                    <LogoMark width={26} height={30} />
                  </span>
                  <span>{t('recruit.noticeText')}</span>
                </div>
                <p className="pts-help">{t('recruit.noticeHelp')}</p>
              </div>

              <div className="recruit-preview-col">
                <span className="pts-label">{t('recruit.card')}</span>
                <div className="recruit-invite-card">
                  <span className="recruit-card-kicker">{t('recruit.cardKicker')}</span>
                  <h3>{study?.title ?? t('poster.unknownStudy')}</h3>
                  <dl>
                    <div>
                      <dt>{t('recruit.team')}</dt>
                      <dd>{teamLabel}</dd>
                    </div>
                    <div>
                      <dt>{t('recruit.dates')}</dt>
                      <dd>{datesLabel}</dd>
                    </div>
                    <div>
                      <dt>{t('recruit.requests')}</dt>
                      <dd>
                        {study
                          ? t('recruit.requestsValue', { max: study.max_prompts_per_day })
                          : t('table.dash')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('recruit.entries')}</dt>
                      <dd>{t('recruit.entriesValue')}</dd>
                    </div>
                  </dl>
                  <p className="recruit-why">
                    {county ? t('recruit.why', { county }) : t('recruit.whyNoCounty')}
                  </p>
                  <p className="recruit-validity">{t('recruit.validity')}</p>
                  <div className="recruit-card-actions">
                    <span className="btn btn-p">{t('recruit.accept')}</span>
                    <span className="btn">{t('recruit.decline')}</span>
                    <span className="recruit-later">{t('recruit.later')}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="recruit-side" aria-label={t('recruit.matchTitle')}>
          <section className="card recruit-count-card" aria-labelledby="recruit-match-title">
            <div className="recruit-count-top">
              <h2 className="h2" id="recruit-match-title">
                {t('recruit.matchTitle')}
              </h2>
              <span className="pill ok recruit-live">{t('recruit.changing')}</span>
            </div>

            <div className="recruit-big-row">
              {countQuery.isLoading ? (
                <strong className="recruit-big is-small">{t('recruit.counting')}</strong>
              ) : (
                <>
                  <strong className={known ? 'recruit-big' : 'recruit-big is-small'}>
                    {known ? count : t('recruit.matchUnder')}
                  </strong>
                  {known ? <span>{t('recruit.people')}</span> : null}
                </>
              )}
            </div>

            <div
              className="recruit-meter"
              role="img"
              aria-label={t('recruit.match', { count: count ?? 0 })}
            >
              <span className="recruit-meter-fill" style={{ width: `${bar}%` }} />
              <i className="recruit-meter-marker" />
            </div>
            <div className="recruit-meter-labels">
              <span>0</span>
              <span className="recruit-minimum-label">{t('recruit.minimum')}</span>
              <span>50</span>
            </div>

            {countQuery.isError ? (
              <p className="pts-error">{t('recruit.countError')}</p>
            ) : (
              <div className={known ? 'recruit-status is-ok' : 'recruit-status is-warning'}>
                {known ? <ShieldCheckIcon /> : <InfoIcon />}
                <span>{known ? t('recruit.aboveMinimum') : t('recruit.belowMinimum')}</span>
              </div>
            )}
            <p className="pts-help">{t('recruit.belowMinimum')}</p>
          </section>

          <section className="card recruit-send-card" aria-labelledby="recruit-send-title">
            <h2 className="h2" id="recruit-send-title">
              {t('recruit.send')}
            </h2>
            <ul className="recruit-send-list">
              <li>
                <ClockIcon />
                <span>{t('recruit.sendBullet1')}</span>
              </li>
              <li>
                <CalendarIcon />
                <span>
                  {study?.starts_on
                    ? t('recruit.sendBullet2', { date: formatDate(study.starts_on) })
                    : t('recruit.sendBullet2NoDate')}
                </span>
              </li>
              <li>
                <UsersIcon />
                <span>{t('recruit.sendBullet3')}</span>
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-p recruit-send"
              disabled={!known || send.isPending || send.isSuccess}
              onClick={() => send.mutate(criteria)}
            >
              <UserPlusIcon />
              {known
                ? t('action.sendInvites', { count: count ?? 0 })
                : t('action.sendInvitesUnder')}
            </button>
            {send.isSuccess ? (
              <p className="pts-success">{t('recruit.sentCount', { count: send.data.sent })}</p>
            ) : null}
            {sendError ? <p className="pts-error">{t(errorKey(sendError))}</p> : null}
            <p className="pts-help">{t('recruit.sendNote')}</p>
          </section>

          <section className="card pts-info-card recruit-info-card">
            <div className="pts-info-head">
              <ShieldCheckIcon />
              <h2 className="h2">{t('recruit.privacyTitle')}</h2>
            </div>
            <p className="sub">{t('recruit.privacyText')}</p>
          </section>

          <section className="card pts-info-card recruit-info-card">
            <div className="pts-info-head">
              <TicketIcon />
              <h2 className="h2">{t('recruit.byCode')}</h2>
            </div>
            <p className="sub">{t('recruit.byCodeText')}</p>
            <Link className="btn btn-sm" to={`/estudos/${studyId}/participantes/adicionar`}>
              {t('action.addParticipant')}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
