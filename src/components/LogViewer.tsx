import React, { useState, useRef, useEffect } from 'react';
import { Terminal, X, Minimize2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  logs: string[];
}

export function LogViewer({ logs }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen, isExpanded]);

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 bg-slate-900 text-white rounded-full p-4 shadow-xl hover:bg-slate-800 transition-colors z-40 flex items-center gap-2"
          >
            <Terminal className="w-5 h-5" />
            <span className="font-semibold text-sm">View Logs</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className={`fixed right-6 bottom-6 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50 flex flex-col font-mono text-sm transition-all duration-300 ${
              isExpanded ? 'w-[800px] h-[600px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)]' : 'w-[400px] h-[300px]'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Terminal className="w-4 h-4" />
                <span className="font-semibold">Processing Logs</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div 
              ref={scrollRef}
              className="flex-1 p-4 overflow-y-auto text-slate-300 space-y-1 scroll-smooth"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 italic">Waiting for logs...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-slate-600 shrink-0">
                      [{new Date().toLocaleTimeString([], { hour12: false })}]
                    </span>
                    <span className="break-words">{log}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
