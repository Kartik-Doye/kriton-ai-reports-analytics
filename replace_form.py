import re

with open('src/components/UploadForm.tsx', 'r') as f:
    content = f.read()

import_str = """import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../auth';
import { User } from 'firebase/auth';"""

content = re.sub(r'import React.*?from \'motion/react\';', import_str, content, flags=re.DOTALL)

state_str = """export function UploadForm({ onSuccess }: Props) {
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {"""

content = re.sub(r'export function UploadForm.*?const onDrop = useCallback\(async \(acceptedFiles: File\[\]\) => \{', state_str, content, flags=re.DOTALL)

submit_str = """  const handleSubmit = async (e: React.FormEvent) => {
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
      onSuccess(data.jobId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (needsAuth) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl p-10 rounded-[2rem] shadow-2xl shadow-black/5 border border-white/40 dark:border-white/10 w-full text-center max-w-xl mx-auto mt-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white mb-4">Welcome to DataInsight</h2>
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

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>"""

content = re.sub(r'  const handleSubmit = async \(e: React.FormEvent\) => \{.*?<motion.div initial=\{\{ opacity: 0, x: 10 \}\} animate=\{\{ opacity: 1, x: 0 \}\} transition=\{\{ delay: 0.4 \}\}>', submit_str, content, flags=re.DOTALL)

with open('src/components/UploadForm.tsx', 'w') as f:
    f.write(content)

