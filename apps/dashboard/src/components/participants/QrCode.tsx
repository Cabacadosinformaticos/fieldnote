import { useMemo } from 'react'
import QRCode from 'qrcode'

const QUIET_ZONE = 4

export default function QrCode({
  value,
  className,
  label,
}: {
  value: string
  className?: string
  label?: string
}) {
  const matrix = useMemo(
    () => (value ? QRCode.create(value, { errorCorrectionLevel: 'M' }).modules : null),
    [value],
  )

  if (!matrix) return null

  const size = matrix.size
  const extent = size + QUIET_ZONE * 2
  const cells: { row: number; column: number }[] = []

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (matrix.get(row, column)) cells.push({ row, column })
    }
  }

  return (
    <svg
      className={className ? `participants-qr ${className}` : 'participants-qr'}
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label={label ?? value}
      shapeRendering="crispEdges"
    >
      <rect x="0" y="0" width={extent} height={extent} fill="#fff" />
      {cells.map((cell) => (
        <rect
          key={`${cell.row}-${cell.column}`}
          x={cell.column + QUIET_ZONE}
          y={cell.row + QUIET_ZONE}
          width="1"
          height="1"
          fill="#000"
        />
      ))}
    </svg>
  )
}
