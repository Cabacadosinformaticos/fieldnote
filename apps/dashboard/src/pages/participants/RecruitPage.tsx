import { useState } from 'react'
import '../../styles/participants.css'
import { Link, useParams } from 'react-router-dom'
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
import {
  recruitAges,
  recruitCounties,
  recruitOtherFilters,
  recruitSituations,
} from '../../fake/participants'
import { t } from '../../i18n/participants'

const extraCounties = [
  { id: 'setubal', label: 'Setúbal', selected: false },
  { id: 'sintra', label: 'Sintra', selected: false },
  { id: 'loures', label: 'Loures', selected: false },
]

const otherOptions: Record<string, string[]> = {
  'Género': ['Qualquer', 'Feminino', 'Masculino', 'Outro'],
  'Como se desloca': ['Qualquer', 'A pé', 'Transporte público', 'Bicicleta', 'Carro'],
  'Línguas': ['Qualquer', 'Português', 'Inglês'],
  'Freguesia': ['Qualquer', 'Estrela', 'Misericórdia', 'Ajuda'],
}

const initialOtherValues: Record<string, string> = Object.fromEntries(
  recruitOtherFilters.map((name) => [name, 'Qualquer']),
)

export default function RecruitPage() {
  const { studyId = 'jardim-da-estrela' } = useParams<{ studyId: string }>()
  const [counties, setCounties] = useState(recruitCounties)
  const [situations, setSituations] = useState(recruitSituations)
  const [ages, setAges] = useState(recruitAges)
  const [otherValues, setOtherValues] = useState(initialOtherValues)
  const [sent, setSent] = useState(false)

  const raw =
    counties.filter((item) => item.selected).length * 10 +
    situations.filter((item) => item.selected).length * 3 +
    ages.filter((item) => item.selected).length * 2
  const otherFilled = Object.values(otherValues).filter((value) => value !== 'Qualquer').length
  const count = Math.max(0, raw - otherFilled * 4)
  const known = count >= 5
  const bar = Math.min(100, (count / 50) * 100)

  const toggleCounty = (id: string) => {
    setCounties((current) =>
      current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }

  const toggleSituation = (id: string) => {
    setSituations((current) =>
      current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }

  const toggleAge = (id: string) => {
    setAges((current) =>
      current.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
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
                <small>{t('recruit.countyHint')}</small>
              </div>
              <div className="pts-chips">
                {counties.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.selected ? 'pts-chip is-selected' : 'pts-chip'}
                    aria-pressed={item.selected}
                    onClick={() => toggleCounty(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
                {counties.length === recruitCounties.length ? (
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
              </div>
              <div className="pts-chips">
                {situations.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.selected ? 'pts-chip is-selected' : 'pts-chip'}
                    aria-pressed={item.selected}
                    onClick={() => toggleSituation(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pts-chip-group">
              <div className="pts-chip-head">
                <span className="pts-label">{t('recruit.age')}</span>
              </div>
              <div className="pts-chips">
                {ages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={item.selected ? 'pts-chip is-selected' : 'pts-chip'}
                    aria-pressed={item.selected}
                    onClick={() => toggleAge(item.id)}
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
                {recruitOtherFilters.map((name) => (
                  <label className="pts-other-row" key={name}>
                    <span>{name}</span>
                    <span className="pts-select-wrap">
                      <select
                        value={otherValues[name]}
                        onChange={(event) =>
                          setOtherValues((current) => ({ ...current, [name]: event.target.value }))
                        }
                      >
                        {otherOptions[name].map((option) => (
                          <option key={option}>{option}</option>
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
                  <h3>{t('recruit.studyName')}</h3>
                  <dl>
                    <div>
                      <dt>{t('recruit.team')}</dt>
                      <dd>{t('recruit.teamValue')}</dd>
                    </div>
                    <div>
                      <dt>{t('recruit.dates')}</dt>
                      <dd>{t('recruit.datesValue')}</dd>
                    </div>
                    <div>
                      <dt>{t('recruit.requests')}</dt>
                      <dd>{t('recruit.requestsValue')}</dd>
                    </div>
                    <div>
                      <dt>{t('recruit.entries')}</dt>
                      <dd>{t('recruit.entriesValue')}</dd>
                    </div>
                  </dl>
                  <p className="recruit-why">{t('recruit.why')}</p>
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
              <strong className={known ? 'recruit-big' : 'recruit-big is-small'}>
                {known ? count : t('recruit.matchUnder')}
              </strong>
              {known ? <span>{t('recruit.people')}</span> : null}
            </div>

            <div className="recruit-meter" role="img" aria-label={t('recruit.match', { count })}>
              <span className="recruit-meter-fill" style={{ width: `${bar}%` }} />
              <i className="recruit-meter-marker" />
            </div>
            <div className="recruit-meter-labels">
              <span>0</span>
              <span className="recruit-minimum-label">{t('recruit.minimum')}</span>
              <span>50</span>
            </div>

            <div className={known ? 'recruit-status is-ok' : 'recruit-status is-warning'}>
              {known ? <ShieldCheckIcon /> : <InfoIcon />}
              <span>{known ? t('recruit.aboveMinimum') : t('recruit.belowMinimum')}</span>
            </div>
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
                <span>{t('recruit.sendBullet2')}</span>
              </li>
              <li>
                <UsersIcon />
                <span>{t('recruit.sendBullet3')}</span>
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-p recruit-send"
              disabled={!known || sent}
              onClick={() => setSent(true)}
            >
              <UserPlusIcon />
              {known ? t('action.sendInvites', { count }) : t('action.sendInvitesUnder')}
            </button>
            {sent ? <p className="pts-success">{t('recruit.sent')}</p> : null}
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
