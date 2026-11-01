import type { FeedItem } from '../../api/studies'

export default function EntryThumb({ item }: { item: FeedItem }) {
  if (item.kind === 'photo') {
    return (
      <svg width={52} height={52} viewBox="0 0 52 52" className="st-entry-thumb" aria-hidden="true">
        <rect width="52" height="52" fill={item.sky ?? '#CFE3EA'} />
        <circle cx="40" cy="12" r="5" fill="#E8B24A" />
        <rect y="34" width="52" height="18" fill={item.ground ?? '#7FA37E'} />
        <rect x="14" y="22" width="4" height="14" fill="#6B4F2E" />
        <ellipse cx="16" cy="20" rx="10" ry="9" fill={item.tree ?? '#3F7A55'} />
      </svg>
    )
  }

  if (item.kind === 'video') {
    return (
      <svg width={52} height={52} viewBox="0 0 52 52" className="st-entry-thumb" aria-hidden="true">
        <rect width="52" height="52" fill="#E7ECF7" />
        <rect x="8" y="12" width="36" height="28" rx="4" fill="#5B6B8C" />
        <path d="M22 19l12 7-12 7z" fill="#fff" />
      </svg>
    )
  }

  if (item.kind === 'text') {
    return (
      <svg width={52} height={52} viewBox="0 0 52 52" className="st-entry-thumb" aria-hidden="true">
        <rect width="52" height="52" fill="#EAF0FF" />
        <rect x="10" y="14" width="32" height="4" rx="2" fill="#6C8CF0" />
        <rect x="10" y="24" width="26" height="4" rx="2" fill="#6C8CF0" />
        <rect x="10" y="34" width="30" height="4" rx="2" fill="#6C8CF0" />
      </svg>
    )
  }

  return (
    <svg width={52} height={52} viewBox="0 0 52 52" className="st-entry-thumb" aria-hidden="true">
      <rect width="52" height="52" fill="#FFF3D6" />
      <rect x="9" y="22" width="4" height="8" rx="2" fill="#B96A00" />
      <rect x="16" y="15" width="4" height="22" rx="2" fill="#B96A00" />
      <rect x="23" y="19" width="4" height="14" rx="2" fill="#B96A00" />
      <rect x="30" y="11" width="4" height="30" rx="2" fill="#B96A00" />
      <rect x="37" y="20" width="4" height="12" rx="2" fill="#B96A00" />
    </svg>
  )
}
