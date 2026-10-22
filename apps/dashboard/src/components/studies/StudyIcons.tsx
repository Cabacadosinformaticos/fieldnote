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

export function PlusIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function FileTextIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8" />
    </svg>
  )
}

export function StopIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  )
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function CalendarAlertIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M10 16l4-4M14 16l-4-4" />
    </svg>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  )
}

export function BanIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M4.9 4.9l14.2 14.2" />
    </svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg width={16} height={16} {...stroke} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function UploadIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
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

export function LightbulbIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
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
