import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Mail, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSend: (options: { to: string, cc: string, bcc: string, subject: string, body: string, attachHtml: boolean }) => Promise<void>;
  status: 'idle' | 'sending' | 'success' | 'error';
}

export function EmailModal({ isOpen, onClose, onSend, status }: Props) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('<p>Hello,</p><p>Your automated analytics package is ready. Please find attached your Executive Summary (PDF) and Dashboard Export (PNG).</p>');
  const [attachHtml, setAttachHtml] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Send Email Report
          </h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {status === 'success' ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Email Sent Successfully</h3>
              <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-800 dark:text-white">Close</button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <button 
                  onClick={() => setPreviewMode(false)}
                  className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${!previewMode ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Edit Details
                </button>
                <button 
                  onClick={() => setPreviewMode(true)}
                  className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${previewMode ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Preview
                </button>
              </div>

              {!previewMode ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">To</label>
                    <input 
                      type="text" 
                      value={to} 
                      onChange={(e) => setTo(e.target.value)} 
                      placeholder="recipient@example.com"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">CC (Optional)</label>
                      <input 
                        type="text" 
                        value={cc} 
                        onChange={(e) => setCc(e.target.value)} 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">BCC (Optional)</label>
                      <input 
                        type="text" 
                        value={bcc} 
                        onChange={(e) => setBcc(e.target.value)} 
                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Subject</label>
                    <input 
                      type="text" 
                      value={subject} 
                      onChange={(e) => setSubject(e.target.value)} 
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Message (HTML format supported)</label>
                    <textarea 
                      value={body} 
                      onChange={(e) => setBody(e.target.value)} 
                      rows={6}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-white resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <input 
                      type="checkbox" 
                      id="attachHtml" 
                      checked={attachHtml} 
                      onChange={(e) => setAttachHtml(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="attachHtml" className="text-sm text-slate-700 dark:text-slate-300">
                      <strong>Include Interactive HTML Dashboard</strong> 
                      <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Warning: This embeds the entire dataset inside the attached HTML file. Ensure there is no sensitive data before sharing.</span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="text-sm"><span className="font-semibold text-slate-500 dark:text-slate-400 w-16 inline-block">To:</span> <span className="text-slate-800 dark:text-white">{to || '(No recipient)'}</span></div>
                    {cc && <div className="text-sm"><span className="font-semibold text-slate-500 dark:text-slate-400 w-16 inline-block">CC:</span> <span className="text-slate-800 dark:text-white">{cc}</span></div>}
                    {bcc && <div className="text-sm"><span className="font-semibold text-slate-500 dark:text-slate-400 w-16 inline-block">BCC:</span> <span className="text-slate-800 dark:text-white">{bcc}</span></div>}
                    <div className="text-sm mt-2"><span className="font-semibold text-slate-500 dark:text-slate-400 w-16 inline-block">Subject:</span> <span className="font-semibold text-slate-800 dark:text-white">{subject}</span></div>
                  </div>
                  <div className="prose dark:prose-invert max-w-none mb-6" dangerouslySetInnerHTML={{ __html: body }} />
                  
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-6">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Attachments (Auto-generated)</p>
                    <div className="flex flex-wrap gap-2">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                        <FileText className="w-4 h-4 text-purple-500" /> dashboard.png
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                        <FileText className="w-4 h-4 text-red-500" /> report.pdf
                      </div>
                      {attachHtml && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                          <FileText className="w-4 h-4 text-blue-500" /> interactive_report.html
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {status !== 'success' && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
            <button 
              onClick={onClose}
              disabled={status === 'sending'}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              onClick={() => onSend({ to, cc, bcc, subject, body, attachHtml })}
              disabled={!to || status === 'sending'}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {status === 'sending' ? (
                <>Sending...</>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
