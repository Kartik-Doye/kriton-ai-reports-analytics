import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Mail, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSend: (options: { to: string, cc: string, bcc: string, subject: string, body: string }) => Promise<void>;
  status: 'idle' | 'sending' | 'success' | 'error';
  jobId?: string;
  jobToken?: string;
}

export function EmailModal({ isOpen, onClose, onSend, status, jobId, jobToken }: Props) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('<p>Hello,</p><p>Your automated analytics package is ready. Please find attached your Executive Summary (PDF).</p>');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col h-[90vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Review & Send Report</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50 dark:bg-slate-900/50">
          {/* Left Side: PDF Preview */}
          <div className="flex-1 border-r border-slate-200 dark:border-slate-800 flex flex-col relative bg-slate-200/50 dark:bg-black/20">
            <div className="absolute top-0 inset-x-0 p-2 bg-gradient-to-b from-black/20 to-transparent z-10 pointer-events-none">
              <span className="bg-black/50 text-white text-xs px-2 py-1 rounded font-semibold backdrop-blur-sm shadow-sm flex items-center w-max gap-1">
                <FileText className="w-3 h-3" />
                Preview: report.pdf
              </span>
            </div>
            {jobId && jobToken ? (
              <iframe 
                src={`/api/job/${jobId}/download/pdf?token=${jobToken}#toolbar=0&view=FitH`} 
                className="w-full h-full border-none flex-1"
                title="PDF Preview"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400">Loading Preview...</div>
            )}
          </div>
          
          {/* Right Side: Email Form */}
          <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col overflow-y-auto">
            {status === 'success' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Report Sent!</h3>
                <p className="text-slate-600 dark:text-slate-400">Your analytics report has been successfully delivered to the recipient.</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">To</label>
                  <input 
                    type="text" 
                    value={to} 
                    onChange={(e) => setTo(e.target.value)} 
                    placeholder="recipient@example.com"
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">CC (Optional)</label>
                  <input 
                    type="text" 
                    value={cc} 
                    onChange={(e) => setCc(e.target.value)} 
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                  <input 
                    type="text" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Message (HTML format supported)</label>
                  <textarea 
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    rows={6}
                    className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white resize-none"
                  />
                </div>
                
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Attachments (Auto-generated)</p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                      <FileText className="w-4 h-4 text-red-500" /> report.pdf
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {status !== 'success' && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3 flex-shrink-0">
            <button 
              onClick={onClose}
              disabled={status === 'sending'}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSend({ to, cc, bcc, subject, body })}
              disabled={!to || status === 'sending'}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {status === 'sending' ? (
                <>Sending...</>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send to Client
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
