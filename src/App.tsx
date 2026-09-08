/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { UploadForm } from './components/UploadForm';
import { ProgressStepper } from './components/ProgressStepper';
import { DashboardView } from './components/DashboardView';
import { LogViewer } from './components/LogViewer';
import Loader from './components/Loader';
import FireSymbol from './components/FireSymbol';
import { ThemeToggle } from './components/ThemeToggle';
import { AmbientBackground } from './components/AmbientBackground';
import { PipelineJob, DashboardSpec } from './types';
import { 
  CheckCircle2, Circle, Loader2, Mail, FileText, FileJson, FileCode,
  Calendar as CalendarIcon, RefreshCw, AlertCircle, Globe, 
  FileSpreadsheet, Download, ExternalLink, Send, CheckSquare, Square, X 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchWithRetry } from './utils/retry';

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<PipelineJob['status']>('pending');
  const [logs, setLogs] = useState<string[]>([]);
  const [dashboardSpec, setDashboardSpec] = useState<DashboardSpec | null>(null);
  const [cleanedData, setCleanedData] = useState<any[] | null>(null);
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [cleaningLog, setCleaningLog] = useState<string>("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);

  // Email distribution modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [includePdf, setIncludePdf] = useState(true); // Default: ONLY PDF
  const [includeCsv, setIncludeCsv] = useState(false); // Default: unchecked
  const [includeHtml, setIncludeHtml] = useState(false); // Default: unchecked
  const [includeProfiling, setIncludeProfiling] = useState(false); // Default: unchecked
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailNotification, setEmailNotification] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    setJobId(null);
    setJobStatus('pending');
    setLogs([]);
    setDashboardSpec(null);
    setCleanedData(null);
    setDataQuality(null);
    setCleaningLog("");
    setStartTime(null);
    setEndTime(null);
  }, []);

  useEffect(() => {
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resetSession();
      }, INACTIVITY_TIMEOUT);
    };

    resetTimer();

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [resetSession]);

  const handleUploadSuccess = (id: string, token: string) => {
    setJobId(id);
            setJobToken(token);
    setJobStatus('cleaning');
    setLogs([]);
    setStartTime(Date.now());
    setEndTime(null);
  };

  
  const handleDeleteData = async () => {
    if (!confirm('Are you sure you want to delete all your data from the server? This cannot be undone.')) return;
    try {
      await fetchWithRetry(`/api/job/${jobId}?token=${jobToken}`, { method: 'DELETE' });
      setJobId(null);
      setJobToken(null);
      setJobStatus('pending');
      setDashboardSpec(null);
      setCleanedData(null);
      setLogs([]);
    } catch (e) {
      console.error('Failed to delete data:', e);
    }
  };

  const handleRefreshData = async () => {
    if (!confirm('Are you sure you want to re-run the pipeline with the current dataset?')) return;
    try {
      setJobStatus('cleaning');
      setLogs([]);
      setDashboardSpec(null);
      setCleanedData(null);
      setStartTime(Date.now());
      setEndTime(null);
      setRefreshTrigger(prev => prev + 1);
      await fetchWithRetry(`/api/job/${jobId}/refresh?token=${jobToken}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to refresh data:', e);
      setJobStatus('error');
    }
  };

  
  const handleRestoreJob = (id: string, token: string, status: string) => {
    setJobId(id);
    setJobToken(token);
    setJobStatus(status as any);
    setLogs(['Restoring session...']);
    setStartTime(Date.now());
    setEndTime(null);
  };

  const handleJobComplete = () => {
    setJobStatus('complete');
    setEndTime(Date.now());
  };


  useEffect(() => {
    if (!jobId || jobStatus === 'complete' || jobStatus === 'error') return;
    
    let eventSource: EventSource | null = null;
    let retryAttempt = 0;
    const maxRetries = 5;
    const initialDelay = 2000;
    let retryTimeout: NodeJS.Timeout;
    
    const connect = () => {
      eventSource = new EventSource(`/api/job/${jobId}/stream?token=${jobToken}`);
      
      eventSource.addEventListener('status', (e) => {
        retryAttempt = 0;
        const data = JSON.parse(e.data);
        setJobStatus(data.status);
        if (data.status === 'complete') {
          handleJobComplete();
          eventSource?.close();
        }
      });

      eventSource.addEventListener('log', (e) => {
        retryAttempt = 0;
        const data = JSON.parse(e.data);
        setLogs((prev) => [...prev, data.text]);
      });

      eventSource.addEventListener('spec', (e) => {
        retryAttempt = 0;
        const data = JSON.parse(e.data);
        setDashboardSpec(data.spec);
        setCleanedData(data.data);
        setDataQuality(data.dataQuality);
        setCleaningLog(data.cleaningLog || "");
      });

      eventSource.addEventListener('error', (e) => {
        eventSource?.close();
        retryAttempt++;
        if (retryAttempt > maxRetries) {
          setJobStatus('error');
        } else {
          const delay = initialDelay * Math.pow(2, retryAttempt - 1);
          console.warn(`SSE connection failed, retrying in ${delay}ms... (Attempt ${retryAttempt}/${maxRetries})`);
          retryTimeout = setTimeout(connect, delay);
        }
      });
    };

    connect();

    return () => {
      clearTimeout(retryTimeout);
      eventSource?.close();
    };
  }, [jobId, refreshTrigger]);

  return (
    <div className="h-screen bg-transparent flex flex-col  overflow-hidden text-slate-900 dark:text-slate-100 transition-colors relative">
      <AmbientBackground />
      <header className="h-16 bg-white/60 dark:bg-black/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 flex items-center justify-between px-8 flex-shrink-0 transition-colors z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3"><FireSymbol /><h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white mt-1">Kriton <span className="font-normal text-slate-500 dark:text-slate-400">v1.2</span></h1></div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative z-10">
        <AnimatePresence>
          {jobId && (
            <motion.aside 
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="w-72 bg-white/40 dark:bg-black/20 backdrop-blur-2xl border-r border-white/20 dark:border-white/10 flex flex-col p-6 flex-shrink-0 overflow-y-auto transition-colors relative z-20"
            >
              <ProgressStepper status={jobStatus} />
            </motion.aside>
          )}
        </AnimatePresence>

        <section className={`flex-1 p-8 overflow-y-auto transition-colors relative ${jobId ? 'flex flex-col' : 'flex items-center justify-center'}`}>
          <AnimatePresence mode="wait">
            {!jobId ? (
              <motion.div 
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-xl"
              >
                <UploadForm onSuccess={handleUploadSuccess} onRestore={handleRestoreJob} />
              </motion.div>
            ) : (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col h-full gap-6 w-full"
              >
                <div className="flex-1 min-h-0 overflow-hidden rounded-3xl shadow-2xl shadow-black/5 border border-white/40 dark:border-white/10 transition-colors bg-white/40 dark:bg-black/20 backdrop-blur-xl relative">
                  {dashboardSpec && cleanedData ? (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
                      className={`h-full overflow-y-auto `}
                    >
                      <DashboardView 
                        jobId={jobId!}
                        jobToken={jobToken!}
                        spec={dashboardSpec} 
                        data={cleanedData}
                        dataQuality={dataQuality}
                        cleaningLog={cleaningLog} 
                        autoExport={jobStatus === 'waiting_for_dashboard'}
                        onStartOver={resetSession}
                      />
                    </motion.div>
                  ) : (
                    <div className="p-6 h-full flex flex-col items-center justify-center transition-colors">
                      <div className="flex justify-center h-40 items-center mb-8"><Loader /></div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] animate-pulse">Analyzing & Synthesizing...</p>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {jobStatus === 'complete' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-slate-200/80 dark:border-white/10 flex-shrink-0 transition-colors"
                    >
                      <div className="text-center max-w-2xl mx-auto mb-8">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="mx-auto w-14 h-14 bg-emerald-500/15 text-emerald-500 flex items-center justify-center rounded-2xl mb-4 border border-emerald-500/20">
                          <CheckCircle2 className="w-8 h-8" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pipeline Complete!</h2>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                          Your analytics package and reports have been generated. Download any artifact below or view them directly in your browser.
                        </p>
                      </div>
                      
                      {/* Grid of Artifacts */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                        
                        {/* 1. Interactive HTML Report */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-blue-200/60 dark:border-blue-900/30 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-200/50 dark:border-blue-800/50">
                                <Globe className="w-3.5 h-3.5" /> Interactive HTML
                              </span>
                              <span className="text-[11px] text-slate-400">report_{jobId?.slice(0, 8)}.html</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              Interactive Report (open in browser)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Self-contained Chart.js report with KPI cards, dynamic charts, and cross-filtering.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                            <a 
                              href={`/api/job/${jobId}/download/html-report?token=${jobToken}`} 
                              download={`report_${jobId}.html`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
                            >
                              <Download className="w-3.5 h-3.5" /> Download HTML
                            </a>
                            <a 
                              href={`/api/job/${jobId}/download/html-report?token=${jobToken}&view=1`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                              title="Open interactive report in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Open
                            </a>
                          </div>
                        </div>

                        {/* 2. Full Data Profiling Report */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-emerald-200/60 dark:border-emerald-900/30 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200/50 dark:border-emerald-800/50">
                                <FileCode className="w-3.5 h-3.5" /> Technical Profiling
                              </span>
                              <span className="text-[11px] text-slate-400">profiling_{jobId?.slice(0, 8)}.html</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              Full Data Profiling Report (technical)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Automated dataset summary with column distributions, quantiles, missing values, and data types (opens in browser).
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                            <a 
                              href={`/api/job/${jobId}/download/profiling-report?token=${jobToken}`} 
                              download={`profiling_${jobId}.html`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                            >
                              <Download className="w-3.5 h-3.5" /> Download Report
                            </a>
                            <a 
                              href={`/api/job/${jobId}/download/profiling-report?token=${jobToken}&view=1`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                              title="Open technical profiling report in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Open
                            </a>
                          </div>
                        </div>

                        {/* 3. Executive PDF Report */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-200/50 dark:border-indigo-800/50">
                                <FileText className="w-3.5 h-3.5" /> Polished PDF
                              </span>
                              <span className="text-[11px] text-slate-400">report_{jobId?.slice(0, 8)}.pdf</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              Executive PDF Report
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Clean presentation report with executive narrative and rendered chart visuals for stakeholders.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                            <a 
                              href={`/api/job/${jobId}/download/pdf?token=${jobToken}`} 
                              download={`report_${jobId}.pdf`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white shadow-sm transition-all"
                            >
                              <Download className="w-3.5 h-3.5" /> Download PDF
                            </a>
                            <a 
                              href={`/api/job/${jobId}/download/pdf?token=${jobToken}&view=1`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-1 px-3 py-2.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                              title="View PDF in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Open
                            </a>
                          </div>
                        </div>

                        {/* 4. Cleaned CSV Dataset */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full border border-amber-200/50 dark:border-amber-800/50">
                                <FileSpreadsheet className="w-3.5 h-3.5" /> Cleaned CSV
                              </span>
                              <span className="text-[11px] text-slate-400">cleaned_data_{jobId?.slice(0, 8)}.csv</span>
                            </div>
                            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              Cleaned Dataset (CSV)
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Standardized, typed, and deduplicated tabular records ready for downstream BI tools.
                            </p>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center gap-2">
                            <a 
                              href={`/api/job/${jobId}/download/csv?token=${jobToken}`} 
                              download={`cleaned_data_${jobId}.csv`}
                              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" /> Download CSV
                            </a>
                          </div>
                        </div>

                      </div>

                      {/* Bottom action row: Download All (ZIP) and Optional Email Distribution */}
                      <div className="mt-6 pt-6 border-t border-slate-200/60 dark:border-white/10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-xl mx-auto">
                        <a 
                          href={`/api/job/${jobId}/download/zip?token=${jobToken}`} 
                          download={`analytics_package_${jobId}.zip`}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl shadow-md transition-all hover:scale-105"
                        >
                          <Download className="w-4 h-4" /> Download Complete Package (ZIP)
                        </a>
                        <button
                          type="button"
                          onClick={() => setShowEmailModal(true)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-slate-300/80 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-all"
                        >
                          <Mail className="w-4 h-4 text-blue-500" /> Share via Email...
                        </button>
                        <button
                          type="button"
                          onClick={resetSession}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 border border-red-300/80 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl transition-all"
                        >
                          <RefreshCw className="w-4 h-4" /> Start Over
                        </button>
                      </div>

                    </motion.div>
                  )}

                  {/* Email Distribution Modal */}
                  {showEmailModal && (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                      <motion.div 
                        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 text-left relative"
                      >
                        <button 
                          type="button" 
                          onClick={() => setShowEmailModal(false)}
                          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Mail className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Email Analytics Report</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Distribute report package to stakeholders</p>
                          </div>
                        </div>

                        {/* Advisory on Email Client Presentation */}
                        <div className="my-3 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                          <strong>Note:</strong> The polished PDF is the default email attachment for stakeholders. Code/HTML files are unchecked by default because email clients may display them as raw code or generic scripts.
                        </div>

                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          if (!emailRecipient || !jobId) return;
                          setIsSendingEmail(true);
                          setEmailNotification(null);
                          try {
                            const res = await fetch(`/api/job/${jobId}/email`, {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'x-job-token': jobToken || ''
                              },
                              body: JSON.stringify({
                                to: emailRecipient,
                                attachments: {
                                  pdf: includePdf,
                                  csv: includeCsv,
                                  html: includeHtml,
                                  profiling: includeProfiling
                                }
                              })
                            });
                            const data = await res.json();
                            if (res.ok) {
                              setEmailNotification(`Delivery scheduled for ${emailRecipient}. Stakeholder PDF report attached.`);
                              setTimeout(() => setShowEmailModal(false), 2500);
                            } else {
                              setEmailNotification(`Error: ${data.error || 'Failed to dispatch'}`);
                            }
                          } catch (err: any) {
                            setEmailNotification(`Error: ${err.message}`);
                          } finally {
                            setIsSendingEmail(false);
                          }
                        }} className="space-y-4 mt-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Recipient Email</label>
                            <input
                              type="email"
                              required
                              placeholder="colleague@company.com"
                              value={emailRecipient}
                              onChange={(e) => setEmailRecipient(e.target.value)}
                              className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          <div>
                            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Select Attachments</span>
                            <div className="space-y-2 text-xs">
                              {/* PDF - Checked by default */}
                              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <input 
                                  type="checkbox" 
                                  checked={includePdf} 
                                  onChange={(e) => setIncludePdf(e.target.checked)}
                                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">Executive PDF Report</span>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Default clean presentation for executives and stakeholders.</p>
                                </div>
                              </label>

                              {/* CSV - Unchecked by default */}
                              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <input 
                                  type="checkbox" 
                                  checked={includeCsv} 
                                  onChange={(e) => setIncludeCsv(e.target.checked)}
                                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">Cleaned Dataset (CSV)</span>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Raw tabular dataset with imputed and validated values.</p>
                                </div>
                              </label>

                              {/* Interactive HTML - Unchecked by default */}
                              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <input 
                                  type="checkbox" 
                                  checked={includeHtml} 
                                  onChange={(e) => setIncludeHtml(e.target.checked)}
                                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">Interactive HTML Report</span>
                                  <p className="text-[11px] text-amber-600 dark:text-amber-400">File to open in browser, not a typical document. Email clients may show this as code.</p>
                                </div>
                              </label>

                              {/* Profiling Report - Unchecked by default */}
                              <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <input 
                                  type="checkbox" 
                                  checked={includeProfiling} 
                                  onChange={(e) => setIncludeProfiling(e.target.checked)}
                                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">Full Data Profiling Report</span>
                                  <p className="text-[11px] text-amber-600 dark:text-amber-400">Technical profiling file to open in a browser.</p>
                                </div>
                              </label>
                            </div>
                          </div>

                          {emailNotification && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs">
                              {emailNotification}
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
                            <button
                              type="button"
                              onClick={() => setShowEmailModal(false)}
                              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSendingEmail || (!includePdf && !includeCsv && !includeHtml && !includeProfiling)}
                              className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white flex items-center gap-1.5 shadow-sm"
                            >
                              {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              Send Email
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </motion.div>
                  )}

                  {jobStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white/60 dark:bg-black/40 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-red-500/20 text-center flex-shrink-0 transition-colors"
                    >
                      <div className="mx-auto w-16 h-16 bg-red-500/20 text-red-500 flex items-center justify-center rounded-full mb-4">
                        <AlertCircle className="w-8 h-8" />
                      </div>
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pipeline Failed</h2>
                      <p className="text-slate-600 dark:text-slate-400 mt-2 max-w-lg mx-auto">
                        'An error occurred during processing.'
                      </p>
                      <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                          <button 
                            onClick={resetSession}
                            className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-500 transition-all hover:scale-105"
                          >
                            Try Again
                          </button>
                          {dashboardSpec && (
                            <button 
                              onClick={() => setJobStatus('complete')}
                              className="px-6 py-3 bg-slate-600 dark:bg-slate-700 text-white font-bold rounded-xl shadow-lg hover:bg-slate-500 transition-all hover:scale-105"
                            >
                              Preview Dashboard Anyway
                            </button>
                          )}
                        </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {jobId && <LogViewer logs={logs} />}

      <footer className="h-10 bg-white/40 dark:bg-black/40 backdrop-blur-xl border-t border-white/20 dark:border-white/10 flex items-center justify-between px-6 flex-shrink-0 transition-colors z-20">
        <div className="flex items-center gap-2">
          {jobStatus === 'complete' && startTime && endTime && (
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Processing Time: {((endTime - startTime) / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}

