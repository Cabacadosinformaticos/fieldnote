import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function CameraIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function TextTypeIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  )
}

export function VideoIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="m22 8-6 4 6 4V8z" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  )
}

export function AudioIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
    </svg>
  )
}

export function ScaleIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </svg>
  )
}

export function PencilIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M5 12h14M12 5v14" />
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}

export function WarningIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export function MapPinIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function FaceIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </svg>
  )
}

export function TextLinesIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M17 6H3M21 12H3M15.5 18H3" />
    </svg>
  )
}

export function SliderIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M3 12h18" />
      <circle cx="14" cy="12" r="3" fill="currentColor" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function GripIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  )
}

export function XIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function QrIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM21 14v.01M14 21h.01M21 17v4h-4" />
    </svg>
  )
}
