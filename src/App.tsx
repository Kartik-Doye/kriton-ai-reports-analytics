/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { UploadForm } from './components/UploadForm';
import { ProgressStepper } from './components/ProgressStepper';
import { DashboardView } from './components/DashboardView';
import { LogViewer } from './components/LogViewer';
import { EmailModal } from './components/EmailModal';
import Loader from './components/Loader';
import FireSymbol from './components/FireSymbol';
import { ThemeToggle } from './components/ThemeToggle';
import { AmbientBackground } from './components/AmbientBackground';
import { PipelineJob, DashboardSpec } from './types';
import { CheckCircle2, Circle, Loader2, Mail, FileText, FileJson, Calendar as CalendarIcon } from 'lucide-react';
import { getAccessToken } from './auth';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobToken, setJobToken] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<PipelineJob['status']>('pending');
  const [logs, setLogs] = useState<string[]>([]);
  const [dashboardSpec, setDashboardSpec] = useState<DashboardSpec | null>(null);
  const [cleanedData, setCleanedData] = useState<any[] | null>(null);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [isExportingDocs, setIsExportingDocs] = useState(false);
  const [docsUrl, setDocsUrl] = useState('');
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');




  const resetSession = useCallback(() => {
    setJobId(null);
    setJobStatus('pending');
    setLogs([]);
    setDashboardSpec(null);
    setCleanedData(null);
    setEmailStatus('idle');
    setIsEmailModalOpen(false);
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
  };

  
  const handleDeleteData = async () => {
    if (!confirm('Are you sure you want to delete all your data from the server? This cannot be undone.')) return;
    try {
      await fetch(`/api/job/${jobId}?token=${jobToken}`, { method: 'DELETE' });
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

  const handleJobComplete = () => {
    setJobStatus('complete');
  };


  
  const handleExportDocs = async () => {
    if (!jobId) return;
    const confirmed = window.confirm('Export Executive Summary to a new Google Doc in your Drive?');
    if (!confirmed) return;
    
    setIsExportingDocs(true);
    setDocsUrl('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/job/${jobId}/export-docs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-job-token': jobToken!
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocsUrl(data.url);
    } catch (err: any) {
      alert('Failed to export to Google Docs: ' + err.message);
    } finally {
      setIsExportingDocs(false);
    }
  };

  const handleScheduleMeeting = async () => {
    if (!jobId) return;
    const confirmed = window.confirm('Schedule a follow-up meeting for tomorrow at 10 AM on your Google Calendar?');
    if (!confirmed) return;
    
    setIsScheduling(true);
    setCalendarUrl('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      const res = await fetch(`/api/job/${jobId}/schedule-meeting`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-job-token': jobToken!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ attendees: [] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCalendarUrl(data.url);
    } catch (err: any) {
      alert('Failed to schedule meeting: ' + err.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleEmailReport = async (options: { to: string, cc: string, bcc: string, subject: string, body: string, attachHtml?: boolean }) => {
    if (!jobId) return;
    setIsEmailing(true);
    setEmailStatus('idle');
    setEmailErrorMsg('');
    try {
      const response = await fetch(`/api/job/${jobId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-job-token': jobToken! },
        body: JSON.stringify(options)
      });
      if (response.ok) {
        setEmailStatus('success');
        setJobStatus('complete');
        setTimeout(() => setIsEmailModalOpen(false), 2000);
      } else {
        const data = await response.json().catch(() => ({}));
        setEmailErrorMsg(data.error || 'Delivery connection failed');
        setEmailStatus('error');
        setJobStatus('delivery_error');
        setIsEmailModalOpen(false);
      }
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Delivery connection failed');
      setEmailStatus('error');
      setJobStatus('delivery_error');
      setIsEmailModalOpen(false);
    } finally {
      setIsEmailing(false);
      setTimeout(() => setEmailStatus('idle'), 3000);
    }
  };

  useEffect(() => {
    if (!jobId || jobStatus === 'complete' || jobStatus === 'error') return;
    
    const eventSource = new EventSource(`/api/job/${jobId}/stream?token=${jobToken}`);
    
    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      setJobStatus(data.status);
      if (data.status === 'complete') {
        handleJobComplete();
        eventSource.close();
      }
    });

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setLogs((prev) => [...prev, data.text]);
    });

    eventSource.addEventListener('spec', (e) => {
      const data = JSON.parse(e.data);
      setDashboardSpec(data.spec);
      setCleanedData(data.data);
    });

    eventSource.addEventListener('error', (e) => {
      setJobStatus('error');
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [jobId]);

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
                <UploadForm onSuccess={handleUploadSuccess} />
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
                      className={`h-full overflow-y-auto ${jobStatus === 'emailing' ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      <DashboardView 
                        jobId={jobId!}
                        jobToken={jobToken!}
                        spec={dashboardSpec} 
                        data={cleanedData} 
                        autoExport={jobStatus === 'waiting_for_dashboard'}
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
                      className="bg-white/60 dark:bg-black/40 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/40 dark:border-white/10 text-center flex-shrink-0 transition-colors"
                    >
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="mx-auto w-16 h-16 bg-emerald-500/20 text-emerald-500 flex items-center justify-center rounded-full mb-4">
                        <CheckCircle2 className="w-8 h-8" />
                      </motion.div>
                      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Pipeline Complete!</h2>
                      <p className="text-slate-600 dark:text-slate-300 mt-2 max-w-lg mx-auto">Your automated analytics package is ready. Securely download the artifacts below.</p>
                      
                      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 flex-wrap">
                        <a href={`/api/job/${jobId}/download/csv?token=${jobToken}`} download className="group relative overflow-hidden inline-flex items-center justify-center px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105">
                          Download CSV
                        </a>
                        
                        <a href={`/api/job/${jobId}/download/pdf?token=${jobToken}`} download className="group relative overflow-hidden inline-flex items-center justify-center px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105">
                          Download PDF
                        </a>
                        <a href={`/api/job/${jobId}/download/html?token=${jobToken}`} download className="group relative overflow-hidden inline-flex items-center justify-center px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105">
                          Download HTML
                        </a>
                        <a href={`/api/job/${jobId}/download/zip?token=${jobToken}`} download className="group relative overflow-hidden inline-flex items-center justify-center px-6 py-3 border border-transparent text-sm font-bold rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white bg-blue-600 hover:bg-blue-500 focus:outline-none w-full sm:w-auto transition-all hover:scale-105">
                          Download All (ZIP)
                        </a>
                        
                        <button 
                          onClick={handleDeleteData}
                          className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 border border-red-200/50 dark:border-red-500/20 text-sm font-semibold rounded-xl shadow-sm text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 focus:outline-none transition-all hover:scale-105"
                        >
                          Delete My Data
                        </button>

                        <button 
                          onClick={() => { setIsEmailModalOpen(true); setEmailStatus('idle'); }}
                          className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105"
                        >
                          <Mail className="w-4 h-4" />
                          Email Report
                        </button>

                        <button 
                          onClick={handleExportDocs}
                          disabled={isExportingDocs}
                          className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105 disabled:opacity-50"
                        >
                          {isExportingDocs ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
                          Export to Docs
                        </button>
                        {docsUrl && (
                          <a href={docsUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm font-medium self-center flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> Open Doc
                          </a>
                        )}
                        
                        <button 
                          onClick={handleScheduleMeeting}
                          disabled={isScheduling}
                          className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105 disabled:opacity-50"
                        >
                          {isScheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />}
                          Schedule Review
                        </button>
                        {calendarUrl && (
                          <a href={calendarUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm font-medium self-center flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> View Event
                          </a>
                        )}

                      </div>
                    </motion.div>
                  )}
                  {(jobStatus === 'error' || jobStatus === 'delivery_error') && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-500/10 backdrop-blur-md border border-red-500/20 rounded-3xl p-8 text-center flex-shrink-0 shadow-2xl">
                      <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
                        {jobStatus === 'delivery_error' ? 'Delivery Failed' : 'Pipeline Failed'}
                      </h2>
                      <p className="text-red-600/80 dark:text-red-400/80 mt-2">
                        {jobStatus === 'delivery_error' ? emailErrorMsg : 'An error occurred during processing.'}
                      </p>
                      {jobStatus === 'delivery_error' ? (
                        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                          <button 
                            onClick={() => {
                              setIsEmailModalOpen(true);
                              setEmailStatus('idle');
                              setJobStatus('complete'); // Go back to complete so they can see dashboard and try again
                            }}
                            className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-500 transition-all hover:scale-105"
                          >
                            Retry Delivery
                          </button>
                          <button 
                            onClick={() => setJobStatus('complete')}
                            className="px-6 py-3 bg-slate-600 dark:bg-slate-700 text-white font-bold rounded-xl shadow-lg hover:bg-slate-500 dark:hover:bg-slate-600 transition-all hover:scale-105"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={resetSession}
                          className="mt-6 px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-500 transition-all hover:scale-105"
                        >
                          Try Again
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {jobId && <LogViewer logs={logs} />}
      <EmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} onSend={handleEmailReport} status={isEmailing ? 'sending' : emailStatus} jobId={jobId} jobToken={jobToken} />

      <footer className="h-10 bg-white/40 dark:bg-black/40 backdrop-blur-xl border-t border-white/20 dark:border-white/10 flex items-center justify-between px-6 flex-shrink-0 transition-colors z-20">
      </footer>
    </div>
  );
}

