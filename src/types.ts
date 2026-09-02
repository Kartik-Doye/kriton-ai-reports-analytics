export interface ColumnPlan {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  format?: string;
  null_handling: string;
}

export interface CleaningPlan {
  columns: ColumnPlan[];
  dedup_keys: string[];
  outliers: {
    column: string;
    rule: string;
    threshold: string;
  }[];
}

export interface DashboardPage {
  anomalies?: { description: string }[];
  id: string;
  title: string;
  kpis: {
    label: string;
    field: string;
    agg: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }[];
  charts: {
    id: string;
    type: 'line' | 'bar' | 'pie';
    title: string;
    chartTitle?: string;
    xAxisLabel?: string;
    yAxisLabel?: string;
    x: string;
    y: string;
    agg: 'sum' | 'avg' | 'min' | 'max' | 'count';
    filter?: string;
  }[];
  insights: string[];
}

export interface DashboardSpec {
  pages: DashboardPage[];
}

export interface PipelineJob {
  id: string;
  jobToken: string;
  email: string;
  timestamp?: number;
  fileName: string;
  originalBuffer: Buffer;
  cleanedData?: any[];
  stats?: any;
  dataQuality?: { totalRecords: number; rowsExcluded: number };
  analysisMode?: 'brief' | 'detailed';
  cleaningLog?: string;
  dashboardSpec?: DashboardSpec;
  status: 'pending' | 'cleaning' | 'planning' | 'waiting_for_dashboard' | 'emailing' | 'complete' | 'error' | 'delivery_error';
  dashboardImage?: string; // base64 data url
  reportText?: string;
  reportPdf?: Buffer;
  reportHtml?: Buffer;
  accessToken?: string;
}
