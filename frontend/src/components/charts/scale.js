// Tiny scale helpers for the SVG charts (no chart library needed).

// A "nice" tick step: 1, 2, 2.5 or 5 × 10^n.
export function niceStep(span, targetTicks = 4) {
  if (!(span > 0)) return 1;

  const raw = span / targetTicks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;

  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;

  return nice * power;
}

// Ticks from 0 to a rounded-up max.
export function niceTicks(max, targetTicks = 4) {
  const safeMax = max > 0 ? max : 1;
  const step = niceStep(safeMax, targetTicks);
  const top = Math.ceil(safeMax / step) * step;
  const ticks = [];

  for (let value = 0; value <= top + step / 2; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }

  return { ticks, top };
}

export function linear(domainMin, domainMax, rangeMin, rangeMax) {
  const span = domainMax - domainMin || 1;

  return (value) =>
    rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

// Evenly spaced subset of indexes so x labels don't collide.
export function labelIndexes(count, maxLabels) {
  if (count <= maxLabels) {
    return new Set(Array.from({ length: count }, (_, i) => i));
  }

  const step = Math.ceil((count - 1) / (maxLabels - 1));
  const picked = new Set();

  for (let i = 0; i < count; i += step) picked.add(i);
  picked.add(count - 1);

  // Drop the label just before the last one if they'd touch.
  const sorted = [...picked].sort((a, b) => a - b);
  const beforeLast = sorted[sorted.length - 2];

  if (beforeLast !== undefined && count - 1 - beforeLast < step / 2) {
    picked.delete(beforeLast);
  }

  return picked;
}

// Rounded-top bar path: square at the baseline, 4px radius at the
// data end (vertical columns).
export function columnPath(x, y, width, height, radius = 4) {
  if (height <= 0) return "";

  const r = Math.min(radius, width / 2, height);

  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height}`,
    "Z",
  ].join(" ");
}

// Horizontal bar with a rounded right end.
export function barPath(x, y, width, height, radius = 4) {
  if (width <= 0) return "";

  const r = Math.min(radius, height / 2, width);

  return [
    `M${x},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height - r}`,
    `Q${x + width},${y + height} ${x + width - r},${y + height}`,
    `H${x}`,
    "Z",
  ].join(" ");
}
