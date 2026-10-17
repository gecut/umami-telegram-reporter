export interface UmamiStatsComparison {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

export interface UmamiStatsResponse {
  pageviews: number | { value: number; prev?: number; change?: number };
  visitors: number | { value: number; prev?: number; change?: number };
  visits: number | { value: number; prev?: number; change?: number };
  bounces: number | { value: number; prev?: number; change?: number };
  totaltime: number | { value: number; prev?: number; change?: number };
  comparison?: UmamiStatsComparison;
}

export interface UmamiMetricItem {
  x: string | null;
  y: number;
}

export interface UmamiEventItem {
  x: string;
  t?: string;
  y: number;
}

export interface UmamiWebsiteInfo {
  id: string;
  name: string;
  domain: string;
  shareId?: string | null;
  createdAt?: string;
}
