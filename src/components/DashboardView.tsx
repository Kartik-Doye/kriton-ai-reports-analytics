import { useEffect, useRef, useState, useMemo } from 'react';
import { DashboardSpec } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as htmlToImage from 'html-to-image';
import * as Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageCircle, X, Send, Bot, User, AlertTriangle, Database, ShieldAlert,
  Zap, ChevronRight, ChevronDown, TrendingUp, TrendingDown, Filter, Layers, BarChart3, PieChart as PieIcon, Sparkles
} from 'lucide-react';
import Markdown from 'react-markdown';
import { fetchWithRetry } from '../utils/retry';

interface Props {
  jobId: string;
  jobToken: string;
  spec: DashboardSpec;
  data: any[];
  autoExport: boolean;
  dataQuality?: { totalRecords: number; rowsExcluded: number };
  cleaningLog?: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardView({ jobId, jobToken, spec, data, autoExport, dataQuality, cleaningLog }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exported, setExported] = useState(false);
  const [showAllCharts, setShowAllCharts] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'detailed' | 'summary') || 'detailed';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('dashboard_theme') as 'light' | 'dark') || 'light';
  });
  const pages = spec.pages || [];
  const [activeCategoryId, setActiveCategoryId] = useState<string>(pages[0]?.id || '');
  
  // Filter out charts that reference non-existent columns or mismatch chart types
  const schemaKeys = data.length > 0 ? Object.keys(data[0]) : [];
  
  const validateChart = (chart: any) => {
    if (!schemaKeys.includes(chart.x) || (chart.y && !schemaKeys.includes(chart.y))) {
      return false; // Column does not exist
    }
    
    // Check cardinality for pie charts
    if (chart.type === 'pie') {
      const uniqueValues = new Set(data.map(r => String(r[chart.x]))).size;
      if (uniqueValues > 10) {
        chart.type = 'bar'; // Auto-convert to bar chart if cardinality is too high
      }
    }
    return true;
  };

  const activePageData = pages.find(p => p.id === activeCategoryId) || pages[0] || { kpis: [], charts: [], insights: [], id: '', title: '' };
  
  // Create a validated copy
  const validatedPageData = {
    ...activePageData,
    charts: (activePageData.charts || []).filter(validateChart)
  };

  
  const [drilldown, setDrilldown] = useState<{ chartTitle: string, filterValue: string, dataPoints: any[] } | null>(null);

  // Chat with Data state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  


  const [dataToUse, setDataToUse] = useState<any[]>(data);
  const [crossFilter, setCrossFilter] = useState<{ field: string; value: string; chartId?: string } | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  
  useEffect(() => {
    if (crossFilter) {
      setDataToUse(data.filter(r => String(r[crossFilter.field]) === crossFilter.value));
    } else {
      setDataToUse(data);
    }
  }, [crossFilter, data]);
  
  const allColumns = data.length > 0 ? Object.keys(data[0]) : [];
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(allColumns.slice(0, 10)));
  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setSectionsCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  // Detect if a time series dimension exists in the dataset
  const timeSeriesDimension = useMemo(() => {
    if (!data || data.length === 0) return null;
    const sample = data.slice(0, 25);
    const keys = Object.keys(data[0]);
    // 1. Column name keywords
    const namedTimeCol = keys.find(k => /date|time|timestamp|created|period|year|month|day/i.test(k));
    if (namedTimeCol) return namedTimeCol;
    // 2. Parseable dates in sample
    for (const key of keys) {
      let validCount = 0;
      for (const row of sample) {
        const val = row[key];
        if (val && typeof val !== 'number') {
          const parsed = Date.parse(String(val));
          if (!isNaN(parsed) && String(val).trim().length >= 4) {
            validCount++;
          }
        }
      }
      if (validCount >= Math.min(10, Math.floor(sample.length * 0.7))) {
        return key;
      }
    }
    return null;
  }, [data]);

  // Thematic grouping of charts with hard limit of 12 by default
  const thematicGroups = useMemo(() => {
    const allPageCharts = [...(validatedPageData.charts || [])];
    if (showAllCharts && (validatedPageData as any).hiddenCharts) {
      allPageCharts.push(...(validatedPageData as any).hiddenCharts.filter(validateChart));
    }
    
    // Apply hard limit (12) if showAllCharts is false
    const HARD_LIMIT = 12;
    const chartsToCategorize = showAllCharts ? allPageCharts : allPageCharts.slice(0, HARD_LIMIT);

    const timeSeriesCharts: any[] = [];
    const distributionCharts: any[] = [];
    const comparativeCharts: any[] = [];

    chartsToCategorize.forEach(chart => {
      const isTime = chart.type === 'line' || /date|time|year|month|day|created/i.test(chart.x);
      if (isTime) {
        timeSeriesCharts.push(chart);
      } else if (chart.type === 'pie' || (chart.type === 'bar' && chart.agg === 'count')) {
        distributionCharts.push(chart);
      } else {
        comparativeCharts.push(chart);
      }
    });

    const groups: {
      id: string;
      title: string;
      description: string;
      icon: any;
      charts: any[];
    }[] = [];

    if (timeSeriesCharts.length > 0) {
      groups.push({
        id: 'temporal_trends',
        title: 'Time Series & Trends',
        description: 'Chronological progression, baseline comparisons, and trajectory patterns',
        icon: TrendingUp,
        charts: timeSeriesCharts
      });
    }

    if (distributionCharts.length > 0) {
      groups.push({
        id: 'categorical_distributions',
        title: 'Distributions & Categorical Breakdown',
        description: 'Frequency segments, share of total, and proportional splits across categories',
        icon: PieIcon,
        charts: distributionCharts
      });
    }

    if (comparativeCharts.length > 0) {
      groups.push({
        id: 'metric_comparisons',
        title: 'Comparative Metrics & Aggregations',
        description: 'Numerical aggregates, cross-dimensional comparisons, and key performance metrics',
        icon: BarChart3,
        charts: comparativeCharts
      });
    }

    if (groups.length === 0 && chartsToCategorize.length > 0) {
      groups.push({
        id: 'core_visualizations',
        title: 'Primary Analytics & Visualizations',
        description: 'Key metrics and patterns discovered across the dataset',
        icon: BarChart3,
        charts: chartsToCategorize
      });
    }

    return groups;
  }, [validatedPageData.charts, (validatedPageData as any).hiddenCharts, showAllCharts]);

  const totalAvailableChartsCount = (validatedPageData.charts?.length || 0) + ((validatedPageData as any).hiddenCharts?.length || 0);

  const [collapsedThematicGroups, setCollapsedThematicGroups] = useState<Record<string, boolean>>({});
  const toggleThematicGroup = (groupId: string) => {
    setCollapsedThematicGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };
  const expandAllGroups = () => setCollapsedThematicGroups({});
  const collapseAllGroups = () => {
    const allC: Record<string, boolean> = {};
    thematicGroups.forEach(g => { allC[g.id] = true; });
    setCollapsedThematicGroups(allC);
  };

  const handleChartClick = (chartSpec: any, e: any) => {
    let xVal: string | null = null;
    if (e && e.activePayload && e.activePayload.length > 0) {
      xVal = String(e.activePayload[0].payload.x);
    } else if (e && e.payload && e.payload.x !== undefined) {
      xVal = String(e.payload.x);
    } else if (e && e.name !== undefined) {
      xVal = String(e.name);
    } else if (e && e.x !== undefined) {
      xVal = String(e.x);
    }
    
    if (!xVal) return;
    
    if (crossFilter && crossFilter.field === chartSpec.x && crossFilter.value === xVal) {
      setCrossFilter(null);
    } else {
      setCrossFilter({ field: chartSpec.x, value: xVal, chartId: chartSpec.id });
    }
  };

  const handleExportCsv = () => {
    const csv = Papa.unparse(data.map(row => {
      const exportRow: any = {};
      Array.from(selectedColumns).forEach((c: string) => exportRow[c] = row[c]);
      return exportRow;
    }));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kriton_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const newMessage = { role: 'user' as const, content: chatMessage };
    setChatHistory([...chatHistory, newMessage]);
    setChatMessage('');
    setIsChatLoading(true);

    try {
      const res = await fetchWithRetry(`/api/job/${jobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatMessage, jobToken })
      });
      const resData = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: resData.reply }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, failed to get a response.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Group data for charts
  
  const isValidChart = (chart: any, chartData: any[]) => {
    if (!chartData || chartData.length === 0) return false;
    // Check if at least one data point has a non-zero, valid y value
    const hasValidY = chartData.some(d => d.y !== 0 && !isNaN(d.y));
    return hasValidY;
  };

  const processChartData = (chartSpec: DashboardSpec['pages'][0]['charts'][0]) => {
    const map = new Map<string, { x: string; y: number; count: number }>();
    
    dataToUse.forEach(row => {
      const xVal = String(row[chartSpec.x] || 'Unknown');
      const yVal = Number(row[chartSpec.y]) || 0;
      
      if (!map.has(xVal)) {
        map.set(xVal, { x: xVal, y: 0, count: 0 });
      }
      
      const current = map.get(xVal)!;
      current.count++;
      
      if (chartSpec.agg === 'sum' || chartSpec.agg === 'avg') {
        current.y += yVal;
      } else if (chartSpec.agg === 'max') {
        current.y = Math.max(current.y, yVal);
      } else if (chartSpec.agg === 'min') {
        current.y = current.count === 1 ? yVal : Math.min(current.y, yVal);
      }
    });

    const result = Array.from(map.values());
    if (chartSpec.agg === 'avg') {
      result.forEach(r => r.y = r.y / r.count);
    } else if (chartSpec.agg === 'count') {
      result.forEach(r => r.y = r.count);
    }

    result.forEach(r => r.y = Math.round(r.y * 100) / 100);
    return result.slice(0, 50); // limit points
  };

  const computeKpiValue = (kpi: any, dataset: any[]) => {
    let result = 0;
    if (kpi.agg === 'count') return dataset.length;
    
    dataset.forEach(row => {
      const val = Number(row[kpi.field]) || 0;
      if (kpi.agg === 'sum' || kpi.agg === 'avg') result += val;
      if (kpi.agg === 'max') result = dataset.length === 0 ? 0 : Math.max(result, val);
      if (kpi.agg === 'min') result = dataset.length === 0 ? 0 : (result === 0 ? val : Math.min(result, val));
    });
    
    if (kpi.agg === 'avg' && dataset.length > 0) result /= dataset.length;
    return result;
  };

  const formatKpi = (result: number) => {
    if (result > 1000000) return (result / 1000000).toFixed(2) + 'M';
    if (result > 1000) return (result / 1000).toFixed(2) + 'k';
    return result.toFixed(2);
  };

  const processKpiWithDelta = (kpi: any) => {
    const currentValue = computeKpiValue(kpi, dataToUse);
    let delta = 0;
    const sparkline: { value: number }[] = [];
    const hasTimeSeries = Boolean(timeSeriesDimension);

    // Prepare chronological dataset for historical baseline comparison and sparkline
    let chronologicalData = [...dataToUse];
    if (timeSeriesDimension) {
      chronologicalData.sort((a, b) => {
        const tA = new Date(a[timeSeriesDimension]).getTime() || 0;
        const tB = new Date(b[timeSeriesDimension]).getTime() || 0;
        return tA - tB;
      });
    }

    if (chronologicalData.length >= 4) {
      const mid = Math.floor(chronologicalData.length / 2);
      const baselineData = chronologicalData.slice(0, mid);
      const currentPeriodData = chronologicalData.slice(mid);

      const baselineVal = computeKpiValue(kpi, baselineData);
      const currentPeriodVal = computeKpiValue(kpi, currentPeriodData);

      if (baselineVal !== 0) {
        delta = Math.round(((currentPeriodVal - baselineVal) / Math.abs(baselineVal)) * 1000) / 10;
      }

      // Generate 8-10 points for sparkline across chronological slices
      const numBuckets = Math.min(10, Math.floor(chronologicalData.length / 2));
      const bucketSize = Math.max(1, Math.floor(chronologicalData.length / numBuckets));
      for (let i = 0; i < numBuckets; i++) {
        const bucket = chronologicalData.slice(i * bucketSize, (i + 1) * bucketSize);
        if (bucket.length > 0) {
          sparkline.push({ value: computeKpiValue(kpi, bucket) });
        }
      }
    }

    return {
      formatted: formatKpi(currentValue),
      delta: isNaN(delta) ? 0 : delta,
      sparkline,
      hasTimeSeries,
      timeCol: timeSeriesDimension
    };
  };

  return (
    <div className={`p-6 rounded-2xl shadow-sm border flex flex-col h-full ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'}`} ref={containerRef}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Dashboard Preview</h3>
          {crossFilter && (
            <button 
              onClick={() => setCrossFilter(null)}
              className="flex items-center gap-1 px-3 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold hover:bg-blue-500/20 transition-colors"
            >
              Filter: {crossFilter.field} = {crossFilter.value}
              <X className="w-3 h-3 ml-1" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!autoExport && (
            <>
              <div className={`flex rounded-lg p-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <button
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${theme === 'light' ? 'bg-white shadow-sm text-slate-900' : ('text-slate-500 hover:text-slate-700')}`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : ('text-slate-500 hover:text-slate-700')}`}
                >
                  Dark
                </button>
              </div>
              <div className={`flex rounded-lg p-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <button
                  onClick={() => { setShowRawData(false); setViewMode('summary'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'summary' && !showRawData ? (theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-slate-900') : ('text-slate-500 hover:text-slate-700')}`}
                >
                  Summary
                </button>
                <button
                  onClick={() => { setShowRawData(false); setViewMode('detailed'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'detailed' && !showRawData ? (theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-slate-900') : ('text-slate-500 hover:text-slate-700')}`}
                >
                  Detailed
                </button>
                <button
                  onClick={() => setShowRawData(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${showRawData ? (theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-slate-900') : ('text-slate-500 hover:text-slate-700')}`}
                >
                  Raw Data
                </button>
              </div>
            </>
          )}
          <span className={`text-xs px-2 py-1 rounded font-medium ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>DRAFT MODE</span>
        </div>
      </div>
      
      
      {/* Global Metadata / Data Quality & Cleaning Card */}
      {(dataQuality || cleaningLog) && (
        <div className={`mb-6 rounded-xl border overflow-hidden ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          {dataQuality && (
            <div className="p-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Total Records</p>
                  <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{dataQuality.totalRecords.toLocaleString()}</p>
                </div>
              </div>
              
              {dataQuality.rowsExcluded > 0 && (
                <div className="flex items-center gap-3 border-l pl-6 border-slate-300 dark:border-slate-700">
                  <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Excluded (Missing/Error)</p>
                    <p className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{dataQuality.rowsExcluded.toLocaleString()} rows</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {cleaningLog && (
             <div className={`p-4 border-t text-sm ${theme === 'dark' ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}>
               <h4 className="font-semibold mb-2 flex items-center gap-2">
                 <Zap className="w-4 h-4 text-emerald-500" />
                 Data Cleaning Actions Applied
               </h4>
               <ul className="list-disc pl-5 space-y-1">
                 {cleaningLog.split('\n').filter(Boolean).map((log, i) => (
                   <li key={i}>{log}</li>
                 ))}
               </ul>
             </div>
          )}
        </div>
      )}

      {/* Anomalies Section */}
      {(spec as any).anomalies && (spec as any).anomalies.length > 0 && (
        <div className={`mb-6 p-4 rounded-xl border ${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`w-5 h-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} />
            <h4 className={`font-semibold ${theme === 'dark' ? 'text-red-400' : 'text-red-700'}`}>Statistical Anomalies & Outliers</h4>
          </div>
          <ul className="space-y-2">
            {(spec as any).anomalies.map((anom: any, idx: number) => (
              <li key={idx} className={`text-sm flex gap-2 items-start ${theme === 'dark' ? 'text-red-200' : 'text-red-900'}`}>
                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>{typeof anom === 'string' ? anom : anom.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category Tabs */}
      {!autoExport && pages.length > 1 && !showRawData && (
        <div className={`mb-6 flex border-b ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="flex gap-4 overflow-x-auto pb-[-1px]">
            {pages.map((page, idx) => (
              <button
                key={idx}
                onClick={() => setActiveCategoryId(page.id)}
                className={`py-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeCategoryId === page.id
                    ? (theme === 'dark' ? 'border-blue-500 text-blue-400' : 'border-blue-600 text-blue-700')
                    : (theme === 'dark' ? 'border-transparent text-slate-400 hover:text-slate-300' : 'border-transparent text-slate-500 hover:text-slate-700')
                }`}
              >
                {page.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {showRawData ? (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center justify-between">
            <div className={`p-4 rounded-xl border flex-1 w-full ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
              <h4 className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>Columns to Export</h4>
              <div className="flex flex-wrap gap-2">
                {allColumns.map(col => (
                  <label key={col} className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                    selectedColumns.has(col)
                      ? (theme === 'dark' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700')
                      : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500')
                  }`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selectedColumns.has(col)}
                      onChange={(e) => {
                        const newSet = new Set(selectedColumns);
                        if (e.target.checked) newSet.add(col);
                        else newSet.delete(col);
                        setSelectedColumns(newSet);
                      }}
                    />
                    {col}
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={handleExportCsv}
              disabled={selectedColumns.size === 0}
              className={`whitespace-nowrap px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-colors ${
                selectedColumns.size === 0
                  ? (theme === 'dark' ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400')
                  : (theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white')
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export CSV
            </button>
          </div>
          
          <div className={`flex-1 overflow-auto rounded-xl border ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white'}`}>
            <table className="w-full text-left text-sm border-collapse">
              <thead className={`sticky top-0 shadow-sm ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                <tr>
                  {allColumns.filter(c => selectedColumns.has(c)).map(key => (
                    <th key={key} className="p-3 font-semibold whitespace-nowrap">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/10">
                {data.slice(0, 500).map((row, i) => (
                  <tr key={i} className={`hover:${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                    {allColumns.filter(c => selectedColumns.has(c)).map(key => (
                      <td key={key} className={`p-3 truncate max-w-[150px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{String(row[key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 500 && (
              <div className={`p-4 text-center text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Showing first 500 rows. Export to see all {data.length} rows.
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Pages Render */}
          {(autoExport ? [{ ...pages[0], charts: (pages[0]?.charts || []).filter(validateChart) }] : [validatedPageData]).map(page => {
            const maxCharts = showAllCharts ? undefined : 12;
            const renderedCharts = page.charts.slice(0, autoExport ? 2 : maxCharts);
            const hasMoreCharts = !autoExport && page.charts.length > 12;
            
            return (
            <div key={page.id} className="mb-12">
              {autoExport && (
                <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Snapshot: {page.title}</h2>
              )}

              {/* Highlights Widget */}
          <div className={`mb-6 overflow-hidden rounded-xl border p-4 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50/50 border-blue-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`flex items-center justify-center w-6 h-6 rounded-full ${theme === 'dark' ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-blue-400' : 'text-blue-900'}`}>Top Highlights</span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
              {page.insights.map((insight, idx) => (
                <div key={idx} className={`min-w-[300px] flex-1 rounded-lg p-4 shadow-sm border snap-start ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-blue-50'}`}>
                  <p className={`text-sm font-medium leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>"{insight}"</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            {page.kpis.map((kpi, idx) => {
              const { formatted, delta, sparkline, hasTimeSeries, timeCol } = processKpiWithDelta(kpi);
              return (
                <div 
                  key={idx} 
                  className={`p-4 rounded-2xl border flex flex-col justify-between transition-all hover:shadow-md ${
                    theme === 'dark' ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white border-slate-200/90 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <p 
                      className={`text-xs font-semibold uppercase tracking-wider truncate ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`} 
                      title={kpi.label}
                    >
                      {kpi.label}
                    </p>
                    {hasTimeSeries && (
                      <span 
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap bg-blue-500/10 text-blue-500" 
                        title={`Baseline comparison calculated via chronological dimension "${timeCol}"`}
                      >
                        vs Baseline
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 mt-2">
                    <p 
                      className={`text-2xl font-bold tracking-tight truncate ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`} 
                      title={String(formatted)}
                    >
                      {formatted}
                    </p>

                    {delta !== 0 && (
                      <div 
                        className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          delta > 0 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                            : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                        }`}
                      >
                        {delta > 0 ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>

                  {sparkline && sparkline.length > 0 && (
                    <div className="h-8 w-full mt-3 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sparkline}>
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={delta >= 0 ? '#10b981' : '#f43f5e'} 
                            strokeWidth={2} 
                            dot={false} 
                            isAnimationActive={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interactive Cross-Filtering Active Banner */}
          {crossFilter && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-3 px-4 rounded-xl border flex items-center justify-between gap-3 ${
                theme === 'dark' 
                  ? 'bg-blue-950/40 border-blue-800/60 text-blue-300' 
                  : 'bg-blue-50/90 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="w-4 h-4 text-blue-500" />
                <span>
                  Cross-filtering sibling charts by <strong>{crossFilter.field}</strong> = <strong>"{crossFilter.value}"</strong>
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold">
                  {dataToUse.length} / {data.length} records
                </span>
              </div>
              <button 
                onClick={() => setCrossFilter(null)}
                className={`text-xs px-3 py-1 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
                  theme === 'dark' 
                    ? 'bg-blue-900/50 hover:bg-blue-900 text-blue-200' 
                    : 'bg-white hover:bg-blue-100 text-blue-700 shadow-sm border border-blue-200'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                Clear Filter
              </button>
            </motion.div>
          )}

          {/* Thematic Accordion Wrapper for Chart Sections */}
          {(viewMode === 'detailed' || autoExport) && (
            <div className="space-y-6 mb-8">
              {!autoExport && (
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Layers className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <h3 className={`text-base font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Thematic Chart Sections
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {thematicGroups.reduce((acc, g) => acc + g.charts.length, 0)} Charts {totalAvailableChartsCount > 12 && !showAllCharts && '(Top 12 Shown)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={expandAllGroups}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      Expand All
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      onClick={collapseAllGroups}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                        theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              )}

              {thematicGroups.map((group) => {
                const isCollapsed = Boolean(collapsedThematicGroups[group.id]) && !autoExport;
                const Icon = group.icon;
                const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';
                const tooltipStyle = {
                  backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                  color: theme === 'dark' ? '#fff' : '#000',
                  borderRadius: '8px', 
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', 
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                };

                return (
                  <div 
                    key={group.id}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/90 shadow-sm'
                    }`}
                  >
                    {/* Collapsible Accordion Header */}
                    <div 
                      onClick={() => toggleThematicGroup(group.id)}
                      className={`p-4 flex items-center justify-between cursor-pointer select-none transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-slate-800/50 bg-slate-800/20 border-b border-slate-800/60'
                          : 'hover:bg-slate-50/80 bg-slate-50/40 border-b border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${
                          theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                              {group.title}
                            </h4>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {group.charts.length} {group.charts.length === 1 ? 'Chart' : 'Charts'}
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {group.description}
                          </p>
                        </div>
                      </div>

                      <button 
                        type="button"
                        className={`p-1.5 rounded-lg transition-colors ${
                          theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Collapsible Accordion Body */}
                    {!isCollapsed && (
                      <div className="p-5">
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                          {group.charts.map((chart, idx) => {
                            const chartData = processChartData(chart);
                            if (!isValidChart(chart, chartData)) return null;

                            return (
                              <motion.div 
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05, duration: 0.4 }}
                                key={chart.id || idx} 
                                className={`group relative overflow-hidden rounded-3xl p-6 shadow-sm h-96 flex flex-col transition-all hover:scale-[1.01] ${
                                  theme === 'dark' ? 'bg-black/30 border border-white/10' : 'bg-white/60 border border-black/5'
                                } backdrop-blur-xl`}
                              >
                                <div className="flex items-center justify-between mb-4 relative z-10">
                                  <h3 className={`text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                    {chart.chartTitle || chart.title}
                                  </h3>
                                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                    Click element to cross-filter
                                  </span>
                                </div>
                                <div className="flex-1 min-h-0 relative z-10">
                                  <ResponsiveContainer width="99%" height="100%">
                                    {chart.type === 'line' ? (
                                      <LineChart data={chartData} onClick={(e) => handleChartClick(chart, e)} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                                        <XAxis dataKey="x" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} label={{ value: chart.xAxisLabel || chart.x, position: 'insideBottom', offset: -15, fill: axisColor, fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} label={{ value: chart.yAxisLabel || chart.y, angle: -90, position: 'insideLeft', offset: -10, fill: axisColor, fontSize: 12 }} />
                                        <Tooltip formatter={(value: number) => value} contentStyle={tooltipStyle} />
                                        <Legend wrapperStyle={{ fontSize: '12px', color: axisColor, paddingTop: '20px' }} />
                                        <Line type="monotone" dataKey="y" stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} name={chart.y} />
                                      </LineChart>
                                    ) : chart.type === 'bar' ? (
                                      <BarChart data={chartData} onClick={(e) => handleChartClick(chart, e)} margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                                        <XAxis dataKey="x" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} label={{ value: chart.xAxisLabel || chart.x, position: 'insideBottom', offset: -15, fill: axisColor, fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} label={{ value: chart.yAxisLabel || chart.y, angle: -90, position: 'insideLeft', offset: -10, fill: axisColor, fontSize: 12 }} />
                                        <Tooltip formatter={(value: number) => value} contentStyle={tooltipStyle} />
                                        <Legend wrapperStyle={{ fontSize: '12px', color: axisColor, paddingTop: '20px' }} />
                                        <Bar dataKey="y" name={chart.y} radius={[4, 4, 0, 0]} className="cursor-pointer">
                                          {chartData.map((entry, cIdx) => {
                                            const isSelected = crossFilter ? entry.x === crossFilter.value : true;
                                            const isFilterOrigin = crossFilter && crossFilter.chartId === chart.id;
                                            return (
                                              <Cell 
                                                key={`cell-${cIdx}`} 
                                                fill={COLORS[cIdx % COLORS.length]} 
                                                fillOpacity={isFilterOrigin ? (isSelected ? 1 : 0.3) : 1}
                                              />
                                            );
                                          })}
                                        </Bar>
                                      </BarChart>
                                    ) : (
                                      <PieChart>
                                        <Pie 
                                          data={chartData} 
                                          dataKey="y" 
                                          nameKey="x" 
                                          cx="50%" 
                                          cy="50%" 
                                          innerRadius={60} 
                                          outerRadius={80} 
                                          paddingAngle={5} 
                                          onClick={(entry) => handleChartClick(chart, { activePayload: [{ payload: entry }] })} 
                                          className="cursor-pointer"
                                        >
                                          {chartData.map((entry, cIdx) => {
                                            const isSelected = crossFilter ? entry.x === crossFilter.value : true;
                                            const isFilterOrigin = crossFilter && crossFilter.chartId === chart.id;
                                            return (
                                              <Cell 
                                                key={`cell-${cIdx}`} 
                                                fill={COLORS[cIdx % COLORS.length]} 
                                                fillOpacity={isFilterOrigin ? (isSelected ? 1 : 0.3) : 1}
                                              />
                                            );
                                          })}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => value} contentStyle={tooltipStyle} />
                                        <Legend wrapperStyle={{ fontSize: '12px', color: axisColor }} />
                                      </PieChart>
                                    )}
                                  </ResponsiveContainer>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Hard Limit / Show More Button */}
              {totalAvailableChartsCount > 12 && !autoExport && (
                <div className="flex justify-center my-6">
                  {!showAllCharts ? (
                    <button 
                      onClick={() => setShowAllCharts(true)} 
                      className={`px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm transition-all hover:scale-105 ${
                        theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      Show More ({totalAvailableChartsCount - 12} Hidden Insights & Charts Available)
                    </button>
                  ) : (
                    <button 
                      onClick={() => setShowAllCharts(false)} 
                      className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                        theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      }`}
                    >
                      Show Fewer (Top 12 Charts Focus Mode)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {(viewMode === 'detailed' || autoExport) && (
          <div className="mt-auto">
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-slate-950 border border-slate-800' : 'bg-slate-900'}`}>
              <div className="flex items-center justify-between mb-3 cursor-pointer group" onClick={() => toggleSection(page.id + '_insights')}>
                <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">All Insights</span>
                </div>
                {!autoExport && (
                  <button className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'text-slate-400 group-hover:bg-slate-800' : 'text-slate-500 group-hover:bg-slate-200'}`}>
                      {sectionsCollapsed[page.id + '_insights'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {(!sectionsCollapsed[page.id + '_insights'] || autoExport) && (
              <ul className="space-y-3">
                {page.insights.map((insight, idx) => (
                  <li key={idx} className="text-xs text-white leading-relaxed font-serif italic">
                    "{insight}"
                  </li>
                ))}
              </ul>
            )}
            </div>
          </div>
          )}
        </div>
      )})}
      {autoExport && (
        <div className={`text-center p-6 mt-8 rounded-xl font-semibold border ${theme === 'dark' ? 'bg-slate-800/50 text-slate-300 border-slate-700' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
          Full interactive dashboard with more charts, cross-filtering, and pages available in the online report.
        </div>
      )}
      </>
      )}
      
      {drilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`w-full max-w-4xl max-h-[80vh] flex flex-col rounded-2xl shadow-xl overflow-hidden ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div>
                <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{drilldown.chartTitle} - Drilldown</h3>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Segment: {drilldown.filterValue} ({drilldown.dataPoints.length} records)</p>
              </div>
              <button onClick={() => setDrilldown(null)} className="p-2 rounded-full hover:bg-slate-200/20 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-0 overflow-auto flex-1">
              <table className="w-full text-left text-sm border-collapse">
                <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                  <tr>
                    {Object.keys(drilldown.dataPoints[0] || {}).map(key => (
                      <th key={key} className="p-3 font-semibold whitespace-nowrap">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/10">
                  {drilldown.dataPoints.map((row, i) => (
                    <tr key={i} className={`hover:${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className={`p-3 truncate max-w-[150px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {drilldown.dataPoints.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">No data points found for this segment.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Chat */}
      <button 
        onClick={() => setIsChatOpen(true)}
        className={`fixed bottom-16 right-6 p-4 rounded-full shadow-2xl transition-transform hover:scale-110 z-40 ${theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}`}
        style={{ display: isChatOpen ? 'none' : 'block' }}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed top-0 right-0 h-full w-full sm:w-96 shadow-2xl z-50 flex flex-col ${theme === 'dark' ? 'bg-slate-900 border-l border-slate-800' : 'bg-white border-l border-slate-200'}`}
          >
            <div className={`p-4 border-b flex justify-between items-center ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2">
                <Bot className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                <h3 className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Chat with Data</h3>
              </div>
              <button onClick={() => setIsChatOpen(false)} className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
              {chatHistory.length === 0 && (
                <div className={`text-center mt-10 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Ask me anything about your dataset!</p>
                  <p className="text-xs mt-1">E.g., "Why did sales drop in Q3?"</p>
                </div>
              )}
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-600 text-white' : (theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-blue-100 text-blue-600')}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm overflow-hidden ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : (theme === 'dark' ? 'bg-slate-800 text-slate-200 rounded-tl-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm')
                  }`}>
                    {msg.role === 'user' ? (
                      msg.content
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex gap-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-slate-800 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className={`rounded-2xl px-4 py-3 text-sm rounded-tl-none flex items-center gap-2 ${theme === 'dark' ? 'bg-slate-800 text-slate-200' : 'bg-white border border-slate-200 shadow-sm'}`}>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
              <div className={`flex items-center gap-2 rounded-full px-4 py-2 border focus-within:ring-2 focus-within:ring-blue-500/50 ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <input 
                  type="text" 
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask a question..."
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || isChatLoading}
                  className="p-1.5 rounded-full bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
