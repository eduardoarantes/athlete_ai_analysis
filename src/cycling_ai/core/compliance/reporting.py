import html
import json
from typing import Iterable, List, Optional

import plotly.graph_objects as go
import plotly.io as pio

from .models import ComplianceResult, StreamPoint, WorkoutStep


def _expand_planned_power(steps: Iterable[WorkoutStep]) -> List[float]:
    planned: List[float] = []
    for step in steps:
        planned.extend([step.target_power] * step.duration)
    return planned


def save_workout_chart(
    steps: List[WorkoutStep],
    streams: List[StreamPoint],
    output_path: str,
    title: str = "Workout Compliance: Target vs Actual Power",
) -> None:
    import matplotlib.pyplot as plt

    planned_power = _expand_planned_power(steps)
    actual_power = [point.power for point in streams]

    plt.figure(figsize=(12, 6))
    plt.plot(planned_power, label="Target Power", color="blue", alpha=0.6, linestyle="--")
    plt.plot(actual_power, label="Actual Power", color="red", alpha=0.8)
    plt.title(title)
    plt.xlabel("Time (s)")
    plt.ylabel("Power (W)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(output_path)


def build_plotly_chart_html(
    steps: List[WorkoutStep],
    streams: List[StreamPoint],
    analyzer,
    offset: Optional[int] = None,
    aligned_actual: Optional[List[Optional[float]]] = None,
    title: str = "Workout Compliance: Target vs Actual Power",
) -> str:
    planned_power = _expand_planned_power(steps)
    actual_power = [point.power for point in streams]
    if aligned_actual is None:
        if offset is None:
            offset = analyzer.calculate_best_offset(planned_power, actual_power)

        aligned_actual = [0.0] * len(planned_power)
        if offset >= 0:
            overlap = min(len(planned_power) - offset, len(actual_power))
            for i in range(overlap):
                aligned_actual[offset + i] = actual_power[i]
        else:
            overlap = min(len(planned_power), len(actual_power) + offset)
            for i in range(overlap):
                aligned_actual[i] = actual_power[i - offset]

    def zone_style(target_power: float) -> tuple[str, str]:
        if analyzer.ftp <= 0:
            return "Z1", "rgba(96, 165, 250, 0.75)"
        ratio = target_power / analyzer.ftp
        if ratio < 0.6:
            return "Z1", "rgba(96, 165, 250, 0.75)"
        if ratio < 0.75:
            return "Z2", "rgba(74, 222, 128, 0.75)"
        if ratio < 0.9:
            return "Z3", "rgba(250, 204, 21, 0.75)"
        if ratio < 1.05:
            return "Z4", "rgba(251, 146, 60, 0.75)"
        return "Z5", "rgba(248, 113, 113, 0.75)"

    fig = go.Figure()

    # Background blocks for planned zones.
    current_time = 0
    for step in steps:
        label, color = zone_style(step.target_power)
        fig.add_shape(
            type="rect",
            x0=current_time,
            x1=current_time + step.duration,
            y0=0,
            y1=step.target_power,
            fillcolor=color,
            opacity=1.0,
            line_width=0,
            layer="below",
        )
        if step.duration >= 240 and label in {"Z1", "Z2"}:
            fig.add_annotation(
                x=current_time + (step.duration / 2),
                y=analyzer.ftp * 0.18,
                text=label,
                showarrow=False,
                font=dict(color="white", size=16, family="Arial Black"),
            )
        current_time += step.duration

    def format_mmss(seconds: int) -> str:
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}:{secs:02d}"

    time_labels = [format_mmss(i) for i in range(len(planned_power))]

    fig.add_trace(
        go.Scatter(
            x=list(range(len(planned_power))),
            y=aligned_actual,
            name="Actual",
            line=dict(color="#4b4f55", width=2),
            customdata=time_labels,
            hovertemplate="Time %{customdata}<br>Power %{y:.0f}W<extra></extra>",
        )
    )

    # FTP reference line.
    fig.add_shape(
        type="line",
        x0=0,
        x1=max(1, len(planned_power) - 1),
        y0=analyzer.ftp,
        y1=analyzer.ftp,
        line=dict(color="#3a77ff", width=2, dash="dash"),
    )
    max_power = max([analyzer.ftp * 1.1] + planned_power + actual_power) if planned_power else 300
    fig.update_layout(
        title="",
        showlegend=False,
        hovermode="x unified",
        margin=dict(l=20, r=20, t=10, b=20),
        plot_bgcolor="white",
        paper_bgcolor="white",
        height=320,
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, hoverformat=""),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[0, max_power]),
    )

    return pio.to_html(fig, include_plotlyjs="inline", full_html=False)


