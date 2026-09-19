"use client";

/**
 * Deterministic code block for a deposit address.
 *
 * Drawn from the address itself, so the same address always renders the
 * same pattern, useful as a visual "is this the address I was given"
 * check on a second device.
 */
export function QrPattern({
  value,
  size = 132,
}: {
  value: string;
  size?: number;
}) {
  const cells = 21;
  const modules: boolean[] = [];

  // Small deterministic PRNG seeded from the address.
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 31 + value.charCodeAt(index)) >>> 0;
  }
  function next(): number {
    seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
    return seed / 0xffffffff;
  }

  function inFinder(row: number, col: number): boolean {
    const corners: [number, number][] = [
      [0, 0],
      [0, cells - 7],
      [cells - 7, 0],
    ];
    return corners.some(
      ([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7,
    );
  }

  function finderOn(row: number, col: number): boolean {
    const corners: [number, number][] = [
      [0, 0],
      [0, cells - 7],
      [cells - 7, 0],
    ];
    for (const [r, c] of corners) {
      if (row >= r && row < r + 7 && col >= c && col < c + 7) {
        const dr = row - r;
        const dc = col - c;
        const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const core = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        return edge || core;
      }
    }
    return false;
  }

  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      if (inFinder(row, col)) {
        modules.push(finderOn(row, col));
      } else {
        modules.push(next() > 0.52);
      }
    }
  }

  const cell = size / cells;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Deposit address code"
      className="rounded-[var(--radius)] bg-white p-1.5"
    >
      {modules.map((on, index) => {
        if (!on) {
          return null;
        }
        const row = Math.floor(index / cells);
        const col = index % cells;
        return (
          <rect
            key={index}
            x={col * cell}
            y={row * cell}
            width={cell}
            height={cell}
            fill="#0d1512"
          />
        );
      })}
    </svg>
  );
}
