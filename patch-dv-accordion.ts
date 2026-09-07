import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const chartsStartRegex = /          \{\(viewMode === 'detailed' \|\| autoExport\) && \(\n            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">/g;
const newChartsStart = `          {(viewMode === 'detailed' || autoExport) && (
            <>
              {!autoExport && (
                <div 
                  className="flex items-center justify-between cursor-pointer group mb-4 mt-8 bg-blue-500/5 hover:bg-blue-500/10 p-3 rounded-xl transition-colors border border-blue-500/10" 
                  onClick={() => toggleSection(page.id + '_charts')}
                >
                  <div className="flex items-center gap-2">
                    <h4 className={\`text-sm uppercase tracking-wider font-bold \${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}\`}>Visualizations</h4>
                    <span className={\`text-xs px-2 py-0.5 rounded-full \${theme === 'dark' ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}\`}>
                      {page.charts.length} Charts
                    </span>
                  </div>
                  <button className={\`p-1 rounded-md transition-colors \${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}\`}>
                      {sectionsCollapsed[page.id + '_charts'] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              )}
              {(!sectionsCollapsed[page.id + '_charts'] || autoExport) && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">`;
code = code.replace(chartsStartRegex, newChartsStart);

const chartsEndRegex = /          \{hasMoreCharts && !showAllCharts && \([\s\S]*?<\/button>\n            <\/div>\n          \)\}/g;
const newChartsEnd = `          {hasMoreCharts && !showAllCharts && (
            <div className="col-span-full flex justify-center mt-2 mb-8">
               <button 
                 onClick={() => setShowAllCharts(true)} 
                 className={\`px-6 py-2 rounded-full text-sm font-medium transition-colors \${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}\`}
               >
                 Show {page.charts.length - 12} More Charts
               </button>
            </div>
          )}
          </>
          )}`;
code = code.replace(chartsEndRegex, newChartsEnd);

const insightsStartRegex = /              <div className="flex items-center gap-2 mb-3">/g;
const newInsightsStart = `              <div className="flex items-center justify-between mb-3 cursor-pointer group" onClick={() => toggleSection(page.id + '_insights')}>
                <div className="flex items-center gap-2">`;
code = code.replace(insightsStartRegex, newInsightsStart);

const insightsMidRegex = /                <span className="text-\[10px\] font-bold text-blue-400 uppercase tracking-widest">All Insights<\/span>\n              <\/div>\n              \{\!sectionsCollapsed\['insights'\] && \(/g;
const newInsightsMid = `                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">All Insights</span>
                </div>
                {!autoExport && (
                  <button className={\`p-1 rounded-md transition-colors \${theme === 'dark' ? 'text-slate-400 group-hover:bg-slate-800' : 'text-slate-500 group-hover:bg-slate-200'}\`}>
                      {sectionsCollapsed[page.id + '_insights'] ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {(!sectionsCollapsed[page.id + '_insights'] || autoExport) && (`;
code = code.replace(insightsMidRegex, newInsightsMid);

// Check if ChevronDown and ChevronRight are imported
if (!code.includes('ChevronDown')) {
  code = code.replace('} from \'lucide-react\'', ', ChevronDown, ChevronRight } from \'lucide-react\'');
}

fs.writeFileSync('src/components/DashboardView.tsx', code);