def _format_duration(seconds: int) -> str:
    minutes = seconds // 60
    secs = seconds % 60
    if minutes and secs:
        minute_label = "min" if minutes == 1 else "mins"
        return f"{minutes} {minute_label} {secs} secs"
    if minutes:
        minute_label = "min" if minutes == 1 else "mins"
        return f"{minutes} {minute_label}"
    return f"{secs} secs"


def _zone_label(target_power: float, ftp: float) -> str:
    if ftp <= 0:
        return "Z1"
    ratio = target_power / ftp
    if ratio < 0.6:
        return "Z1"
    if ratio < 0.75:
        return "Z2"
    if ratio < 0.9:
        return "Z3"
    if ratio < 1.05:
        return "Z4"
    return "Z5"


def _zone_descriptor(target_power: float, ftp: float) -> str:
    if ftp <= 0:
        return "Z1"
    ratio = target_power / ftp
    if ratio < 0.6:
        return "Z1"
    if ratio < 0.75:
        return "low Z2" if ratio < 0.675 else "high Z2"
    if ratio < 0.9:
        return "low Z3" if ratio < 0.825 else "high Z3"
    if ratio < 1.05:
        return "low Z4" if ratio < 0.975 else "high Z4"
    return "Z5"


def _describe_step(step: dict, ftp: float) -> str:
    duration = step.get("length", {}).get("value", 0)
    targets = step.get("targets", [])
    if targets:
        target = targets[0]
        p_min = target.get("minValue", 0)
        p_max = target.get("maxValue", 0)
        p_avg = (p_min + p_max) / 2.0
        unit = target.get("unit")
        target_power = p_avg * ftp / 100.0 if unit == "percentOfFtp" else p_avg
        descriptor = _zone_descriptor(target_power, ftp)
    else:
        descriptor = "Z1"
    return f"{_format_duration(duration)} in {descriptor}"


def _block_section(steps: List[dict]) -> str:
    names = " ".join(step.get("name", "").lower() for step in steps)
    intensity = " ".join(step.get("intensityClass", "").lower() for step in steps)
    if "warm" in names or "warmup" in intensity:
        return "warmup"
    if "cool" in names or "cooldown" in intensity:
        return "cooldown"
    return "main"


def _describe_workout(workout_definition: dict, ftp: float) -> dict:
    structure = workout_definition.get("structure", {}).get("structure", [])
    sections = {"warmup": [], "main": [], "cooldown": []}

    for block in structure:
        reps = block.get("length", {}).get("value", 1)
        steps = block.get("steps", [])
        if not steps:
            continue
        section = _block_section(steps)
        step_descriptions = [_describe_step(step, ftp) for step in steps]
        if reps > 1:
            if len(step_descriptions) == 1:
                line = f"{reps} x {step_descriptions[0]}"
            else:
                joined = " + ".join(step_descriptions)
                line = f"{reps} x ({joined})"
        else:
            line = step_descriptions[0] if len(step_descriptions) == 1 else " + ".join(step_descriptions)
        sections[section].append(line)

    return sections


