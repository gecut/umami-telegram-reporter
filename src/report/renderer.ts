import type { ReportModel, UtmBreakdownItem } from "./types";
import { formatNumber, formatDuration, RLM, wrapRtlLine } from "../lib/format";
import { escapeHtml } from "../lib/html";

export function renderPersianReport(model: ReportModel): string {
  const lines: string[] = [];

  // Header
  lines.push(
    wrapRtlLine(`📊 <b>${escapeHtml(model.projectName)}</b> — ${escapeHtml(model.periodLabel)}`)
  );
  lines.push("");

  // Check if period has zero traffic
  const hasZeroTraffic =
    model.summary.visitors.value === 0 &&
    model.summary.visits.value === 0 &&
    model.summary.pageviews.value === 0;

  if (hasZeroTraffic) {
    lines.push(wrapRtlLine("ℹ️ <i>در این بازه زمانی هیچ ترافیکی برای وب‌سایت ثبت نشده است.</i>"));
    return lines.join("\n");
  }

  // Summary Metrics Section
  lines.push(wrapRtlLine("📈 <b>شاخص‌های کلیدی (در مقایسه با دوره قبل)</b>:"));

  const v = model.summary.visitors;
  lines.push(
    wrapRtlLine(
      `👥 <b>کاربران یکتا</b>: ${formatNumber(v.value)}  ${v.delta.emoji} ${v.delta.formatted}`
    )
  );

  const vi = model.summary.visits;
  lines.push(
    wrapRtlLine(
      `🔄 <b>نشست‌ها</b>: ${formatNumber(vi.value)}  ${vi.delta.emoji} ${vi.delta.formatted}`
    )
  );

  const pv = model.summary.pageviews;
  lines.push(
    wrapRtlLine(
      `📄 <b>نمایش صفحات</b>: ${formatNumber(pv.value)}  ${pv.delta.emoji} ${pv.delta.formatted}`
    )
  );

  const dur = model.summary.avgDurationSeconds;
  lines.push(
    wrapRtlLine(
      `⏳ <b>میانگین زمان نشست</b>: ${formatDuration(dur.value)}  ${dur.delta.emoji} ${dur.delta.formatted}`
    )
  );

  const br = model.summary.bounceRate;
  lines.push(
    wrapRtlLine(
      `📉 <b>نرخ پرش</b>: \u200E${br.value}%  ${br.delta.emoji} ${br.delta.formatted}`
    )
  );

  // UTM Campaigns & Breakdowns (e.g. Instagram Bio vs Story)
  const breakdownMap = new Map<string, UtmBreakdownItem>();
  for (const b of model.utmBreakdowns) {
    breakdownMap.set(b.source.toLowerCase(), b);
  }

  const renderedBreakdownSources = new Set<string>();
  const hasUtmSources = model.utmSources.length > 0;
  const hasBreakdowns = model.utmBreakdowns.some((b) => b.contentBreakdown.length > 0 || b.totalVisitors > 0);

  if (hasUtmSources || hasBreakdowns) {
    lines.push("");
    lines.push(wrapRtlLine("📢 <b>کمپین‌ها و منابع ورودی (کاربران یکتا)</b>:"));

    // Render top UTM sources, nesting breakdown details if available
    for (const item of model.utmSources) {
      const sourceKey = item.name.toLowerCase();
      const breakdown = breakdownMap.get(sourceKey);

      if (breakdown && breakdown.contentBreakdown.length > 0) {
        renderedBreakdownSources.add(sourceKey);
        lines.push(wrapRtlLine(`• <b><code>${escapeHtml(item.name)}</code></b>: ${formatNumber(item.count)}`));
        for (const sub of breakdown.contentBreakdown) {
          lines.push(wrapRtlLine(`    └ <code>${escapeHtml(sub.name)}</code>: ${formatNumber(sub.count)}`));
        }
      } else {
        lines.push(wrapRtlLine(`• <code>${escapeHtml(item.name)}</code>: ${formatNumber(item.count)}`));
      }
    }

    // Render configured breakdowns that weren't in top UTM sources
    for (const b of model.utmBreakdowns) {
      const sourceKey = b.source.toLowerCase();
      if (!renderedBreakdownSources.has(sourceKey) && (b.totalVisitors > 0 || b.contentBreakdown.length > 0)) {
        lines.push(wrapRtlLine(`• <b><code>${escapeHtml(b.source)}</code></b>: ${formatNumber(b.totalVisitors)}`));
        for (const sub of b.contentBreakdown) {
          lines.push(wrapRtlLine(`    └ <code>${escapeHtml(sub.name)}</code>: ${formatNumber(sub.count)}`));
        }
      }
    }
  }

  // Top Referrers
  if (model.topReferrers.length > 0) {
    lines.push("");
    lines.push(wrapRtlLine("🌐 <b>منابع اصلی ارجاع (کاربران یکتا)</b>:"));
    for (const ref of model.topReferrers) {
      lines.push(wrapRtlLine(`• <code>${escapeHtml(ref.name)}</code>: ${formatNumber(ref.count)}`));
    }
  }

  // Top Pages
  if (model.topPages.length > 0) {
    lines.push("");
    lines.push(wrapRtlLine("🔝 <b>صفحات پربازدید (کاربران یکتا)</b>:"));
    model.topPages.forEach((page, idx) => {
      lines.push(wrapRtlLine(`${idx + 1}. <code>${escapeHtml(page.name)}</code> — ${formatNumber(page.count)}`));
    });
  }

  // Custom Events
  if (model.events.length > 0) {
    lines.push("");
    lines.push(wrapRtlLine("🎯 <b>رویدادهای کلیدی (تعداد اجرا)</b>:"));
    for (const ev of model.events) {
      lines.push(wrapRtlLine(`• ${escapeHtml(ev.label)}: ${formatNumber(ev.count)}`));
    }
  }

  // Warnings / Notes
  if (model.warnings.length > 0) {
    lines.push("");
    for (const warn of model.warnings) {
      lines.push(wrapRtlLine(`⚠️ <i>${escapeHtml(warn)}</i>`));
    }
  }

  // Line-aware safe truncation to guarantee valid HTML entity and tag closure
  const MAX_TELEGRAM_LENGTH = 3800;
  const truncationNotice = `\n\n${RLM}<i>...(ادامه موارد به علت محدودیت طول پیام خلاصه شد)</i>`;

  let currentLength = 0;
  const outputLines: string[] = [];
  let truncated = false;

  for (const line of lines) {
    if (currentLength + line.length + 1 + truncationNotice.length > MAX_TELEGRAM_LENGTH) {
      truncated = true;
      break;
    }
    outputLines.push(line);
    currentLength += line.length + 1;
  }

  let result = outputLines.join("\n");
  if (truncated) {
    result += truncationNotice;
  }

  return result;
}
