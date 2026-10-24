const MODULES = 25

type Grid = boolean[][]

function isFinderZone(row: number, column: number): boolean {
  const top = row <= 7
  const bottom = row >= MODULES - 8
  const left = column <= 7
  const right = column >= MODULES - 8
  return (top && left) || (top && right) || (bottom && left)
}

function drawFinder(grid: Grid, top: number, left: number): void {
  for (let row = 0; row < 7; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const edge = row === 0 || row === 6 || column === 0 || column === 6
      const centre = row >= 2 && row <= 4 && column >= 2 && column <= 4
      grid[top + row][left + column] = edge || centre
    }
  }
}

function buildGrid(seed: number): Grid {
  let state = (Math.abs(seed) * 7919 + 104729) % 2147483647
  const next = (): number => {
    state = (state * 48271) % 2147483647
    return state / 2147483647
  }

  const grid: Grid = Array.from({ length: MODULES }, () =>
    Array.from({ length: MODULES }, () => false),
  )

  for (let row = 0; row < MODULES; row += 1) {
    for (let column = 0; column < MODULES; column += 1) {
      if (isFinderZone(row, column)) continue
      grid[row][column] = next() > 0.5
    }
  }

  drawFinder(grid, 0, 0)
  drawFinder(grid, 0, MODULES - 7)
  drawFinder(grid, MODULES - 7, 0)

  return grid
}

export default function QrCode({
  seed,
  className,
  label,
}: {
  seed: number
  className?: string
  label: string
}) {
  const grid = buildGrid(seed)
  const cells: { row: number; column: number }[] = []

  grid.forEach((line, row) => {
    line.forEach((filled, column) => {
      if (filled) cells.push({ row, column })
    })
  })

  return (
    <svg
      className={className ? `participants-qr ${className}` : 'participants-qr'}
      viewBox="-2 -2 29 29"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect x="-2" y="-2" width="29" height="29" fill="#fff" />
      {cells.map((cell) => (
        <rect key={`${cell.row}-${cell.column}`} x={cell.column} y={cell.row} width="1" height="1" />
      ))}
    </svg>
  )
}