def save_workout_report_html(
    output_path: str,
    chart_html: str,
    results: List[ComplianceResult],
    title: str = "Workout Compliance Report",
) -> None:
    table_html = _results_table_html(results)
    html_doc = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      :root {{
        color-scheme: light;
      }}
      body {{
        margin: 24px;
        font-family: "Georgia", "Times New Roman", serif;
        color: #1b1b1b;
        background: #f7f3ef;
      }}
      h1 {{
        margin: 0 0 16px;
        font-size: 28px;
        letter-spacing: 0.5px;
      }}
      .chart {{
        margin: 12px 0 20px;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      }}
      th,
      td {{
        padding: 10px 12px;
        border-bottom: 1px solid #e0d9d3;
        text-align: left;
        font-size: 14px;
      }}
      th {{
        background: #ede5df;
        font-weight: 600;
      }}
      tr:last-child td {{
        border-bottom: none;
      }}
    </style>
  </head>
  <body>
    <h1>{title}</h1>
    <div class="chart">
      {chart_html}
    </div>
    <table>
      <thead>
        <tr>
          <th>Segment</th>
          <th>Planned Time (s)</th>
          <th>Actual Time (s)</th>
          <th>Target Power (W)</th>
          <th>Actual Power (W)</th>
          <th>Compliance (%)</th>
        </tr>
      </thead>
      <tbody>
        {table_html}
      </tbody>
    </table>
  </body>
</html>
"""

    with open(output_path, "w") as f:
        f.write(html_doc)


def save_multi_workout_report_html(
    output_path: str,
    sections: List[dict],
    title: str = "Workout Compliance Report",
) -> None:
    section_blocks = []
    for section in sections:
        table_html = _results_table_html(section["results"])
        section_blocks.append(
            f"""
    <section class="workout">
      <h2>{section["title"]}</h2>
      <div class="chart">
        {section["chart_html"]}
      </div>
      <table>
        <thead>
          <tr>
            <th>Segment</th>
            <th>Planned Time (s)</th>
            <th>Actual Time (s)</th>
            <th>Target Power (W)</th>
            <th>Actual Power (W)</th>
            <th>Compliance (%)</th>
          </tr>
        </thead>
        <tbody>
          {table_html}
        </tbody>
      </table>
    </section>
"""
        )

    sections_html = "\n".join(section_blocks)
    html_doc = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      :root {{
        color-scheme: light;
      }}
      body {{
        margin: 24px;
        font-family: "Georgia", "Times New Roman", serif;
        color: #1b1b1b;
        background: #f7f3ef;
      }}
      h1 {{
        margin: 0 0 16px;
        font-size: 28px;
        letter-spacing: 0.5px;
      }}
      h2 {{
        margin: 24px 0 12px;
        font-size: 20px;
      }}
      .chart {{
        margin: 12px 0 20px;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      }}
      th,
      td {{
        padding: 10px 12px;
        border-bottom: 1px solid #e0d9d3;
        text-align: left;
        font-size: 14px;
      }}
      th {{
        background: #ede5df;
        font-weight: 600;
      }}
      tr:last-child td {{
        border-bottom: none;
      }}
      .workout {{
        margin-bottom: 32px;
      }}
    </style>
  </head>
  <body>
    <h1>{title}</h1>
    {sections_html}
  </body>
</html>
"""

    with open(output_path, "w") as f:
        f.write(html_doc)


