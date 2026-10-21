import { metricValue } from "~/lib/format";
import type { MetricReading } from "~/metrics/reading";
import { StatusMark } from "./StatusMark";

const NO_REASON = "No reason was recorded.";

/** The only way a metric value reaches the screen. Rules 1 and 2: a missing value is "N/A"
 *  with its reason (never 0, never hidden); a low-confidence value carries a badge and reason. */
export function MetricValue({ reading, layout = "inline" }: { reading: MetricReading; layout?: "inline" | "stacked" }) {
  const gap = layout === "stacked" ? "flex-col items-start gap-1" : "flex-wrap items-baseline gap-x-3 gap-y-1";
  if (reading.value === null) {
    return (
      <span className={`flex ${gap}`} data-metric-state="na">
        <span className="na-box t-ui nums">N/A</span>
        <span className="t-small text-slate">{reading.nullReason ?? NO_REASON}</span>
      </span>
    );
  }
  const text = metricValue(reading.value, reading.unit);
  if (!reading.lowConfidence) {
    return (
      <span className="t-ui nums font-semibold" data-metric-state="value">
        {text}
      </span>
    );
  }
  return (
    <span className={`flex ${gap}`} data-metric-state="low-confidence">
      <span className="t-ui nums lowconf-value font-semibold">{text}</span>
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        <StatusMark kind="low-confidence" />
        <span className="t-small text-slate">{reading.lowConfidenceReason ?? NO_REASON}</span>
      </span>
    </span>
  );
}
