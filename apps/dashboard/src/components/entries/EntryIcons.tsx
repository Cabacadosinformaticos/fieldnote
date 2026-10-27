import type { ComponentType, SVGProps } from 'react'
import type { EntryType, TimelineKind } from './entryMeta'

export type IconProps = SVGProps<SVGSVGElement>

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function PhotoIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m22 8-6 4 6 4V8z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  )
}

export function AudioIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
    </svg>
  )
}

export function TextIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  )
}

export function ScaleIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}

export function RequestIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

export function RowsIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

export function TimelineIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M8 6h10M6 12h9M11 18h7" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

export function FullscreenIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

export function TagIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
      <path d="M7 7h.01" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M5 12h14M12 5v14" />
    </svg>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7l3-2.7M21 21v-5h-5" />
    </svg>
  )
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="m12 2 10 5-10 5L2 7z" />
      <path d="m2 17 10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

const kindIcons: Record<Exclude<TimelineKind, 'request'>, ComponentType<IconProps>> = {
  photo: PhotoIcon,
  video: VideoIcon,
  audio: AudioIcon,
  text: TextIcon,
  scale: ScaleIcon,
  choice: ChoiceIcon,
}

export function ChoiceIcon(props: IconProps) {
  return (
    <svg {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

export function EntryTypeIcon({
  kind,
  ...props
}: IconProps & { kind: EntryType | TimelineKind }) {
  const Icon = kind === 'request' ? RequestIcon : kindIcons[kind]
  return <Icon {...props} />
}
