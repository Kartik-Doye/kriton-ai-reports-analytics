import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const collapseState = `  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setSectionsCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
`;

code = code.replace(
  'const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(allColumns.slice(0, 10)));',
  'const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(allColumns.slice(0, 10)));\n' + collapseState
).replace(
  '<h4 className={`text-lg font-bold mb-4 ${theme === \'dark\' ? \'text-white\' : \'text-slate-900\'}`}>Key Insights</h4>',
  `<div 
                className="flex items-center justify-between cursor-pointer group mb-4" 
                onClick={() => toggleSection('insights')}
              >
                <h4 className={\`text-lg font-bold \${theme === 'dark' ? 'text-white' : 'text-slate-900'}\`}>Key Insights</h4>
                <button className={\`p-1 rounded-md transition-colors \${theme === 'dark' ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-200/50 text-slate-500'}\`}>
                  {sectionsCollapsed['insights'] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
              </div>`
).replace(
  '<ul className="space-y-3">',
  '{!sectionsCollapsed[\'insights\'] && (\n              <ul className="space-y-3">'
).replace(
  '              </ul>\n            </div>',
  '              </ul>\n            )}\n            </div>'
).replace(
  '<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">',
  `<div className="flex items-center justify-between cursor-pointer group mb-4 mt-8" onClick={() => toggleSection('charts')}>
              <h4 className={\`text-lg font-bold \${theme === 'dark' ? 'text-white' : 'text-slate-900'}\`}>Visualizations</h4>
              <button className={\`p-1 rounded-md transition-colors \${theme === 'dark' ? 'hover:bg-slate-700/50 text-slate-400' : 'hover:bg-slate-200/50 text-slate-500'}\`}>
                  {sectionsCollapsed['charts'] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            {!sectionsCollapsed['charts'] && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">`
).replace(
  '                </motion.div>\n              );\n            })}\n          </div>',
  '                </motion.div>\n              );\n            })}\n          </div>\n          )}'
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
