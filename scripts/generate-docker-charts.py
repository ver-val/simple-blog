#!/usr/bin/env python3
import csv
import datetime as dt
import html
import math
import os
import sys
from collections import defaultdict


COLORS = {
    "blog-server": "#d9485f",
    "blog-postgres": "#2b8a3e",
    "blog-client": "#1c7ed6",
}

DESCRIPTIONS = {
    "blog-server": "Go backend API that handles authentication, profile updates, posts and comments.",
    "blog-postgres": "PostgreSQL database used by the blog backend.",
    "blog-client": "Frontend container serving the UI. It is not the main bottleneck during API-level stress tests.",
}


def parse_timestamp(value):
    return dt.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")


def parse_percent(value):
    return float(value.strip().rstrip("%"))


def parse_mem_usage_mib(value):
    current = value.split("/")[0].strip()
    return to_mib(current)


def to_mib(value):
    number = ""
    unit = ""
    for char in value.strip():
        if char.isdigit() or char == ".":
            number += char
        else:
            unit += char
    amount = float(number)
    unit = unit.strip()
    factors = {
        "B": 1 / (1024 * 1024),
        "KiB": 1 / 1024,
        "MiB": 1,
        "GiB": 1024,
    }
    if unit not in factors:
        raise ValueError(f"unsupported memory unit: {unit}")
    return amount * factors[unit]


