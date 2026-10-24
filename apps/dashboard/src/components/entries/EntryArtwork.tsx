import {
  entryPalettes,
  type Entry,
  type EntryPaletteName,
  type ScaleAnswer,
} from '../../fake/entries'
import { t } from '../../i18n/entries'
import { AlertTriangleIcon, PlayIcon, RefreshIcon } from './EntryIcons'

export function ScenicFrame({
  palette = 'teal',
  className,
}: {
  palette?: EntryPaletteName
  className?: string
}) {
  const colors = entryPalettes[palette]

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
          <Face key={label} mood={index} chosen={index + 1 === scale.value} />
        ))}
      </span>
    )
  }

  return (
    <span className="en-scale-dots" role="img" aria-label={`${scale.value} de ${scale.points}`}>
      {scale.labels.map((label, index) => (
        <i key={label} className={index + 1 <= scale.value ? 'is-filled' : ''} />
      ))}
    </span>
  )
}

export default function EntryArtwork({ entry, retrying }: { entry: Entry; retrying?: boolean }) {
  const processing = entry.status === 'processing' || retrying
  const failed = entry.status === 'failed' && !retrying

  if (processing) {
    return (
      <div className="en-art en-art-state">
        <RefreshIcon width={26} height={26} />
        <span>{t('list.processingTitle')}</span>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="en-art en-art-state en-art-state-failed">
        <AlertTriangleIcon width={26} height={26} />
        <span>{t('list.failedTitle')}</span>
      </div>
    )
  }

  if (entry.kind === 'text') {
    return (
      <div className="en-art en-art-text">
        <p>{entry.text ?? entry.excerpt}</p>
      </div>
    )
  }

  if (entry.kind === 'scale' && entry.scale) {
    return (
      <div className="en-art en-art-scale">
        <span className="en-scale-number">
          {entry.scale.value}
          <span> de {entry.scale.points}</span>
        </span>
        <ScaleDots scale={entry.scale} />
      </div>
    )
  }

  if (entry.kind === 'audio') {
    return (
      <div className="en-art en-art-audio">
        <Waveform />
        {entry.duration ? <span className="en-duration">{entry.duration}</span> : null}
      </div>
    )
  }

  return (
    <div className="en-art">
      <ScenicFrame palette={entry.palette} className="en-scenic" />
      {entry.kind === 'video' ? (
        <span className="en-art-play">
          <PlayIcon width={18} height={18} />
        </span>
      ) : null}
      {entry.kind === 'video' && entry.duration ? (
        <span className="en-duration">{entry.duration}</span>
      ) : null}
    </div>
  )
}
