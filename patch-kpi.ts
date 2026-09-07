import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const kpiLogicRegex = /  const processKpiWithDelta = \(kpi: any\) => \{[\s\S]*?    \};\n  \};\n/g;
const newKpiLogic = `  const processKpiWithDelta = (kpi: any) => {
    const currentValue = computeKpiValue(kpi, dataToUse);
    
    const sparkline = [];
    if (dataToUse.length >= 10) {
      const bucketSize = Math.max(1, Math.floor(dataToUse.length / 10));
      for (let i = 0; i < 10; i++) {
        const bucket = dataToUse.slice(i * bucketSize, (i + 1) * bucketSize);
        if (bucket.length > 0) {
          sparkline.push({ value: computeKpiValue(kpi, bucket) });
        }
      }
    }
    
    let delta = 0;
    if (sparkline.length >= 2) {
      const mid = Math.floor(sparkline.length / 2);
      const firstHalfValue = sparkline.slice(0, mid).reduce((a, b) => a + b.value, 0) / mid;
      const secondHalfValue = sparkline.slice(mid).reduce((a, b) => a + b.value, 0) / (sparkline.length - mid);
      if (firstHalfValue !== 0) {
        delta = Math.round((((secondHalfValue - firstHalfValue) / Math.abs(firstHalfValue)) * 100) * 100) / 100;
      }
    }

    return {
      formatted: formatKpi(currentValue),
      delta: isNaN(delta) ? 0 : delta,
      sparkline
    };
  };
`;
code = code.replace(kpiLogicRegex, newKpiLogic);

const kpiRenderRegex = /const \{ formatted, delta \} = processKpiWithDelta\(kpi\);\s*return \([\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}\)/g;
const newKpiRender = `const { formatted, delta, sparkline } = processKpiWithDelta(kpi);
              return (
                <div key={idx} className={\`p-4 rounded-xl border flex flex-col justify-between \${theme === 'dark' ? 'bg-slate-800/80 border-slate-700' : 'bg-blue-50/30 border-slate-100'}\`}>
                  <p className={\`text-xs font-medium mb-1 truncate \${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}\`} title={kpi.label}>{kpi.label}</p>
                  <div className="flex items-end justify-between gap-2 mt-1">
                    <p className={\`text-2xl font-bold truncate \${theme === 'dark' ? 'text-white' : 'text-slate-900'}\`} title={String(formatted)}>{formatted}</p>
                    <div className="flex flex-col items-end">
                      {delta !== 0 && (
                        <span className={\`text-[10px] font-bold flex items-center mb-0.5 \${delta > 0 ? 'text-green-500' : 'text-red-500'}\`}>
                          {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}%
                        </span>
                      )}
                      {sparkline && sparkline.length > 0 && (
                         <div className="h-6 w-16 opacity-80">
                           <ResponsiveContainer width="100%" height="100%">
                             <LineChart data={sparkline}>
                               <Line type="monotone" dataKey="value" stroke={delta >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2} dot={false} isAnimationActive={false} />
                             </LineChart>
                           </ResponsiveContainer>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })`;
code = code.replace(kpiRenderRegex, newKpiRender);

fs.writeFileSync('src/components/DashboardView.tsx', code);
