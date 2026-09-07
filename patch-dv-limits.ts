import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

// Add showAllCharts state
if (!code.includes('showAllCharts')) {
  code = code.replace(
    "const [viewMode, setViewMode] = useState<'detailed' | 'summary'>(() => {",
    "const [showAllCharts, setShowAllCharts] = useState(false);\n  const [viewMode, setViewMode] = useState<'detailed' | 'summary'>(() => {"
  );
}

// Fix mapping to use validatedPageData and add Show More button
const pagesRenderRegex = /\{\(autoExport \? \[pages\[0\]\] : \[activePageData\]\)\.map\(page => \(/g;
const newPagesRender = `{(autoExport ? [{ ...pages[0], charts: (pages[0]?.charts || []).filter(validateChart) }] : [validatedPageData]).map(page => {
            const maxCharts = showAllCharts ? undefined : 12;
            const renderedCharts = page.charts.slice(0, autoExport ? 2 : maxCharts);
            const hasMoreCharts = !autoExport && page.charts.length > 12;
            
            return (`;
code = code.replace(pagesRenderRegex, newPagesRender);

const chartsMapRegex = /\{page\.charts\.slice\(0, autoExport \? 2 : undefined\)\.map\(\(chart, idx\) => \{/g;
const newChartsMap = `{renderedCharts.map((chart, idx) => {`;
code = code.replace(chartsMapRegex, newChartsMap);

// Add the closing for the new map block and the Show More button
const endChartsRegex = /                <\/motion\.div>\n              \);\n            \}\)\}\n          <\/div>/g;
const newEndCharts = `                </motion.div>
              );
            })}
          </div>
          {hasMoreCharts && !showAllCharts && (
            <div className="col-span-full flex justify-center mt-2 mb-8">
               <button 
                 onClick={() => setShowAllCharts(true)} 
                 className={\`px-6 py-2 rounded-full text-sm font-medium transition-colors \${theme === 'dark' ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}\`}
               >
                 Show More Charts
               </button>
            </div>
          )}`;
code = code.replace(endChartsRegex, newEndCharts);

// Replace the closing parentheses of the old .map(page => (...))
const closingRegex = /          \}\)\}\n          \{\(viewMode === 'detailed' \|\| autoExport\)/g;
const newClosing = `          })}\n          {(viewMode === 'detailed' || autoExport)`;
code = code.replace(closingRegex, newClosing);

fs.writeFileSync('src/components/DashboardView.tsx', code);