def save_comparison_report_html(
    output_path: str,
    sections: List[dict],
    title: str = "Workout Compliance Comparison",
) -> None:
    section_blocks = []
    for section in sections:
        coach_feedback = section.get("coach_feedback")
        coach_feedback_html = ""
        if coach_feedback:
            coach_payload = None
            if isinstance(coach_feedback, dict):
                coach_payload = coach_feedback
            else:
                try:
                    coach_payload = json.loads(str(coach_feedback))
                except json.JSONDecodeError:
                    coach_payload = None

            if coach_payload:
                strengths = "<br>".join(html.escape(str(item)) for item in coach_payload.get("strengths", []))
                opportunities = "<br>".join(html.escape(str(item)) for item in coach_payload.get("opportunities", []))
                segment_insights = "<br>".join(
                    html.escape(str(item)) for item in coach_payload.get("segment_insights", [])
                )
                recommendations = "<br>".join(
                    html.escape(str(item)) for item in coach_payload.get("recommendations_next_session", [])
                )
                coach_feedback_html = (
                    "<div class=\"panel coach-feedback\">"
                    "<h4>Coach feedback</h4>"
                    "<table class=\"coach-table\">"
                    "<tbody>"
                    f"<tr><th>Overall assessment</th><td>{html.escape(str(coach_payload.get('overall_assessment', '')))}</td></tr>"
                    f"<tr><th>Strengths</th><td>{strengths}</td></tr>"
                    f"<tr><th>Opportunities</th><td>{opportunities}</td></tr>"
                    f"<tr><th>Segment insights</th><td>{segment_insights}</td></tr>"
                    f"<tr><th>Recommendations</th><td>{recommendations}</td></tr>"
                    f"<tr><th>Confidence</th><td>{html.escape(str(coach_payload.get('confidence', '')))}</td></tr>"
                    f"<tr><th>Data quality notes</th><td>{html.escape(str(coach_payload.get('data_quality_notes', '')))}</td></tr>"
                    "</tbody></table>"
                    "</div>"
                )
            else:
                coach_feedback_html = (
                    "<div class=\"panel coach-feedback\">"
                    "<h4>Coach feedback</h4>"
                    f"<pre><code>{html.escape(str(coach_feedback))}</code></pre>"
                    "</div>"
                )

        workout_definition = section.get("workout_definition")
        workout_summary_html = ""
        if workout_definition:
            ftp_value = None
            if section.get("algorithms"):
                ftp_value = section["algorithms"][0].get("ftp")
            summary_sections = _describe_workout(workout_definition, ftp_value or 0.0)
            sections_html = []
            if summary_sections["warmup"]:
                warmup_items = "".join(
                    f"<li>{html.escape(line)}</li>" for line in summary_sections["warmup"]
                )
                sections_html.append(
                    "<div class=\"workout-section\">"
                    "<div class=\"workout-label\">Warm Up</div>"
                    f"<ul>{warmup_items}</ul>"
                    "</div>"
                )
            if summary_sections["main"]:
                main_items = "".join(
                    f"<li>{html.escape(line)}</li>" for line in summary_sections["main"]
                )
                sections_html.append(
                    "<div class=\"workout-section\">"
                    "<div class=\"workout-label\">Main Set</div>"
                    f"<ul>{main_items}</ul>"
                    "</div>"
                )
            if summary_sections["cooldown"]:
                cooldown_items = "".join(
                    f"<li>{html.escape(line)}</li>" for line in summary_sections["cooldown"]
                )
                sections_html.append(
                    "<div class=\"workout-section\">"
                    "<div class=\"workout-label\">Warm Down</div>"
                    f"<ul>{cooldown_items}</ul>"
                    "</div>"
                )

            workout_summary_html = (
                "<div class=\"panel workout-summary\">"
                "<h4>Workout overview</h4>"
                "<div class=\"workout-text\">"
                + "".join(sections_html)
                + "</div></div>"
            )

        algo_blocks = []
        for algo_index, algo in enumerate(section["algorithms"]):
            chart_id = f"chart-{len(section_blocks)}-{algo_index}"
            summary_html = _summary_table_html(algo["results"], ftp=algo.get("ftp"))
            table_html = _results_table_html_with_hover(algo["results"], chart_id)
            algo_blocks.append(
                f"""
        <div class="algo">
          <h3>{algo["name"]}</h3>
          <div class="summary">
            {summary_html}
          </div>
          <div class="chart" id="{chart_id}">
            {algo["chart_html"]}
          </div>
          <details class="segments">
            <summary>Segment details</summary>
            <table>
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Planned Time (s)</th>
                  <th>Actual Time (s)</th>
                  <th>Target Power (W)</th>
                  <th>Actual Power (W)</th>
                  <th>Compliance (%)</th>
                </tr>
              </thead>
              <tbody>
                {table_html}
              </tbody>
            </table>
          </details>
        </div>
"""
            )
        section_blocks.append(
            f"""
    <section class="workout">
      <h2>{section["title"]}</h2>
      <div class="panels">
        {workout_summary_html}
        {coach_feedback_html}
      </div>
      <div class="grid">
        {''.join(algo_blocks)}
      </div>
    </section>
"""
        )

    sections_html = "\n".join(section_blocks)
    html_doc = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <style>
      :root {{
        color-scheme: light;
      }}
      body {{
        margin: 24px;
        font-family: "Georgia", "Times New Roman", serif;
        color: #1b1b1b;
        background: #f7f3ef;
      }}
      h1 {{
        margin: 0 0 16px;
        font-size: 28px;
        letter-spacing: 0.5px;
      }}
      h2 {{
        margin: 24px 0 12px;
        font-size: 20px;
      }}
      h3 {{
        margin: 0 0 8px;
        font-size: 16px;
      }}
      .grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 16px;
        align-items: start;
      }}
      .chart {{
        margin: 12px 0 20px;
      }}
      .meta {{
        margin-bottom: 10px;
        font-size: 13px;
        color: #5f5750;
      }}
      .panels {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
        margin-bottom: 12px;
      }}
      .panel {{
        background: #ffffff;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      }}
      .panel h4 {{
        margin: 0 0 8px;
        font-size: 14px;
        letter-spacing: 0.3px;
      }}
      .workout-text {{
        font-size: 13px;
        line-height: 1.5;
        color: #2f2a27;
      }}
      .workout-section + .workout-section {{
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #eee3db;
      }}
      .workout-label {{
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.8px;
        font-weight: 600;
        color: #6b5f58;
        margin-bottom: 6px;
      }}
      .workout-section ul {{
        margin: 0;
        padding-left: 18px;
      }}
      .workout-section li {{
        margin: 4px 0;
      }}
      .summary table {{
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        margin-bottom: 12px;
      }}
      .summary th,
      .summary td {{
        padding: 8px 10px;
        border-bottom: 1px solid #e0d9d3;
        text-align: left;
        font-size: 13px;
      }}
      .summary th {{
        background: #f3ece6;
        font-weight: 600;
      }}
      table {{
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
      }}
      .coach-table {{
        width: 100%;
        border-collapse: collapse;
        background: #ffffff;
        box-shadow: none;
      }}
      .coach-table th,
      .coach-table td {{
        padding: 8px 10px;
        border-bottom: 1px solid #e0d9d3;
        text-align: left;
        font-size: 13px;
        vertical-align: top;
      }}
      .coach-table th {{
        width: 180px;
        background: #f3ece6;
        font-weight: 600;
      }}
      th,
      td {{
        padding: 10px 12px;
        border-bottom: 1px solid #e0d9d3;
        text-align: left;
        font-size: 14px;
      }}
      th {{
        background: #ede5df;
        font-weight: 600;
      }}
      tr:last-child td {{
        border-bottom: none;
      }}
      .workout {{
        margin-bottom: 32px;
      }}
      .algo {{
        background: rgba(255, 255, 255, 0.6);
        padding: 12px;
        border-radius: 12px;
      }}
      details {{
        background: #ffffff;
        border-radius: 10px;
        padding: 8px 10px;
        margin: 10px 0;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
      }}
      summary {{
        cursor: pointer;
        font-weight: 600;
        color: #3c3430;
        list-style: none;
      }}
      summary::-webkit-details-marker {{
        display: none;
      }}
      details pre {{
        margin: 10px 0 0;
        background: #f4efea;
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 12px;
        overflow-x: auto;
      }}
    </style>
  </head>
  <body>
    <h1>{title}</h1>
    {sections_html}
    <script>
      (function() {{
        function getGraphDiv(chartId) {{
          var container = document.getElementById(chartId);
          if (!container) return null;
          return container.querySelector('.plotly-graph-div');
        }}

        function highlight(graphDiv, start, end) {{
          if (!graphDiv || !window.Plotly) return;
          if (!graphDiv.__baseShapes) {{
            graphDiv.__baseShapes = (graphDiv.layout.shapes || []).slice();
          }}
          var highlightShape = {{
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: start,
            x1: end,
            y0: 0,
            y1: 1,
            fillcolor: 'rgba(0, 0, 0, 0.08)',
            line: {{ width: 0 }},
            layer: 'above'
          }};
          var shapes = graphDiv.__baseShapes.concat([highlightShape]);
          window.Plotly.relayout(graphDiv, {{ shapes: shapes }});
        }}

        function clearHighlight(graphDiv) {{
          if (!graphDiv || !window.Plotly || !graphDiv.__baseShapes) return;
          window.Plotly.relayout(graphDiv, {{ shapes: graphDiv.__baseShapes }});
        }}

        var rows = document.querySelectorAll('tr[data-chart]');
        rows.forEach(function(row) {{
          row.addEventListener('mouseenter', function() {{
            var chartId = row.getAttribute('data-chart');
            var start = Number(row.getAttribute('data-start'));
            var end = Number(row.getAttribute('data-end'));
            highlight(getGraphDiv(chartId), start, end);
          }});
          row.addEventListener('mouseleave', function() {{
            var chartId = row.getAttribute('data-chart');
            clearHighlight(getGraphDiv(chartId));
          }});
        }});
      }})();
    </script>
  </body>
</html>
"""

    with open(output_path, "w") as f:
        f.write(html_doc)


def _results_table_html(results: List[ComplianceResult]) -> str:
    rows = []
    for res in results:
        rows.append(
            "<tr>"
            f"<td>{res.step_name}</td>"
            f"<td>{res.planned_duration}</td>"
            f"<td>{res.actual_duration}</td>"
            f"<td>{res.target_power:.1f}</td>"
            f"<td>{res.actual_power_avg:.1f}</td>"
            f"<td>{res.compliance_pct:.1f}%</td>"
            "</tr>"
        )
    return "\n".join(rows)


def _results_table_html_with_hover(results: List[ComplianceResult], chart_id: str) -> str:
    rows = []
    current = 0
    for res in results:
        start = current
        end = current + res.planned_duration
        rows.append(
            "<tr "
            f"data-start=\"{start}\" data-end=\"{end}\" data-chart=\"{chart_id}\">"
            f"<td>{res.step_name}</td>"
            f"<td>{res.planned_duration}</td>"
            f"<td>{res.actual_duration}</td>"
            f"<td>{res.target_power:.1f}</td>"
            f"<td>{res.actual_power_avg:.1f}</td>"
            f"<td>{res.compliance_pct:.1f}%</td>"
            "</tr>"
        )
        current = end
    return "\n".join(rows)


def _summary_table_html(results: List[ComplianceResult], ftp: Optional[float] = None) -> str:
    planned_total = sum(r.planned_duration for r in results)
    actual_total = sum(r.actual_duration for r in results)

    def _weight_factor(result: ComplianceResult) -> float:
        intensity = (result.intensity_class or "").lower()
        if intensity in {"warmup", "cooldown"}:
            return 0.5
        name = result.step_name.lower()
        if "warm" in name or "cool" in name:
            return 0.5
        return 1.0

    weighted_total = sum(r.planned_duration * _weight_factor(r) for r in results)
    if weighted_total > 0:
        weighted = sum(
            r.compliance_pct * r.planned_duration * _weight_factor(r) for r in results
        )
        overall = weighted / weighted_total
    else:
        overall = 0.0

    ftp_value = f"{ftp:.0f} W" if ftp else "n/a"
    return (
        "<table>"
        "<thead><tr><th>Planned Duration</th><th>Actual Duration</th>"
        "<th>Overall Compliance</th><th>FTP Used (W)</th></tr></thead>"
        "<tbody>"
        f"<tr><td>{_format_mmss(planned_total)}</td>"
        f"<td>{_format_mmss(actual_total)}</td>"
        f"<td>{overall:.1f}%</td>"
        f"<td>{ftp_value}</td></tr>"
        "</tbody></table>"
    )


def _format_mmss(seconds: int) -> str:
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes}:{secs:02d}"
