import type { ActivityScaleDraft } from '../../api/activities'
import { t } from '../../i18n/activities'

const FACE_MOUTHS = [
  'M7.5 17.5c1-2.6 2.8-3.8 4.5-3.8s3.5 1.2 4.5 3.8',
  'M8.5 16.5c1-1.4 2.3-2 3.5-2s2.5.6 3.5 2',
  'M8.5 15.5h7',
  'M8.5 14.5c1 1.4 2.3 2 3.5 2s2.5-.6 3.5-2',
  'M7.5 13.5h9c0 2.6-2 4.5-4.5 4.5s-4.5-1.9-4.5-4.5z',
]

export default function ScalePreview({ scale }: { scale: ActivityScaleDraft }) {
  const { kind, points } = scale
  const isBar = kind === 'bar'
  const isText = kind === 'text'
  const oddOrBar = isBar || points % 2 === 1
  const low = scale.lowLabel
  const high = scale.highLabel
  const neutral = scale.midLabel.trim() || t('edit.scale.wordNeutral')

  const selectedNumber = Math.max(1, Math.min(points, Math.round((points * 5) / 7)))
  const faceIndexes = points === 3 ? [1, 2, 3] : [0, 1, 2, 3, 4]
  const selectedFace = points === 3 ? 2 : 3

  const words =
    points === 3
      ? [low, neutral, high]
      : points === 7
        ? [
            low,
            t('edit.scale.wordBad'),
            t('edit.scale.wordSlightlyBad'),
            neutral,
            t('edit.scale.wordSlightlyGood'),
            t('edit.scale.wordGood'),
            high,
          ]
        : [low, t('edit.scale.wordBad'), neutral, t('edit.scale.wordGood'), high]
  const selectedWord = points === 3 ? 2 : points === 5 ? 3 : 5

  return (
    <div className="ac-scale-preview">
      {kind === 'number' ? (
        <div
          className={
            points >= 10 ? 'ac-scale-numbers ac-scale-numbers-dense' : 'ac-scale-numbers'
          }
        >
          {Array.from({ length: points }, (_, index) => index + 1).map((number) => (
            <span
              key={number}
              className={number === selectedNumber ? 'ac-scale-num ac-scale-num-on' : 'ac-scale-num'}
            >
              {number}
            </span>
          ))}
        </div>
      ) : null}

      {kind === 'faces' ? (
        <div className="ac-scale-faces">
          {faceIndexes.map((mouth, index) => (
            <span
              key={mouth}
              className={index === selectedFace ? 'ac-scale-face ac-scale-face-on' : 'ac-scale-face'}
            >
              <svg
                width={36}
                height={36}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9 9.5h.01M15 9.5h.01" />
                <path d={FACE_MOUTHS[mouth]} />
              </svg>
            </span>
          ))}
        </div>
      ) : null}

      {isText ? (
        <div className="ac-scale-words">
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className={index === selectedWord ? 'ac-scale-word ac-scale-word-on' : 'ac-scale-word'}
            >
              {word}
            </span>
          ))}
        </div>
      ) : null}

      {isBar ? (
        <div className="ac-scale-bar" aria-hidden="true">
          <span className="ac-scale-bar-track" />
          <span className="ac-scale-bar-fill" />
          <span className="ac-scale-bar-thumb" />
          <span className="ac-scale-bar-value mono">62</span>
        </div>
      ) : null}

      {!isText ? (
        <div className="ac-scale-ends">
          <span>
            {isBar ? '0' : '1'} · {low}
          </span>
          <span className="ac-scale-ends-mid">{scale.midLabel && oddOrBar ? scale.midLabel : ''}</span>
          <span>
            {isBar ? '100' : points} · {high}
          </span>
        </div>
      ) : null}
    </div>
  )
}
