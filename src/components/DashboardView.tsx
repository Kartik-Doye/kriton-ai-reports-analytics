import { useEffect, useRef, useState, useMemo } from 'react';
import { DashboardSpec } from '../types';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as htmlToImage from 'html-to-image';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';

interface Props {
  jobId: string;
  spec: DashboardSpec;
  data: any[];
  autoExport: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardView({ jobId, spec, data, autoExport }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exported, setExported] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'detailed' | 'summary') || 'detailed';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('dashboard_theme') as 'light' | 'dark') || 'light';
  });
  const pages = spec.pages || [];
  const [activeCategoryId, setActiveCategoryId] = useState<string>(pages[0]?.id || '');
  const activePageData = pages.find(p => p.id === activeCategoryId) || pages[0] || { kpis: [], charts: [], insights: [], id: '', title: '' };
  
  const [drilldown, setDrilldown] = useState<{ chartTitle: string, filterValue: string, dataPoints: any[] } | null>(null);

  // Chat with Data state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChatOpen && chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatOpen]);

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const msg = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setIsChatLoading(true);

    try {
      const response = await fetch(`/api/job/${jobId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await response.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, I encountered an error.' }]);
    } catch (err) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Connection failed. Please try again later.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  
  const [showRawData, setShowRawData] = useState(false);
  const allColumns = useMemo(() => Object.keys(data[0] || {}), [data]);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(() => new Set(allColumns));
  const [crossFilter, setCrossFilter] = useState<{ field: string, value: string } | null>(null);

  const dataToUse = useMemo(() => {
    if (!crossFilter) return data;
    return data.filter(row => String(row[crossFilter.field]) === crossFilter.value);
  }, [data, crossFilter]);

  const handleChartClick = (chart: DashboardSpec['pages'][0]['charts'][0], event: any) => {
    if (!event || (!event.activePayload && !event.payload)) return;
    const xValue = event.activePayload ? event.activePayload[0].payload.x : event.payload.x;
    if (xValue === undefined) return;
    
    // Toggle global cross-filter
    if (crossFilter && crossFilter.field === chart.x && crossFilter.value === String(xValue)) {
      setCrossFilter(null);
    } else {
      setCrossFilter({ field: chart.x, value: String(xValue) });
    }
    
    // Also show drilldown
    const dataPoints = data.filter(row => String(row[chart.x]) === String(xValue));
    setDrilldown({ chartTitle: chart.title, filterValue: String(xValue), dataPoints });
  };

  const handleExportCsv = () => {
    const filteredData = data.map(row => {
      const newRow: any = {};
      selectedColumns.forEach(col => {
        if (row[col] !== undefined) newRow[col] = row[col];
      });
      return newRow;
    });
    const csv = Papa.unparse(filteredData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'raw_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    localStorage.setItem('dashboard_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('dashboard_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (autoExport && !exported && containerRef.current) {
      // Small delay to ensure charts are fully rendered
      const timer = setTimeout(async () => {
        try {
          if (!containerRef.current) return;
          const el = containerRef.current;
          
          // Force explicit dimensions so html-to-image captures the entire scrollable area
          const originalWidth = el.style.width;
          const originalHeight = el.style.height;
          const fullWidth = el.scrollWidth;
          const fullHeight = el.scrollHeight;
          
          el.style.width = `${fullWidth}px`;
          el.style.height = `${fullHeight}px`;

          const imgData = await htmlToImage.toPng(el, {
            pixelRatio: 2,
            width: fullWidth,
            height: fullHeight,
          });
          
          el.style.width = originalWidth;
          el.style.height = originalHeight;

          await fetch(`/api/job/${jobId}/dashboard-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imgData })
          });
          setExported(true);
        } catch (e) {
          console.error('Failed to export dashboard', e);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [autoExport, exported, jobId]);

  // Group data for charts
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
    
    const mid = Math.floor(dataToUse.length / 2);
    const firstHalfValue = computeKpiValue(kpi, dataToUse.slice(0, mid));
    const secondHalfValue = computeKpiValue(kpi, dataToUse.slice(mid));
    
    let delta = 0;
    if (firstHalfValue !== 0) {
      delta = ((secondHalfValue - firstHalfValue) / Math.abs(firstHalfValue)) * 100;
    }
    
    return {
      formatted: formatKpi(currentValue),
      delta: isNaN(delta) ? 0 : delta
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
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${theme === 'light' ? 'bg-white shadow-sm text-slate-900' : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  Dark
                </button>
              </div>
              <div className={`flex rounded-lg p-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <button
                  onClick={() => { setShowRawData(false); setViewMode('summary'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'summary' && !showRawData ? (theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-slate-900') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  Summary
                </button>
                <button
                  onClick={() => { setShowRawData(false); setViewMode('detailed'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${viewMode === 'detailed' && !showRawData ? (theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-slate-900') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  Detailed
                </button>
                <button
                  onClick={() => setShowRawData(true)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${showRawData ? (theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'bg-white shadow-sm text-slate-900') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700')}`}
                >
                  Raw Data
                </button>
              </div>
            </>
          )}
          <span className={`text-xs px-2 py-1 rounded font-medium ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>DRAFT MODE</span>
        </div>
      </div>
      
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
          {(autoExport ? pages : [activePageData]).map(page => (
            <div key={page.id} className="mb-12">
              {autoExport && (
                <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{page.title}</h2>
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
              const { formatted, delta } = processKpiWithDelta(kpi);
              return (
                <div key={idx} className={`p-4 rounded-xl border flex flex-col justify-between ${theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-blue-50/30 border-slate-100'}`}>
                  <p className={`text-xs font-medium mb-1 truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} title={kpi.label}>{kpi.label}</p>
                  <div className="flex items-end justify-between gap-2 mt-1">
                    <p className={`text-2xl font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`} title={String(formatted)}>{formatted}</p>
                    {delta !== 0 && (
                      <span className={`text-[10px] font-bold flex items-center mb-1 ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(viewMode === 'detailed' || autoExport) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
              {page.charts.map((chart, idx) => {
              const chartData = processChartData(chart);
              const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';
              const tooltipStyle = {
                backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                color: theme === 'dark' ? '#fff' : '#000',
                borderRadius: '8px', 
                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', 
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              };

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  key={idx} 
                  className={`group relative overflow-hidden rounded-3xl p-6 shadow-xl h-96 flex flex-col transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-black/30 border border-white/10' : 'bg-white/60 border border-black/5'} backdrop-blur-xl`}
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/0 via-purple-500/0 to-emerald-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-emerald-500/5 transition-colors duration-500" />
                  <h3 className={`text-base font-bold mb-6 tracking-tight relative z-10 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{chart.chartTitle || chart.title}</h3>
                  <div className="flex-1 min-h-0 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
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
                        <Bar dataKey="y" fill={COLORS[idx % COLORS.length]} radius={[4, 4, 0, 0]} name={chart.y} className="cursor-pointer" />
                      </BarChart>
                    ) : (
                      <PieChart>
                        <Pie data={chartData} dataKey="y" nameKey="x" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} onClick={(e) => handleChartClick(chart, { payload: e })} className="cursor-pointer">
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
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
          )}

          {(viewMode === 'detailed' || autoExport) && (
          <div className="mt-auto">
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-slate-950 border border-slate-800' : 'bg-slate-900'}`}>
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">All Insights</span>
              </div>
              <ul className="space-y-3">
                {page.insights.map((insight, idx) => (
                  <li key={idx} className="text-xs text-white leading-relaxed font-serif italic">
                    "{insight}"
                  </li>
                ))}
              </ul>
            </div>
          </div>
          )}
        </div>
      ))}
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
