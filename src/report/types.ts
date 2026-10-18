import type { DateWindowType } from "../lib/dates";
import type { DeltaResult } from "../lib/percentage";

export interface MetricSummaryItem {
  value: number;
  previous: number;
  delta: DeltaResult;
}

export interface RankedMetricItem {
  name: string;
  count: number; // Unique visitors for pages/referrers/UTMs; event triggers for events
}

export interface UtmBreakdownItem {
  source: string;
  totalVisitors: number;
  contentBreakdown: RankedMetricItem[];
}

export interface CustomEventReportItem {
  name: string;
  label: string;
  count: number;
  prevCount?: number;
  delta?: DeltaResult;
}

export interface TrafficPulse {
  status: "surging" | "stable" | "declining" | "new";
  label: string;
  emoji: string;
}

export interface ReportModel {
  projectId: string;
  projectName: string;
  websiteId: string;
  timezone: string;
  period: DateWindowType;
  periodLabel: string;
  generatedAt: Date;
  pulse: TrafficPulse;
  summary: {
    visitors: MetricSummaryItem;
    visits: MetricSummaryItem;
    pageviews: MetricSummaryItem;
    bounceRate: MetricSummaryItem;
    avgDurationSeconds: MetricSummaryItem;
  };
  topPages: RankedMetricItem[];
  topReferrers: RankedMetricItem[];
  utmSources: RankedMetricItem[];
  utmBreakdowns: UtmBreakdownItem[];
  events: CustomEventReportItem[];
  warnings: string[];
}