def load_rows(path):
    grouped = defaultdict(list)
    with open(path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            grouped[row["name"]].append(
                {
                    "timestamp": parse_timestamp(row["timestamp"]),
                    "cpu": parse_percent(row["cpu_percent"]),
                    "mem_mib": parse_mem_usage_mib(row["mem_usage"]),
                }
            )
    for values in grouped.values():
        values.sort(key=lambda item: item["timestamp"])
    return grouped


def make_svg(grouped, metric_key, title, y_label, output_path):
    width = 1200
    height = 420
    pad_left = 70
    pad_right = 20
    pad_top = 40
    pad_bottom = 45
    plot_w = width - pad_left - pad_right
    plot_h = height - pad_top - pad_bottom

    all_points = [point for series in grouped.values() for point in series]
    start = min(point["timestamp"] for point in all_points)
    end = max(point["timestamp"] for point in all_points)
    span = max((end - start).total_seconds(), 1)

    y_values = [point[metric_key] for point in all_points]
    y_max = max(y_values)
    y_top = max(1, math.ceil(y_max * 1.1))

    def x_pos(ts):
        seconds = (ts - start).total_seconds()
        return pad_left + (seconds / span) * plot_w

    def y_pos(value):
        return pad_top + plot_h - (value / y_top) * plot_h

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<style>text{font-family:Arial,sans-serif;font-size:12px;fill:#222}.title{font-size:18px;font-weight:700}.legend{font-size:12px}.axis{stroke:#555;stroke-width:1}.grid{stroke:#ddd;stroke-width:1}.line{fill:none;stroke-width:2}</style>',
        f'<text class="title" x="{pad_left}" y="24">{html.escape(title)}</text>',
        f'<line class="axis" x1="{pad_left}" y1="{pad_top}" x2="{pad_left}" y2="{pad_top + plot_h}" />',
        f'<line class="axis" x1="{pad_left}" y1="{pad_top + plot_h}" x2="{pad_left + plot_w}" y2="{pad_top + plot_h}" />',
    ]

    for i in range(6):
        value = (y_top / 5) * i
        y = y_pos(value)
        lines.append(f'<line class="grid" x1="{pad_left}" y1="{y:.2f}" x2="{pad_left + plot_w}" y2="{y:.2f}" />')
        lines.append(f'<text x="10" y="{y + 4:.2f}">{value:.0f}</text>')

    tick_count = 6
    for i in range(tick_count + 1):
        seconds = (span / tick_count) * i
        x = pad_left + (seconds / span) * plot_w
        lines.append(f'<line class="grid" x1="{x:.2f}" y1="{pad_top}" x2="{x:.2f}" y2="{pad_top + plot_h}" />')
        lines.append(f'<text x="{x - 10:.2f}" y="{pad_top + plot_h + 20}">{int(seconds)}s</text>')

    legend_x = pad_left
    legend_y = height - 10
    for idx, (name, series) in enumerate(sorted(grouped.items())):
        color = COLORS.get(name, "#444")
        path = " ".join(
            f'{"M" if i == 0 else "L"} {x_pos(point["timestamp"]):.2f} {y_pos(point[metric_key]):.2f}'
            for i, point in enumerate(series)
        )
        lines.append(f'<path class="line" d="{path}" stroke="{color}" />')
        lines.append(
            f'<rect x="{legend_x + idx * 180}" y="{legend_y - 10}" width="14" height="4" fill="{color}" />'
            f'<text class="legend" x="{legend_x + 20 + idx * 180}" y="{legend_y}">{html.escape(name)}</text>'
        )

    lines.append(f'<text x="{width/2 - 35:.2f}" y="{height - 2}">time</text>')
    lines.append(f'<text transform="translate(18 {height/2:.2f}) rotate(-90)">{html.escape(y_label)}</text>')
    lines.append("</svg>")

    with open(output_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


def write_html(output_dir, cpu_svg, mem_svg, grouped):
    summary_rows = []
    container_cards = []
    first_ts = None
    last_ts = None
    for name, series in sorted(grouped.items()):
        if first_ts is None or series[0]["timestamp"] < first_ts:
            first_ts = series[0]["timestamp"]
        if last_ts is None or series[-1]["timestamp"] > last_ts:
            last_ts = series[-1]["timestamp"]
        max_cpu = max(point["cpu"] for point in series)
        avg_cpu = sum(point["cpu"] for point in series) / len(series)
        max_mem = max(point["mem_mib"] for point in series)
        avg_mem = sum(point["mem_mib"] for point in series) / len(series)
        color = COLORS.get(name, "#444")
        summary_rows.append(
            f"<tr><td>{html.escape(name)}</td><td>{avg_cpu:.2f}%</td><td>{max_cpu:.2f}%</td><td>{avg_mem:.2f} MiB</td><td>{max_mem:.2f} MiB</td></tr>"
        )
        container_cards.append(
            f"""
            <div class="card">
              <div class="swatch" style="background:{color}"></div>
              <div>
                <h3>{html.escape(name)}</h3>
                <p>{html.escape(DESCRIPTIONS.get(name, "Docker container involved in the test run."))}</p>
              </div>
            </div>
            """
        )

    content = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Docker Stress Charts</title>
  <style>
    :root{{--bg:#f6f7fb;--ink:#1f2430;--muted:#5c6370;--line:#d7dce5;--card:#ffffff}}
    body{{font-family:Arial,sans-serif;margin:0;background:var(--bg);color:var(--ink)}}
    main{{max-width:1200px;margin:0 auto;padding:32px 24px 48px}}
    h1{{margin:0 0 10px;font-size:32px}}
    h2{{margin:0 0 12px;font-size:22px}}
    h3{{margin:0 0 6px;font-size:16px}}
    p{{max-width:980px;color:var(--muted);line-height:1.45}}
    .intro{{margin-bottom:24px}}
    .meta{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin:22px 0 28px}}
    .meta-box,.section,.card{{background:var(--card);border:1px solid var(--line);border-radius:14px}}
    .meta-box{{padding:16px 18px}}
    .meta-label{{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}}
    .meta-value{{font-size:20px;font-weight:700}}
    .section{{padding:20px 22px;margin:0 0 22px}}
    .chart{{margin:18px 0 6px}}
    img{{max-width:100%;height:auto;border:1px solid var(--line);border-radius:12px;background:#fff}}
    table{{border-collapse:collapse;margin-top:12px;width:100%;background:#fff}}
    th,td{{border:1px solid var(--line);padding:10px 12px;text-align:left}}
    th{{background:#f2f4f8}}
    .cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}}
    .card{{padding:16px;display:flex;gap:12px;align-items:flex-start}}
    .swatch{{width:14px;height:14px;border-radius:999px;margin-top:4px;flex:none}}
    code{{background:#eef1f6;padding:2px 6px;border-radius:6px}}
  </style>
</head>
<body>
  <main>
    <section class="intro">
      <h1>Docker Resource Charts</h1>
      <p>This page summarizes Docker container resource usage captured during the stress test. The timeline includes the full capture window, including the warm-up stage before the main load ramp-up. CPU values above <code>100%</code> are expected on multi-core systems and mean that a container used more than one CPU core.</p>
    </section>

    <section class="meta">
      <div class="meta-box">
        <div class="meta-label">Capture Start</div>
        <div class="meta-value">{first_ts.strftime("%Y-%m-%d %H:%M:%S UTC")}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Capture End</div>
        <div class="meta-value">{last_ts.strftime("%Y-%m-%d %H:%M:%S UTC")}</div>
      </div>
      <div class="meta-box">
        <div class="meta-label">Containers</div>
        <div class="meta-value">{len(grouped)}</div>
      </div>
    </section>

    <section class="section">
      <h2>Containers</h2>
      <div class="cards">
        {''.join(container_cards)}
      </div>
    </section>

    <section class="section">
      <h2>Peak And Average Usage</h2>
      <table>
        <thead><tr><th>Container</th><th>Avg CPU</th><th>Peak CPU</th><th>Avg Memory</th><th>Peak Memory</th></tr></thead>
        <tbody>
          {''.join(summary_rows)}
        </tbody>
      </table>
    </section>

    <section class="section chart">
      <h2>CPU Usage Over Time</h2>
      <p>The CPU chart shows how the load evolved during warm-up and ramp-up. Use it to identify the point where the backend or database starts saturating.</p>
      <img src="{html.escape(os.path.basename(cpu_svg))}" alt="CPU usage chart">
    </section>

    <section class="section chart">
      <h2>Memory Usage Over Time</h2>
      <p>The memory chart helps verify whether the system is memory-bound or whether the main bottleneck is elsewhere, such as CPU or database work.</p>
      <img src="{html.escape(os.path.basename(mem_svg))}" alt="Memory usage chart">
    </section>
  </main>
</body>
</html>
"""
    with open(os.path.join(output_dir, "docker-charts.html"), "w", encoding="utf-8") as fh:
        fh.write(content)


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else "tests/performance/results/docker-stats.csv"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "tests/performance/results"
    os.makedirs(output_dir, exist_ok=True)

    grouped = load_rows(input_path)
    if not grouped:
        raise SystemExit("no docker stats found")

    cpu_svg = os.path.join(output_dir, "docker-cpu.svg")
    mem_svg = os.path.join(output_dir, "docker-memory.svg")

    make_svg(grouped, "cpu", "Docker CPU Usage Over Time", "CPU %", cpu_svg)
    make_svg(grouped, "mem_mib", "Docker Memory Usage Over Time", "MiB", mem_svg)
    write_html(output_dir, cpu_svg, mem_svg, grouped)

    print(f"Generated {cpu_svg}")
    print(f"Generated {mem_svg}")
    print(f"Generated {os.path.join(output_dir, 'docker-charts.html')}")


if __name__ == "__main__":
    main()
