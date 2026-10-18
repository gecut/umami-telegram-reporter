import type { ReportModel, UtmBreakdownItem } from "./types";
import { formatNumber, formatDuration, RLM, wrapRtlLine } from "../lib/format";
import { escapeHtml } from "../lib/html";

function getEventEmoji(nameOrLabel: string): string {
  const lower = nameOrLabel.toLowerCase();
  if (lower.includes("cart") || lower.includes("سبد")) return "🛒";
  if (lower.includes("pay") || lower.includes("پرداخت") || lower.includes("خرید")) return "💳";
  if (lower.includes("signup") || lower.includes("register") || lower.includes("ثبت‌نام") || lower.includes("عضویت")) return "✨";
  if (lower.includes("lead") || lower.includes("contact") || lower.includes("تماس")) return "📞";
  return "•";
}

export function renderPersianReport(model: ReportModel): string {
  const lines: string[] = [];

  // 1. Header with Pulse Indicator
  lines.push(
    wrapRtlLine(`📊 <b>نبض ${escapeHtml(model.projectName)}</b> — ${escapeHtml(model.periodLabel)}`)
  );
  lines.push(
    wrapRtlLine(`${model.pulse.emoji} <b>وضعیت ترافیک</b>: ${escapeHtml(model.pulse.label)}`)
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

  // 2. Customers & Engagement Section (Executive business metrics)
  lines.push(wrapRtlLine("👥 <b>مشتریان و بازدیدها</b>:"));

  const v = model.summary.visitors;
  lines.push(
    wrapRtlLine(
      `• افراد بازدیدکننده: <b>${formatNumber(v.value)} نفر</b>  ${v.delta.emoji} ${v.delta.formatted}`
    )
  );

  const pv = model.summary.pageviews;
  lines.push(
    wrapRtlLine(
      `• کل صفحات دیده‌شده: <b>${formatNumber(pv.value)} بار</b>  ${pv.delta.emoji} ${pv.delta.formatted}`
    )
  );

  const dur = model.summary.avgDurationSeconds;
  lines.push(
    wrapRtlLine(
      `• میانگین حضور در سایت: <b>${formatDuration(dur.value)}</b>`
    )
  );

  // 3. Sales & Conversion Goals (Highlighted for business owner)
  if (model.events.length > 0) {
    lines.push("");
    lines.push(wrapRtlLine("🎯 <b>بازدهی فروش و اهداف سایت</b>:"));
    for (const ev of model.events) {
      const emoji = getEventEmoji(`${ev.name} ${ev.label}`);
      lines.push(wrapRtlLine(`${emoji} ${escapeHtml(ev.label)}: <b>${formatNumber(ev.count)} بار</b>`));
    }
  }

  // 4. Acquisition Channels & UTM Breakdowns
  const breakdownMap = new Map<string, UtmBreakdownItem>();
  for (const b of model.utmBreakdowns) {
    breakdownMap.set(b.source.toLowerCase(), b);
  }

  const renderedBreakdownSources = new Set<string>();
  const hasUtmSources = model.utmSources.length > 0;
  const hasBreakdowns = model.utmBreakdowns.some((b) => b.contentBreakdown.length > 0 || b.totalVisitors > 0);

  if (hasUtmSources || hasBreakdowns) {
    lines.push("");
    lines.push(wrapRtlLine("📢 <b>مشتریان از کجا آمدند؟</b>"));

    for (const item of model.utmSources) {
      const sourceKey = item.name.toLowerCase();
      const breakdown = breakdownMap.get(sourceKey);
      renderedBreakdownSources.add(sourceKey);

      if (breakdown && breakdown.contentBreakdown.length > 0) {
        lines.push(wrapRtlLine(`• <b>${escapeHtml(item.name)}</b>: ${formatNumber(item.count)} نفر`));
        for (const sub of breakdown.contentBreakdown) {
          lines.push(wrapRtlLine(`    └ ${escapeHtml(sub.name)}: ${formatNumber(sub.count)} نفر`));
        }
      } else {
        lines.push(wrapRtlLine(`• ${escapeHtml(item.name)}: ${formatNumber(item.count)} نفر`));
      }
    }

    for (const b of model.utmBreakdowns) {
      const sourceKey = b.source.toLowerCase();
      if (!renderedBreakdownSources.has(sourceKey) && (b.totalVisitors > 0 || b.contentBreakdown.length > 0)) {
        lines.push(wrapRtlLine(`• <b>${escapeHtml(b.source)}</b>: ${formatNumber(b.totalVisitors)} نفر`));
        for (const sub of b.contentBreakdown) {
          lines.push(wrapRtlLine(`    └ ${escapeHtml(sub.name)}: ${formatNumber(sub.count)} نفر`));
        }
      }
    }
  }

  // 5. Referrers & Search Engines
  if (model.topReferrers.length > 0) {
    lines.push("");
    lines.push(wrapRtlLine("🌐 <b>منابع ارجاع و جستجو</b>:"));
    for (const ref of model.topReferrers) {
      lines.push(wrapRtlLine(`• ${escapeHtml(ref.name)}: ${formatNumber(ref.count)} نفر`));
    }
  }

  // 6. Most Viewed Sections / Pages
  if (model.topPages.length > 0) {
    lines.push("");
    lines.push(wrapRtlLine("🔝 <b>بیشترین بخش‌های دیده‌شده</b>:"));
    model.topPages.forEach((page, idx) => {
      lines.push(wrapRtlLine(`${idx + 1}. <b>${escapeHtml(page.name)}</b> (${formatNumber(page.count)} بازدید)`));
    });
  }

  // 7. Warnings / Operational Notes
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
