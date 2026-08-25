import React from 'react';
import { PipelineJob } from '../types';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  status: PipelineJob['status'];
}

const steps = [
  { id: 'cleaning', label: '2. Clean' },
  { id: 'planning', label: '3. Plan Dashboard' },
  { id: 'waiting_for_dashboard', label: '4. Analyze & Build' },
  { id: 'emailing', label: '5. Deliver' }
];

export function ProgressStepper({ status }: Props) {
  const currentStepIndex = steps.findIndex(s => s.id === status);
  
  return (
    <div className="space-y-8 flex flex-col h-full relative">
      <div className="absolute left-3 top-6 bottom-6 w-0.5 bg-slate-200/50 dark:bg-white/10 -z-10 rounded-full transition-colors" />
      <motion.div 
        className="absolute left-3 top-6 w-0.5 bg-gradient-to-b from-blue-500 to-emerald-500 -z-10 rounded-full origin-top shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        initial={{ height: 0 }}
        animate={{ 
          height: status === 'complete' ? '100%' : `${((currentStepIndex + 1) / (steps.length + 1)) * 100}%` 
        }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
      <div className="flex items-start gap-4">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-1 w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 transition-colors shadow-[0_0_10px_rgba(16,185,129,0.4)]"
        >
          <CheckCircle2 className="w-4 h-4" />
        </motion.div>
        <div>
          <p className="font-bold text-slate-900 dark:text-white transition-colors">1. Upload</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">File attached</p>
        </div>
      </div>
      
      {steps.map((step, stepIdx) => {
        const isComplete = currentStepIndex > stepIdx || status === 'complete';
        const isCurrent = currentStepIndex === stepIdx && status !== 'complete' && status !== 'error';
        const isFuture = !isComplete && !isCurrent && status !== 'error';
        const isError = status === 'error' && currentStepIndex === stepIdx;
        return (
          <div key={step.id} className={`flex items-start gap-4 transition-opacity duration-500 ${isFuture ? 'opacity-40' : ''}`}>
            <motion.div 
              layout
              className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-500 ${
                isComplete ? 'bg-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 
                isCurrent ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 
                isError ? 'bg-red-500/20 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]' :
                'bg-slate-200/50 dark:bg-white/10 text-slate-500 dark:text-slate-400'
              }`}
            >
              {isComplete ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><CheckCircle2 className="w-4 h-4" /></motion.div>
              ) : isCurrent ? (
                <motion.span 
                  animate={{ scale: [1, 1.2, 1] }} 
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-xs font-bold"
                >
                  {stepIdx + 2}
                </motion.span>
              ) : (
                <span className="text-xs font-bold">{stepIdx + 2}</span>
              )}
            </motion.div>
            <div className="flex-1">
              <p className={`font-semibold transition-colors duration-500 ${isCurrent ? 'text-blue-600 dark:text-blue-400' : isError ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{step.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
                {isComplete ? 'Done' : isCurrent ? (step.id === 'waiting_for_dashboard' ? 'Processing (this may take a minute)...' : 'Processing...') : isError ? 'Failed' : 'Waiting...'}
              </p>
              {isCurrent && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  className="mt-2 w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden transition-colors"
                >
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '0%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="bg-blue-600 h-full rounded-full w-2/3" 
                  />
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
