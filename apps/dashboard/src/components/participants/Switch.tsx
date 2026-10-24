export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? 'pts-switch is-on' : 'pts-switch'}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="pts-switch-knob" />
    </button>
  )
}
