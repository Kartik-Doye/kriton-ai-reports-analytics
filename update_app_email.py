import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add import
import_stmt = "import { EmailModal } from './components/EmailModal';\n"
content = content.replace("import Loader from './components/Loader';", import_stmt + "import Loader from './components/Loader';")

# Add modal state
modal_state = """  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
"""
content = content.replace("  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');", "  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');\n" + modal_state)

# Update resetSession
content = content.replace("setEmailStatus('idle');\n  }, []);", "setEmailStatus('idle');\n    setIsEmailModalOpen(false);\n  }, []);")

# Update handleEmailReport function
new_handle_email = """  const handleEmailReport = async (options: { to: string, cc: string, bcc: string, subject: string, body: string }) => {
    if (!jobId) return;
    setIsEmailing(true);
    setEmailStatus('idle');
    try {
      const response = await fetch(`/api/job/${jobId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      if (response.ok) {
        setEmailStatus('success');
        setTimeout(() => setIsEmailModalOpen(false), 2000);
      } else {
        setEmailStatus('error');
      }
    } catch (err) {
      setEmailStatus('error');
    } finally {
      setIsEmailing(false);
      setTimeout(() => setEmailStatus('idle'), 3000);
    }
  };"""

content = re.sub(r"const handleEmailReport = async \(\) => \{[\s\S]*?\};", new_handle_email, content)

# Update button to open modal
old_button = """<button 
                          onClick={handleEmailReport}
                          disabled={isEmailing}
                          className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none disabled:opacity-50 transition-all hover:scale-105"
                        >
                          {isEmailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                          {emailStatus === 'success' ? 'Email Sent!' : emailStatus === 'error' ? 'Failed to Send' : 'Email Report'}
                        </button>"""

new_button = """<button 
                          onClick={() => { setIsEmailModalOpen(true); setEmailStatus('idle'); }}
                          className="group relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200/50 dark:border-white/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 focus:outline-none transition-all hover:scale-105"
                        >
                          <Mail className="w-4 h-4" />
                          Email Report
                        </button>"""

content = content.replace(old_button, new_button)

# Add Modal component
modal_comp = """<EmailModal 
        isOpen={isEmailModalOpen} 
        onClose={() => setIsEmailModalOpen(false)} 
        onSend={handleEmailReport} 
        status={isEmailing ? 'sending' : emailStatus} 
      />"""

content = content.replace("{jobId && <LogViewer logs={logs} />}", "{jobId && <LogViewer logs={logs} />}\n      " + modal_comp)

with open('src/App.tsx', 'w') as f:
    f.write(content)
