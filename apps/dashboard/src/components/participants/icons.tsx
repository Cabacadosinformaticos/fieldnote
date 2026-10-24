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

export function PlusIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2.1} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2} {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function EllipsisIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2.2} {...props}>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
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

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M10.3 3.7 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} strokeWidth={2} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function UserPlusIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6M22 11h-6" />
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

export function UserMinusIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M22 11h-6" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
    </svg>
  )
}

export function TicketIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M3 9a2.5 2.5 0 0 0 0 6v3h18v-3a2.5 2.5 0 0 1 0-6V6H3Z" />
      <path d="M13 6v2M13 11v2M13 16v2" />
    </svg>
  )
}

export function PrinterIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  )
}

export function CopyIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect x="3" y="5" width="18" height="17" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M20 12c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 19.5 4 17 4 12V5a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 11 2 2 4-4" />
    </svg>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg width={16} height={16} {...stroke} strokeWidth={2} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg width={16} height={16} {...stroke} strokeWidth={2.4} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
