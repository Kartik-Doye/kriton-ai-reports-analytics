import fs from 'fs';
const code = fs.readFileSync('src/components/UploadForm.tsx', 'utf8');

const historyState = `
  const [history, setHistory] = useState<any[]>([]);
  const fetchHistory = useCallback(async (userEmail: string, authToken: string) => {
    try {
      const res = await fetch(\`/api/jobs?email=\${encodeURIComponent(userEmail)}\`, {
        headers: { 'Authorization': \`Bearer \${authToken}\` }
      });
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch(e) {}
  }, []);
`;

const historyJSX = `
      {history.length > 0 && (
        <div className="mt-8 text-left w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-2">Recent Reports</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {history.map(job => (
              <button 
                key={job.id} 
                type="button"
                onClick={() => onRestore?.(job.id, job.jobToken || '', job.status)} 
                className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition flex items-center justify-between group"
              >
                 <div>
                   <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{job.fileName}</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{new Date(job.timestamp).toLocaleString()} • {job.status}</p>
                 </div>
                 <CheckCircle2 className="w-5 h-5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}
`;

let patched = code.replace(
  'interface Props {\n  onSuccess: (jobId: string, jobToken: string) => void;\n}',
  'interface Props {\n  onSuccess: (jobId: string, jobToken: string) => void;\n  onRestore?: (jobId: string, jobToken: string, status: string) => void;\n}'
).replace(
  'export function UploadForm({ onSuccess }: Props) {',
  'export function UploadForm({ onSuccess, onRestore }: Props) {'
).replace(
  'const [needsAuth, setNeedsAuth] = useState(true);',
  'const [needsAuth, setNeedsAuth] = useState(true);\n' + historyState
).replace(
  '          <a href="/sample_data.csv" download className="text-xs text-blue-600 hover:underline dark:text-blue-400">\n            Don\'t have a file? Download a sample CSV\n          </a>\n        </div>',
  '          <a href="/sample_data.csv" download className="text-xs text-blue-600 hover:underline dark:text-blue-400">\n            Don\'t have a file? Download a sample CSV\n          </a>\n        </div>\n' + historyJSX
);

// We need to call fetchHistory when auth succeeds
patched = patched.replace(
  '          setNeedsAuth(false);\n        }\n      });',
  '          setNeedsAuth(false);\n          fetchHistory(user.email || "", token);\n        }\n      });'
).replace(
  '        setNeedsAuth(false);\n      }',
  '        setNeedsAuth(false);\n        fetchHistory(result.user.email || "", result.accessToken);\n      }'
);

fs.writeFileSync('src/components/UploadForm.tsx', patched);
