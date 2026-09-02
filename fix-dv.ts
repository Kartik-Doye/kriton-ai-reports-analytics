import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const dqHtml = `
      {/* Global Metadata / Data Quality & Cleaning Card */}
      {(dataQuality || cleaningLog) && (
        <div className={\`mb-6 rounded-xl border overflow-hidden \${theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}\`}>
          {dataQuality && (
            <div className="p-4 flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className={\`p-2 rounded-lg \${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}\`}>
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className={\`text-xs font-medium uppercase tracking-wider \${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}\`}>Total Records</p>
                  <p className={\`text-xl font-bold \${theme === 'dark' ? 'text-white' : 'text-slate-900'}\`}>{dataQuality.totalRecords.toLocaleString()}</p>
                </div>
              </div>
              
              {dataQuality.rowsExcluded > 0 && (
                <div className="flex items-center gap-3 border-l pl-6 border-slate-300 dark:border-slate-700">
                  <div className={\`p-2 rounded-lg \${theme === 'dark' ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-600'}\`}>
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={\`text-xs font-medium uppercase tracking-wider \${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}\`}>Excluded (Missing/Error)</p>
                    <p className={\`text-xl font-bold \${theme === 'dark' ? 'text-white' : 'text-slate-900'}\`}>{dataQuality.rowsExcluded.toLocaleString()} rows</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {cleaningLog && (
             <div className={\`p-4 border-t text-sm \${theme === 'dark' ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}\`}>
               <h4 className="font-semibold mb-2 flex items-center gap-2">
                 <Zap className="w-4 h-4 text-emerald-500" />
                 Data Cleaning Actions Applied
               </h4>
               <ul className="list-disc pl-5 space-y-1">
                 {cleaningLog.split('\\n').filter(Boolean).map((log, i) => (
                   <li key={i}>{log}</li>
                 ))}
               </ul>
             </div>
          )}
        </div>
      )}

      {/* Anomalies Section */}
      {(spec as any).anomalies && (spec as any).anomalies.length > 0 && (
        <div className={\`mb-6 p-4 rounded-xl border \${theme === 'dark' ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'}\`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={\`w-5 h-5 \${theme === 'dark' ? 'text-red-400' : 'text-red-500'}\`} />
            <h4 className={\`font-semibold \${theme === 'dark' ? 'text-red-400' : 'text-red-700'}\`}>Statistical Anomalies & Outliers</h4>
          </div>
          <ul className="space-y-2">
            {(spec as any).anomalies.map((anom: any, idx: number) => (
              <li key={idx} className={\`text-sm flex gap-2 items-start \${theme === 'dark' ? 'text-red-200' : 'text-red-900'}\`}>
                <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>{typeof anom === 'string' ? anom : anom.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
`;

if (!code.includes('Total Records')) {
  code = code.replace(
    '<div className="flex flex-wrap gap-2 mb-6">',
    dqHtml + '\n      <div className="flex flex-wrap gap-2 mb-6">'
  );
}

// Add the missing imports if needed
if (!code.includes('Database')) {
  code = code.replace(
    'from \'lucide-react\';',
    ', Database, ShieldAlert, Zap } from \'lucide-react\';'
  );
}

fs.writeFileSync('src/components/DashboardView.tsx', code);
