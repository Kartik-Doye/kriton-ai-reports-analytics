import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace Header DataInsight
content = re.sub(r'<h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">DataInsight <span className="font-normal text-slate-500 dark:text-slate-400">v1.2</span></h1>', 
                 '<div className="flex items-center gap-3"><FireSymbol /><h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white mt-1">Kriton <span className="font-normal text-slate-500 dark:text-slate-400">v1.2</span></h1></div>', content)

# Replace loader
old_loader = r"""<div className="w-full max-w-md flex items-end gap-3 justify-center h-40 mb-8 opacity-40">
                        <motion\.div animate=\{\{ height: \['40%', '60%', '40%'\] \}\} transition=\{\{ duration: 2, repeat: Infinity, ease: 'easeInOut' \}\} className="w-8 bg-blue-500 rounded-t-xl" />
                        <motion\.div animate=\{\{ height: \['60%', '90%', '60%'\] \}\} transition=\{\{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0\.2 \}\} className="w-8 bg-purple-500 rounded-t-xl" />
                        <motion\.div animate=\{\{ height: \['90%', '40%', '90%'\] \}\} transition=\{\{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0\.4 \}\} className="w-8 bg-blue-400 rounded-t-xl" />
                        <motion\.div animate=\{\{ height: \['50%', '80%', '50%'\] \}\} transition=\{\{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0\.6 \}\} className="w-8 bg-emerald-500 rounded-t-xl" />
                        <motion\.div animate=\{\{ height: \['70%', '50%', '70%'\] \}\} transition=\{\{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0\.8 \}\} className="w-8 bg-blue-600 rounded-t-xl" />
                      </div>"""

content = re.sub(old_loader, '<div className="flex justify-center h-40 items-center mb-8"><Loader /></div>', content, flags=re.DOTALL)

# Add imports for FireSymbol and Loader
import_str = "import { LogViewer } from './components/LogViewer';\nimport Loader from './components/Loader';\nimport FireSymbol from './components/FireSymbol';"
content = content.replace("import { LogViewer } from './components/LogViewer';", import_str)

with open('src/App.tsx', 'w') as f:
    f.write(content)
