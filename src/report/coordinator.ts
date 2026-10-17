import type { ProjectConfig } from "../config/projects";
import type { UmamiClient } from "../umami/client";
import type { UmamiStatsResponse, UmamiMetricItem } from "../umami/types";
import { getDateWindow, type DateWindowType } from "../lib/dates";
import { calculateDelta } from "../lib/percentage";
import { logger } from "../lib/logger";
import type {
  ReportModel,
  MetricSummaryItem,
  RankedMetricItem,
  UtmBreakdownItem,
  CustomEventReportItem,
} from "./types";

interface ParsedStatValue {
  value: number;
  prev: number;
}

function extractStat(
  metric: number | { value: number; prev?: number; change?: number } | undefined,
  comparisonFallback?: number
): ParsedStatValue {
  if (metric === undefined || metric === null) {
    return { value: 0, prev: comparisonFallback ?? 0 };
  }

  if (typeof metric === "number") {
    return { value: metric, prev: comparisonFallback ?? 0 };
  }

  const value = metric.value ?? 0;
  let prev = comparisonFallback ?? 0;

  if (metric.prev !== undefined) {
    prev = metric.prev;
  } else if (metric.change !== undefined) {
    prev = value - metric.change;
  }

  return { value, prev };
}

export async function generateReport(
  project: ProjectConfig,
  period: DateWindowType,
  client: UmamiClient,
  now: Date = new Date()
): Promise<ReportModel> {
  const window = getDateWindow(period, project.timezone, now);
  const warnings: string[] = [];

  logger.info(`[ReportCoordinator] Generating ${period} report for project ${project.id}`, {
    websiteId: project.umamiWebsiteId,
    startAt: window.startAt,
    endAt: window.endAt,
  });

  // 1. Fetch Primary Summary Stats (Mandatory)
  let rawStats: UmamiStatsResponse;
  try {
    rawStats = await client.getStats(project.umamiWebsiteId, window.startAt, window.endAt, "prev");
  } catch (err) {
    logger.error(`[ReportCoordinator] Failed to fetch stats for ${project.id}`, err);
    throw new Error(`Failed to fetch primary statistics from Umami API: ${(err as Error).message}`);
  }

  // 2. Fetch Secondary Metrics Concurrently with Graceful Degradation
  const fetchPagesPromise = client
    .getMetrics(project.umamiWebsiteId, window.startAt, window.endAt, "path", 5)
    .catch((err) => {
      warnings.push("امکان دریافت فهرست صفحات پربازدید وجود نداشت.");
      logger.warn(`[ReportCoordinator] Top pages query failed for ${project.id}`, { error: String(err) });
      return [] as UmamiMetricItem[];
    });

  const fetchReferrersPromise = client
    .getMetrics(project.umamiWebsiteId, window.startAt, window.endAt, "referrer", 5)
    .catch((err) => {
      warnings.push("امکان دریافت منابع ارجاع وجود نداشت.");
      logger.warn(`[ReportCoordinator] Referrers query failed for ${project.id}`, { error: String(err) });
      return [] as UmamiMetricItem[];
    });

  const fetchUtmSourcesPromise = client
    .getMetrics(project.umamiWebsiteId, window.startAt, window.endAt, "utmSource", 5)
    .catch((err) => {
      logger.warn(`[ReportCoordinator] UTM source query failed for ${project.id}`, { error: String(err) });
      return [] as UmamiMetricItem[];
    });

  const fetchEventsPromise = client
    .getMetrics(project.umamiWebsiteId, window.startAt, window.endAt, "event", 15)
    .catch((err) => {
      logger.warn(`[ReportCoordinator] Events query failed for ${project.id}`, { error: String(err) });
      return [] as UmamiMetricItem[];
    });

  // Fetch optional UTM breakdowns
  const breakdownPromises = (project.utmBreakdowns ?? []).map(async (breakdown) => {
    try {
      const items = await client.getMetrics(
        project.umamiWebsiteId,
        window.startAt,
        window.endAt,
        "utmContent",
        5,
        { utmSource: breakdown.source }
      );
      return {
        source: breakdown.source,
        items,
      };
    } catch (err) {
      logger.warn(`[ReportCoordinator] UTM breakdown query failed for ${breakdown.source}`, { error: String(err) });
      return { source: breakdown.source, items: [] as UmamiMetricItem[] };
    }
  });

  const [rawPages, rawReferrers, rawUtmSources, rawEvents, rawBreakdowns] = await Promise.all([
    fetchPagesPromise,
    fetchReferrersPromise,
    fetchUtmSourcesPromise,
    fetchEventsPromise,
    Promise.all(breakdownPromises),
  ]);

  // 3. Normalize Summary Metrics
  const comp = rawStats.comparison;

  const pageviewsData = extractStat(rawStats.pageviews, comp?.pageviews);
  const visitorsData = extractStat(rawStats.visitors, comp?.visitors);
  const visitsData = extractStat(rawStats.visits, comp?.visits);
  const bouncesData = extractStat(rawStats.bounces, comp?.bounces);
  const totaltimeData = extractStat(rawStats.totaltime, comp?.totaltime);

  // Bounce Rate calculation: (bounces / visits) * 100
  const currentBounceRate = visitsData.value > 0 ? (bouncesData.value / visitsData.value) * 100 : 0;
  const prevBounceRate = visitsData.prev > 0 ? (bouncesData.prev / visitsData.prev) * 100 : 0;

  // Average Duration calculation: totaltime / visits
  const currentAvgDuration = visitsData.value > 0 ? Math.round(totaltimeData.value / visitsData.value) : 0;
  const prevAvgDuration = visitsData.prev > 0 ? Math.round(totaltimeData.prev / visitsData.prev) : 0;

  const summary = {
    visitors: {
      value: visitorsData.value,
      previous: visitorsData.prev,
      delta: calculateDelta(visitorsData.value, visitorsData.prev),
    } satisfies MetricSummaryItem,
    visits: {
      value: visitsData.value,
      previous: visitsData.prev,
      delta: calculateDelta(visitsData.value, visitsData.prev),
    } satisfies MetricSummaryItem,
    pageviews: {
      value: pageviewsData.value,
      previous: pageviewsData.prev,
      delta: calculateDelta(pageviewsData.value, pageviewsData.prev),
    } satisfies MetricSummaryItem,
    bounceRate: {
      value: Number(currentBounceRate.toFixed(1)),
      previous: Number(prevBounceRate.toFixed(1)),
      delta: calculateDelta(currentBounceRate, prevBounceRate, { invertPolarity: true }),
    } satisfies MetricSummaryItem,
    avgDurationSeconds: {
      value: currentAvgDuration,
      previous: prevAvgDuration,
      delta: calculateDelta(currentAvgDuration, prevAvgDuration),
    } satisfies MetricSummaryItem,
  };

  // 4. Normalize Top Pages
  const safePages = Array.isArray(rawPages) ? rawPages : [];
  const topPages: RankedMetricItem[] = safePages
    .filter((item) => item && item.x !== null && item.x !== "")
    .slice(0, 5)
    .map((item) => ({
      name: item.x ?? "/",
      count: item.y ?? 0,
    }));

  // 5. Normalize Referrers
  const safeReferrers = Array.isArray(rawReferrers) ? rawReferrers : [];
  const topReferrers: RankedMetricItem[] = safeReferrers
    .filter((item) => item && item.x !== null && item.x !== "")
    .slice(0, 5)
    .map((item) => ({
      name: item.x ?? "(مستقیم / نامشخص)",
      count: item.y ?? 0,
    }));

  // 6. Normalize UTM Sources
  const safeUtmSources = Array.isArray(rawUtmSources) ? rawUtmSources : [];
  const utmSources: RankedMetricItem[] = safeUtmSources
    .filter((item) => item && item.x !== null && item.x !== "")
    .slice(0, 5)
    .map((item) => ({
      name: item.x ?? "(بدون منبع)",
      count: item.y ?? 0,
    }));

  // 7. Normalize UTM Breakdowns (e.g. Instagram Story vs Bio)
  const utmBreakdowns: UtmBreakdownItem[] = (rawBreakdowns ?? []).map((b) => {
    const safeItems = Array.isArray(b.items) ? b.items : [];
    const matchedSource = safeUtmSources.find(
      (s) => s?.x && s.x.toLowerCase() === b.source.toLowerCase()
    );
    const total = matchedSource?.y ?? safeItems.reduce((sum, item) => sum + (item.y ?? 0), 0);
    const contentBreakdown: RankedMetricItem[] = safeItems
      .filter((item) => item && item.x !== null && item.x !== "")
      .slice(0, 5)
      .map((item) => ({
        name: item.x ?? "(نامشخص)",
        count: item.y ?? 0,
      }));

    return {
      source: b.source,
      totalVisitors: total,
      contentBreakdown,
    };
  });

  // 8. Normalize Custom Events
  const safeEvents = Array.isArray(rawEvents) ? rawEvents : [];
  const rawEventMap = new Map<string, number>();
  for (const ev of safeEvents) {
    if (ev && ev.x) {
      rawEventMap.set(ev.x, ev.y ?? 0);
    }
  }

  const events: CustomEventReportItem[] = [];
  const configuredEvents = project.trackedEvents ?? [];

  if (configuredEvents.length > 0) {
    // Show only explicitly configured events
    for (const conf of configuredEvents) {
      const count = rawEventMap.get(conf.name) ?? 0;
      events.push({
        name: conf.name,
        label: conf.label ?? conf.name,
        count,
      });
    }
  } else {
    // If no events explicitly configured, show top 5 active events
    for (const ev of safeEvents.slice(0, 5)) {
      if (ev && ev.x) {
        events.push({
          name: ev.x,
          label: ev.x,
          count: ev.y ?? 0,
        });
      }
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    websiteId: project.umamiWebsiteId,
    timezone: project.timezone,
    period,
    periodLabel: window.labelPersian,
    generatedAt: now,
    summary,
    topPages,
    topReferrers,
    utmSources,
    utmBreakdowns,
    events,
    warnings,
  };
}
