import fs from 'fs';
let code = fs.readFileSync('src/components/UploadForm.tsx', 'utf8');

code = code.replace(
  'const [needsAuth, setNeedsAuth] = useState(true);',
  'const [needsAuth, setNeedsAuth] = useState(true);\n  const [analysisMode, setAnalysisMode] = useState<"brief"|"detailed">("detailed");'
).replace(
  'formData.append(\'accessToken\', token);',
  'formData.append(\'accessToken\', token);\n    formData.append(\'analysisMode\', analysisMode);'
).replace(
  '{/* File input */}',
  `{/* Analysis Mode Toggle */}
        <div className="mb-6 flex bg-slate-100 dark:bg-white/5 p-1 rounded-full w-full max-w-sm mx-auto">
          <button 
            type="button" 
            onClick={() => setAnalysisMode('detailed')}
            className={\`flex-1 text-sm font-medium py-2 rounded-full transition-all \${analysisMode === 'detailed' ? 'bg-white dark:bg-black/40 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}\`}
          >
            Detailed Dive
          </button>
          <button 
            type="button" 
            onClick={() => setAnalysisMode('brief')}
            className={\`flex-1 text-sm font-medium py-2 rounded-full transition-all \${analysisMode === 'brief' ? 'bg-white dark:bg-black/40 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}\`}
          >
            Executive Brief
          </button>
        </div>

        {/* File input */}`
);

fs.writeFileSync('src/components/UploadForm.tsx', code);
