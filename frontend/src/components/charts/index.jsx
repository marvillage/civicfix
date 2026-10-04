// Fixity chart kit — small, dependency-free SVG/HTML charts.
//
// Rules baked in (see styles/charts.css):
// - Colors come from the validated --series-* tokens; a category
//   keeps its color everywhere (lib/labels.js CATEGORY_META.series).
// - Thin marks: ≤24px bars with a 4px rounded data end, 2px lines,
//   ≥8px markers with a 2px surface ring, hairline solid gridlines.
// - Every chart has a hover/focus tooltip and a table view, so no
//   value is reachable only by hovering or only by color.
// - Text uses text tokens, never the series color.

import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BarChart3, Table2 } from "lucide-react";
import {
  columnPath,
  labelIndexes,
  linear,
  niceTicks,
} from "./scale";

const fmtDefault = (value) =>
  value == null ? "—" : Number(value).toLocaleString("en-IN");

// ─────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────

function useWidth(ref) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;

    if (!node) return undefined;

    setWidth(node.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

// ─────────────────────────────────────────────
// Frame, legend, table, tooltip
// ─────────────────────────────────────────────

export function Legend({ items }) {
  if (!items?.length) return null;

  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li key={item.label}>
          <span
            className={`legend-key legend-${item.shape ?? "rect"}`}
            style={{ "--key": item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartTable({ columns, rows, caption }) {
  return (
    <div className="chart-table-wrap">
      <table className="data-table chart-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.numeric ? "num" : undefined}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.numeric ? "num" : undefined}
                >
                  {column.format
                    ? column.format(row[column.key], row)
                    : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Card wrapper: title, optional legend, chart/table switch.
export function ChartFrame({
  title,
  subtitle,
  legend,
  table,
  actions,
  className = "",
  children,
}) {
  const [view, setView] = useState("chart");

  return (
    <figure className={`chart-card ${className}`}>
      <figcaption className="chart-head">
        <div className="chart-titles">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="chart-head-actions">
          {actions}

          {table && (
            <div className="chart-view-toggle" role="group" aria-label="View">
              <button
                type="button"
                className={view === "chart" ? "is-active" : ""}
                aria-pressed={view === "chart"}
                onClick={() => setView("chart")}
                title="Chart view"
              >
                <BarChart3 aria-hidden="true" />
                <span className="sr-only">Chart</span>
              </button>
              <button
                type="button"
                className={view === "table" ? "is-active" : ""}
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
                title="Table view"
              >
                <Table2 aria-hidden="true" />
                <span className="sr-only">Table</span>
              </button>
            </div>
          )}
        </div>
      </figcaption>

      {view === "chart" && legend && <Legend items={legend} />}

      <div className="chart-body">
        {view === "chart" || !table ? (
          children
        ) : (
          <ChartTable {...table} caption={title} />
        )}
      </div>
    </figure>
  );
}

function Tooltip({ tip, containerWidth }) {
  if (!tip) return null;

  const flip = tip.x > containerWidth - 190;

  return (
    <div
      className={`chart-tooltip ${flip ? "is-flipped" : ""}`}
      style={{ left: tip.x, top: tip.y }}
      role="status"
    >
      {tip.title && <div className="chart-tooltip-title">{tip.title}</div>}
      <ul>
        {tip.rows.map((row) => (
          <li key={row.label}>
            {row.color && (
              <span
                className={`legend-key legend-${row.shape ?? "line"}`}
                style={{ "--key": row.color }}
                aria-hidden="true"
              />
            )}
            <strong>{row.value}</strong>
            <span>{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────
// Line / area chart with crosshair
// ─────────────────────────────────────────────

export function LineChart({
  data,
  xKey = "t",
  series,
  height = 240,
  formatX = (value) => value,
  formatTooltipX,
  formatValue = fmtDefault,
  maxXLabels = 6,
  endLabels = true,
  yMax, // share one scale across small multiples
  ariaLabel,
}) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(null);
  const gradientId = useId().replace(/:/g, "");

  const showEnd = endLabels && series.length <= 3;
  const margin = {
    top: 14,
    right: showEnd ? 52 : 14,
    bottom: 28,
    left: 44,
  };

  const max = Math.max(
    0,
    ...data.flatMap((row) => series.map((s) => Number(row[s.key]) || 0))
  );
  const { ticks, top } = niceTicks(yMax ?? max, 4);

  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const x = linear(0, Math.max(1, data.length - 1), margin.left, margin.left + innerW);
  const y = linear(0, top, margin.top + innerH, margin.top);
  const xLabels = labelIndexes(data.length, Math.max(2, Math.min(maxXLabels, Math.floor(innerW / 70))));

  const paths = series.map((s) => {
    const points = data.map((row, i) => [x(i), y(Number(row[s.key]) || 0)]);
    const line = points
      .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
      .join(" ");
    const area =
      s.area && points.length
        ? `${line} L${points[points.length - 1][0].toFixed(1)},${y(0)} L${points[0][0].toFixed(1)},${y(0)} Z`
        : null;

    return { ...s, line, area, points };
  });

  // End labels only when they can't collide; otherwise the legend and
  // tooltip carry identity (never nudge labels away from their lines).
  const endYs = paths
    .map((p) => p.points[p.points.length - 1]?.[1])
    .filter((value) => value != null)
    .sort((a, b) => a - b);
  const endLabelsFit =
    showEnd && endYs.every((value, i) => i === 0 || value - endYs[i - 1] >= 14);

  function pick(clientX) {
    const rect = wrapRef.current?.getBoundingClientRect();

    if (!rect || data.length === 0) return;

    const px = clientX - rect.left;
    const ratio = (px - margin.left) / innerW;
    const index = Math.round(ratio * (data.length - 1));

    setActive(Math.max(0, Math.min(data.length - 1, index)));
  }

  function onKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActive((i) => Math.min(data.length - 1, (i ?? -1) + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActive((i) => Math.max(0, (i ?? data.length) - 1));
    } else if (event.key === "Escape") {
      setActive(null);
    }
  }

  const tip =
    active != null && data[active]
      ? {
          x: x(active),
          y: margin.top,
          title: (formatTooltipX ?? formatX)(data[active][xKey], data[active]),
          rows: series.map((s) => ({
            label: s.label,
            value: formatValue(data[active][s.key]),
            color: s.color,
            shape: "line",
          })),
        }
      : null;

  return (
    <div className="chart-plot" ref={wrapRef} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="group"
          aria-label={ariaLabel ?? "Line chart. Use left and right arrow keys to read values."}
          tabIndex={0}
          onPointerMove={(event) => pick(event.clientX)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((i) => i ?? data.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKeyDown}
        >
          <defs>
            {paths
              .filter((p) => p.area)
              .map((p) => (
                <linearGradient
                  key={p.key}
                  id={`${gradientId}-${p.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={p.color} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={p.color} stopOpacity="0.02" />
                </linearGradient>
              ))}
          </defs>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === 0 ? "chart-baseline" : "chart-grid"}
                x1={margin.left}
                x2={margin.left + innerW}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="chart-axis-label" x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {data.map((row, i) =>
            xLabels.has(i) ? (
              <text
                key={i}
                className="chart-axis-label"
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              >
                {formatX(row[xKey], row)}
              </text>
            ) : null
          )}

          {paths.map((p) =>
            p.area ? (
              <path key={`a-${p.key}`} d={p.area} fill={`url(#${gradientId}-${p.key})`} />
            ) : null
          )}

          {paths.map((p) => (
            <path key={p.key} className="chart-line" d={p.line} stroke={p.color} />
          ))}

          {showEnd &&
            paths.map((p) => {
              const last = p.points[p.points.length - 1];

              if (!last) return null;

              return (
                <g key={`end-${p.key}`}>
                  <circle className="chart-dot" cx={last[0]} cy={last[1]} r={4} fill={p.color} />
                  {endLabelsFit && (
                    <text className="chart-end-label" x={last[0] + 8} y={last[1]} dy="0.32em">
                      {formatValue(data[data.length - 1]?.[p.key])}
                    </text>
                  )}
                </g>
              );
            })}

          {active != null && (
            <g className="chart-crosshair">
              <line x1={x(active)} x2={x(active)} y1={margin.top} y2={margin.top + innerH} />
              {paths.map((p) => (
                <circle
                  key={p.key}
                  className="chart-dot"
                  cx={x(active)}
                  cy={y(Number(data[active][p.key]) || 0)}
                  r={4.5}
                  fill={p.color}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      <Tooltip tip={tip} containerWidth={width} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Vertical columns
// ─────────────────────────────────────────────

export function ColumnChart({
  data, // [{ label, value, color?, title? }]
  height = 220,
  color = "var(--series-1)",
  formatValue = fmtDefault,
  highlight, // index to emphasise; others go muted
  ariaLabel,
}) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(null);

  const margin = { top: 22, right: 8, bottom: 28, left: 40 };
  const max = Math.max(0, ...data.map((d) => Number(d.value) || 0));
  const { ticks, top } = niceTicks(max, 4);

  const innerW = Math.max(10, width - margin.left - margin.right);
  const innerH = height - margin.top - margin.bottom;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.62);
  const y = linear(0, top, margin.top + innerH, margin.top);
  const labelAll = data.length <= 8;
  const maxIndex = data.findIndex((d) => Number(d.value) === max);
  const xLabels = labelIndexes(data.length, Math.max(2, Math.floor(innerW / 46)));

  const tip =
    active != null
      ? {
          x: margin.left + band * active + band / 2,
          y: Math.max(0, y(Number(data[active].value) || 0) - 8),
          title: data[active].title ?? data[active].label,
          rows: [
            {
              label: data[active].seriesLabel ?? "Value",
              value: formatValue(data[active].value),
              color: data[active].color ?? color,
              shape: "rect",
            },
          ],
        }
      : null;

  return (
    <div className="chart-plot" ref={wrapRef} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="group" aria-label={ariaLabel ?? "Column chart"}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className={tick === 0 ? "chart-baseline" : "chart-grid"}
                x1={margin.left}
                x2={margin.left + innerW}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className="chart-axis-label" x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const value = Number(d.value) || 0;
            const cx = margin.left + band * i + band / 2;
            const top = y(value);
            const h = y(0) - top;
            const muted = highlight != null && highlight !== i;
            const showLabel = labelAll || i === maxIndex || i === data.length - 1;

            return (
              <g
                key={d.label ?? i}
                className={`chart-col ${active === i ? "is-active" : ""} ${muted ? "is-muted" : ""}`}
                tabIndex={0}
                role="img"
                aria-label={`${d.title ?? d.label}: ${formatValue(value)}`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <rect className="chart-hit" x={cx - band / 2} y={margin.top} width={band} height={innerH} />
                <path d={columnPath(cx - barW / 2, top, barW, h)} fill={d.color ?? color} />
                {showLabel && value > 0 && (
                  <text className="chart-cap-label" x={cx} y={top - 6} textAnchor="middle">
                    {formatValue(value)}
                  </text>
                )}
                {xLabels.has(i) && (
                  <text className="chart-axis-label" x={cx} y={height - 8} textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}

      <Tooltip tip={tip} containerWidth={width} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Horizontal bars (HTML, wraps long labels)
// ─────────────────────────────────────────────

export function BarList({
  data, // [{ key?, label, value, color?, hint?, icon? }]
  color = "var(--series-1)",
  formatValue = fmtDefault,
  max: forcedMax,
  emptyText = "No data yet.",
}) {
  const [active, setActive] = useState(null);

  if (!data?.length) {
    return <p className="empty-inline">{emptyText}</p>;
  }

  const max = forcedMax ?? Math.max(1, ...data.map((d) => Number(d.value) || 0));

  return (
    <ul className="hbar-list">
      {data.map((d, i) => {
        const value = Number(d.value) || 0;
        const pct = Math.max(0, Math.min(100, (value / max) * 100));

        return (
          <li
            key={d.key ?? d.label}
            className={`hbar-row ${active != null && active !== i ? "is-dim" : ""}`}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            title={d.hint ? `${d.label}: ${formatValue(value)} · ${d.hint}` : undefined}
          >
            <span className="hbar-label">
              {d.icon}
              <span>{d.label}</span>
            </span>
            <span className="hbar-track">
              <span
                className="hbar-fill"
                style={{ width: `${pct}%`, background: d.color ?? color }}
              />
            </span>
            <span className="hbar-value">
              {formatValue(value)}
              {d.hint && <small>{d.hint}</small>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────
// Horizontal stacked bars (part-to-whole per row)
// ─────────────────────────────────────────────

export function StackedBars({
  rows, // [{ label, values: { [key]: number }, total? }]
  keys, // [{ key, label, color }]
  percent = false,
  formatValue = fmtDefault,
}) {
  const [tip, setTip] = useState(null);
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);

  const totals = rows.map(
    (row) => row.total ?? keys.reduce((sum, k) => sum + (Number(row.values[k.key]) || 0), 0)
  );
  const max = Math.max(1, ...totals);

  function show(event, row, k, value, total) {
    const rect = wrapRef.current.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();

    setTip({
      x: target.left - rect.left + target.width / 2,
      y: target.top - rect.top - 6,
      title: row.label,
      rows: [
        {
          label: k.label,
          value: `${formatValue(value)} · ${total ? Math.round((value / total) * 100) : 0}%`,
          color: k.color,
          shape: "rect",
        },
      ],
    });
  }

  return (
    <div className="stack-chart" ref={wrapRef}>
      <ul className="stack-rows">
        {rows.map((row, r) => {
          const total = totals[r];
          const scale = percent ? 100 / Math.max(1, total) : 100 / max;

          return (
            <li key={row.label} className="stack-row">
              <span className="stack-label">{row.label}</span>
              <span className="stack-track">
                {keys.map((k) => {
                  const value = Number(row.values[k.key]) || 0;

                  if (!value) return null;

                  return (
                    <span
                      key={k.key}
                      className="stack-seg"
                      style={{ width: `${value * scale}%`, background: k.color }}
                      tabIndex={0}
                      aria-label={`${row.label}, ${k.label}: ${formatValue(value)}`}
                      onPointerEnter={(event) => show(event, row, k, value, total)}
                      onFocus={(event) => show(event, row, k, value, total)}
                      onPointerLeave={() => setTip(null)}
                      onBlur={() => setTip(null)}
                    />
                  );
                })}
              </span>
              <span className="stack-total">{formatValue(total)}</span>
            </li>
          );
        })}
      </ul>

      <Tooltip tip={tip} containerWidth={width} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Heatmap (rows × columns, one sequential hue)
// ─────────────────────────────────────────────

export function Heatmap({
  matrix, // number[][]
  rowLabels,
  colLabels,
  formatCell = (value, r, c) => `${rowLabels[r]} ${colLabels[c]}: ${fmtDefault(value)}`,
  colLabelEvery = 3,
  unit = "reports",
}) {
  const [tip, setTip] = useState(null);
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);

  const flat = matrix.flat();
  const max = Math.max(1, ...flat);

  function show(event, r, c) {
    const rect = wrapRef.current.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();

    setTip({
      x: target.left - rect.left + target.width / 2,
      y: target.top - rect.top - 6,
      title: `${rowLabels[r]} · ${colLabels[c]}`,
      rows: [{ label: unit, value: fmtDefault(matrix[r][c]) }],
    });
  }

  return (
    <div className="heatmap" ref={wrapRef}>
      <div
        className="heatmap-grid"
        style={{ gridTemplateColumns: `44px repeat(${colLabels.length}, minmax(0, 1fr))` }}
      >
        {matrix.map((row, r) => (
          <div className="heatmap-row" key={rowLabels[r]} style={{ display: "contents" }}>
            <span className="heatmap-row-label">{rowLabels[r]}</span>
            {row.map((value, c) => {
              const t = value / max;

              return (
                <span
                  key={c}
                  className="heatmap-cell"
                  style={{
                    background: `color-mix(in oklab, var(--seq-high) ${Math.round(
                      t * 100
                    )}%, var(--seq-low))`,
                  }}
                  tabIndex={c === 0 ? 0 : -1}
                  aria-label={formatCell(value, r, c)}
                  onPointerEnter={(event) => show(event, r, c)}
                  onFocus={(event) => show(event, r, c)}
                  onPointerLeave={() => setTip(null)}
                  onBlur={() => setTip(null)}
                />
              );
            })}
          </div>
        ))}

        <span />
        {colLabels.map((label, c) => (
          <span key={label} className="heatmap-col-label">
            {c % colLabelEvery === 0 ? label : ""}
          </span>
        ))}
      </div>

      <div className="heatmap-scale" aria-hidden="true">
        <span>Fewer</span>
        <span className="heatmap-scale-bar" />
        <span>More ({fmtDefault(max)} peak)</span>
      </div>

      <Tooltip tip={tip} containerWidth={width} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Sparkline (stat tiles)
// ─────────────────────────────────────────────

export function Sparkline({
  values,
  color = "var(--series-1)",
  height = 36,
  label,
}) {
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);

  const path = useMemo(() => {
    if (!values?.length || !width) return null;

    const max = Math.max(1, ...values);
    const x = linear(0, Math.max(1, values.length - 1), 2, width - 4);
    const y = linear(0, max, height - 4, 4);
    const points = values.map((v, i) => [x(i), y(v)]);

    return {
      d: points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" "),
      last: points[points.length - 1],
    };
  }, [values, width, height]);

  return (
    <div className="sparkline" ref={wrapRef} style={{ height }}>
      {path && (
        <svg width={width} height={height} role="img" aria-label={label ?? "Trend"}>
          <path className="chart-line chart-line-thin" d={path.d} stroke={color} />
          <circle className="chart-dot" cx={path.last[0]} cy={path.last[1]} r={3.5} fill={color} />
        </svg>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Meter (single ratio against a limit)
// ─────────────────────────────────────────────

// `invert` when more is worse (e.g. budget used): ≥ thresholds[1]
// warns and over 100% is bad.
export function Meter({ value, max = 100, label, format = (v) => `${Math.round(v)}%`, thresholds = [60, 85], invert = false }) {
  const raw = (value / max) * 100;
  const pct = Math.max(0, Math.min(100, raw));
  const tone =
    value == null
      ? ""
      : invert
        ? raw > 100
          ? "meter-bad"
          : raw >= thresholds[1]
            ? "meter-warn"
            : "meter-good"
        : pct >= thresholds[1]
          ? "meter-good"
          : pct >= thresholds[0]
            ? "meter-warn"
            : "meter-bad";

  return (
    <div className="meter-block">
      <div className="meter-labels">
        <span>{label}</span>
        <strong>{value == null ? "—" : format(value)}</strong>
      </div>
      <div
        className={`meter ${tone}`}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value ?? 0}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
