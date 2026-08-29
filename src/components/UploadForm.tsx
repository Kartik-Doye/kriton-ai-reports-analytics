import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../auth';
import { User } from 'firebase/auth';

interface Props {
  onSuccess: (jobId: string, jobToken: string) => void;
}

export function UploadForm({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    initAuth(
      (u, t) => {
        setNeedsAuth(false);
        setUser(u);
        setToken(t);
        setEmail(u.email || '');
      },
      () => setNeedsAuth(true)
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setEmail(result.user.email || '');
        setNeedsAuth(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError('Login failed: ' + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setFile(null);
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      if (selectedFile.size > 15 * 1024 * 1024) {
        setError('File must be smaller than 15MB');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError('');
      
      const text = await selectedFile.text();
      const Papa = await import('papaparse');
      Papa.default.parse(text, {
        header: true,
        preview: 10,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setPreviewHeaders(Object.keys(results.data[0] as object));
            setPreviewData(results.data);
          }
        },
        error: (err: any) => {
          console.error("Preview parse error", err);
        }
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/json': ['.json']
    },
    maxFiles: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !email || !token) {
      setError('Please provide a file and ensure you are signed in.');
      return;
    }
    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('email', email);
    formData.append('accessToken', token);
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      onSuccess(data.jobId, data.jobToken);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (needsAuth) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl shadow-black/5 border border-white/40 dark:border-white/10 w-full text-center max-w-xl mx-auto mt-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white mb-4">Welcome to Kriton</h2>
        <p className="text-slate-600 dark:text-slate-300 mb-10 max-w-sm mx-auto">Please sign in with Google to use Gmail to send your pipeline reports.</p>
        
        {error && <p className="text-red-500 mb-4">{error}</p>}

        <button 
          type="button"
          onClick={handleLogin} 
          disabled={isLoggingIn}
          className="gsi-material-button mx-auto hover:scale-105 transition-transform"
        >
          <div className="gsi-material-button-state"></div>
          <div className="gsi-material-button-content-wrapper">
            <div className="gsi-material-button-icon">
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlnsXlink="http://www.w3.org/1999/xlink" style={{ display: 'block' }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            </div>
            <span className="gsi-material-button-contents">{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
            <span style={{ display: 'none' }}>Sign in with Google</span>
          </div>
        </button>
      </motion.div>
    );
  }

  return (
    <motion.form 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={handleSubmit} 
      className="relative overflow-hidden bg-white/50 dark:bg-slate-900/40 backdrop-blur-2xl shadow-2xl rounded-3xl p-8 max-w-xl mx-auto w-full border border-white/40 dark:border-white/10 transition-colors"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500 opacity-50" />
      
      <div className="space-y-8 relative z-10">
        <div className="text-center relative">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white mb-2"
          >
            Start a New Pipeline
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-sm text-slate-500 dark:text-slate-400">
            Upload your dataset and we'll generate the insights automatically.
          </motion.p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Signed in as <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span></span>
            <button type="button" onClick={handleLogout} className="text-blue-500 hover:underline">Sign out</button>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">
            Dataset (.csv, .xls, .xlsx, .json)
          </label>
          <div
            {...getRootProps()}
            className={`group relative overflow-hidden flex justify-center px-6 pt-8 pb-10 border-2 border-dashed rounded-3xl transition-all cursor-pointer ${
              isDragActive 
                ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
                : 'border-slate-300/50 dark:border-white/10 hover:border-blue-400/50 hover:bg-white/40 dark:hover:bg-white/5'
            }`}
          >
            <input {...getInputProps()} />
            
            <div className="space-y-3 text-center relative z-10">
              <motion.div animate={isDragActive ? { y: -10, scale: 1.1 } : { y: 0, scale: 1 }}>
                {file ? (
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                ) : (
                  <UploadCloud className={`mx-auto h-12 w-12 transition-colors ${isDragActive ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-400'}`} />
                )}
              </motion.div>
              <div className="flex flex-col text-sm text-slate-600 dark:text-slate-400 justify-center transition-colors">
                {file ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      Click to upload or drag and drop
                    </span>
                    <span className="mt-1 text-xs">Up to 15MB</span>
                  </>
                )}
              </div>
            </div>
            
            {/* Ambient hover glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-emerald-500/5 transition-all duration-500" />
          </div>
        </motion.div>

        
        <div className="text-center mt-2">
          <a href="/sample_data.csv" download className="text-xs text-blue-600 hover:underline dark:text-blue-400">
            Don't have a file? Download a sample CSV
          </a>
        </div>

        <AnimatePresence>
          {file && previewData.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setShowPreview(true)}
                className="w-full flex justify-center py-2.5 px-4 border border-slate-300/50 dark:border-white/10 rounded-2xl shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all"
              >
                Preview Data (First 10 Rows)
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl bg-red-500/10 p-4 border border-red-500/20 backdrop-blur-md">
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400 text-center">{error}</h3>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="pt-2">
          <button
            type="submit"
            disabled={isUploading || !file || !email}
            className="group relative overflow-hidden w-full flex justify-center py-3 px-4 border border-transparent rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)] text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative z-10 group-hover:text-white transition-colors">{isUploading ? 'Uploading & Processing...' : 'Start Pipeline'}</span>
          </button>
        </motion.div>
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md" 
            onClick={() => setShowPreview(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full border border-white/20 dark:border-white/10 flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Data Preview
                </h3>
              </div>
              <div className="p-6 overflow-auto">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                      <tr>
                        {previewHeaders.map((h, i) => (
                          <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                      {previewData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          {previewHeaders.map((h, j) => (
                            <td key={j} className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                              {row[h] !== undefined && row[h] !== null ? String(row[h]) : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:scale-105 transition-transform"
                  onClick={() => setShowPreview(false)}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
