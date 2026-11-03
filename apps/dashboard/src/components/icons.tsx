import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export function LogoMark({ width = 26, height = 30 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 76 92" aria-hidden="true">
      <rect x="0" y="0" width="76" height="92" rx="10" fill="var(--fn-color-primary)" />
      <rect x="0" y="0" width="16" height="92" rx="6" fill="var(--fn-color-primary-strong)" />
      <line
        x1="28"
        y1="26"
        x2="64"
        y2="26"
        stroke="var(--fn-color-white)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <line
        x1="28"
        y1="42"
        x2="56"
        y2="42"
        stroke="var(--fn-color-white)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M52 52c-9.4 0-17 7.2-17 16.2C35 80 52 92 52 92s17-12 17-23.8C69 59.2 61.4 52 52 52z"
        fill="var(--fn-color-warning)"
      />
    </svg>
  )
}

export function OverviewIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  )
}

export function PlanIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export function ActivitiesIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8M13 12h8M13 18h8" />
    </svg>
  )
}

export function ParticipantsIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function EntriesIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}

export function ExportIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  )
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function KeyIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 8.3-8.3M16 4l3 3M14 6l3 3" />
    </svg>
  )
}

export function SignOutIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}

export function UpDownIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2} {...props}>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg width={14} height={14} {...stroke} strokeWidth={2} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function FolderIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2} {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  )
}

export function ErasureIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="17" x2="22" y1="8" y2="13" />
      <line x1="22" x2="17" y1="8" y2="13" />
    </svg>
  )
}

export function PoolIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2} {...props}>
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} strokeWidth={2.2} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function EyeIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
