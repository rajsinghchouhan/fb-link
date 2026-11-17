import type {
  CampaignConfig,
  CampaignMetrics,
  ClickRecord,
  ConversionRecord,
  MetaPixelConfig,
  OverviewSummary,
} from '../lib/trackingCore';

export interface OverviewResponse {
  baseOrigin: string;
  pixels: MetaPixelConfig[];
  campaigns: CampaignConfig[];
  metricsByCampaign: Record<string, CampaignMetrics>;
  summary: OverviewSummary;
  clicks: ClickRecord[];
  conversions: ConversionRecord[];
}
