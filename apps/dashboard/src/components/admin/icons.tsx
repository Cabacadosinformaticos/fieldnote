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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function MailIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-10 5L2 7" />
    </svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <svg width={22} height={22} {...stroke} {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <svg width={22} height={22} {...stroke} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg width={18} height={18} {...stroke} {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <svg width={22} height={22} {...stroke} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <svg width={16} height={16} {...stroke} {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg width={20} height={20} {...stroke} {...props}>
      <path d="M20 6 9 17l-5-5" />
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
