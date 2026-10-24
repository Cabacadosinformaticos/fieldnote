type ToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={checked ? 'ac-switch ac-switch-on' : 'ac-switch ac-switch-off'}
      onClick={() => onChange(!checked)}
    >
      <span className="ac-switch-knob" aria-hidden="true" />
    </button>
  )
}
