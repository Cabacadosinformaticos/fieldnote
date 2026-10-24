import { useEffect, useId, type ReactNode } from 'react'
import { XIcon } from './ActivityIcons'

type ModalProps = {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ title, closeLabel, onClose, children, footer }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="ac-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="ac-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="ac-modal-header">
          <h2 className="ac-modal-title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="ac-icon-button" aria-label={closeLabel} onClick={onClose}>
            <XIcon />
          </button>
        </div>
        <div className="ac-modal-body">{children}</div>
        {footer ? <div className="ac-modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
