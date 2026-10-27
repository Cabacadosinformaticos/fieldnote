import { t } from '../../i18n/entries'
import {
  entryStatusOf,
  isFree,
  paletteFor,
  scaleAnswer,
  type EntryOut,
  type ScaleAnswer,
} from './entryMeta'
import { AlertTriangleIcon, PlayIcon, RefreshIcon } from './EntryIcons'

type Palette = ReturnType<typeof paletteFor>

export function ScenicFrame({
  palette,
  className,
}: {
  palette?: Palette
  className?: string
}) {
  const colors = palette ?? paletteFor('default')

  return (
    <svg
      className={className}
      viewBox="0 0 240 128"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="240" height="128" fill={colors.sky} />
      <circle cx="192" cy="30.72" r="15.36" fill={colors.sun} />
      <path d="M0 79.36Q60 57.6 120 76.8T240 70.4V128H0z" fill={colors.far} />
      <path d="M0 102.4Q72 87.04 144 102.4T240 97.28V128H0z" fill={colors.near} />
      <rect x="33.6" y="38.4" width="7.2" height="51.2" fill={colors.trunk} />
      <circle cx="37.2" cy="38.4" r="21.76" fill={colors.tree} />
      <circle cx="64.8" cy="48.64" r="14.08" fill={colors.tree2} />
    </svg>
  )
}

const WAVE_BARS = [10, 22, 14, 30, 38, 20, 44, 28, 16, 34, 42, 24, 12, 30, 20, 36, 14, 26, 18, 10]

export function Waveform({ color = '#0E7C66' }: { color?: string }) {
  return (
    <span className="en-wave" aria-hidden="true">
      {WAVE_BARS.map((height, index) => (
        <i key={index} style={{ height, background: color }} />
      ))}
    </span>
  )
}

const FACE_MOUTHS = [
  'M8.5 16.5c1-1.6 2.1-2.3 3.5-2.3s2.5.7 3.5 2.3',
  'M8.5 15.6h7',
  'M8.5 14.6c1 1.6 2.1 2.3 3.5 2.3s2.5-.7 3.5-2.3',
  'M8 14c1.2 2.4 2.6 3.5 4 3.5s2.8-1.1 4-3.5',
]

function Face({ mood, chosen }: { mood: number; chosen: boolean }) {
  return (
    <svg className={`en-face${chosen ? ' is-chosen' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.8" cy="9.4" r="1.2" fill="currentColor" />
      <circle cx="15.2" cy="9.4" r="1.2" fill="currentColor" />
      <path
        d={FACE_MOUTHS[Math.min(mood, FACE_MOUTHS.length - 1)]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ScaleDots({ scale }: { scale: ScaleAnswer }) {
  if (scale.type === 'faces') {
    return (
      <span className="en-scale-faces" role="img" aria-label={`${scale.value} de ${scale.points}`}>
        {scale.labels.map((label, index) => (
          <Face key={`${label}-${index}`} mood={index} chosen={index + 1 === scale.value} />
        ))}
      </span>
    )
  }

  return (
    <span className="en-scale-dots" role="img" aria-label={`${scale.value} de ${scale.points}`}>
      {scale.labels.map((label, index) => (
        <i key={`${label}-${index}`} className={index + 1 <= scale.value ? 'is-filled' : ''} />
      ))}
    </span>
  )
}

function textOf(entry: EntryOut): string {
  if (entry.entry_type === 'choice') {
    return entry.choice ?? ''
  }
  return entry.body ?? ''
}

export default function EntryArtwork({ entry, retrying }: { entry: EntryOut; retrying?: boolean }) {
  const status = retrying ? 'processing' : entryStatusOf(entry)
  const scale = scaleAnswer(entry)

  if (status === 'processing') {
    return (
      <div className="en-art en-art-state">
        <RefreshIcon width={26} height={26} />
        <span>{t('list.processingTitle')}</span>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="en-art en-art-state en-art-state-failed">
        <AlertTriangleIcon width={26} height={26} />
        <span>{t('list.failedTitle')}</span>
      </div>
    )
  }

  if (entry.entry_type === 'text' || entry.entry_type === 'choice') {
    return (
      <div className="en-art en-art-text">
        <p>{textOf(entry) || t('detail.mediaUnavailable')}</p>
      </div>
    )
  }

  if (entry.entry_type === 'scale' && scale) {
    return (
      <div className="en-art en-art-scale">
        <span className="en-scale-number">
          {scale.value}
          {scale.points > 0 ? <span> de {scale.points}</span> : null}
        </span>
        <ScaleDots scale={scale} />
      </div>
    )
  }

  if (entry.entry_type === 'audio') {
    return (
      <div className="en-art en-art-audio">
        <Waveform />
      </div>
    )
  }

  return (
    <div className="en-art">
      <ScenicFrame palette={paletteFor(entry.id)} className="en-scenic" />
      {entry.entry_type === 'video' ? (
        <span className="en-art-play">
          <PlayIcon width={18} height={18} />
        </span>
      ) : null}
      {isFree(entry) ? <span className="pill ne en-art-free">{t('list.free')}</span> : null}
    </div>
  )
}
