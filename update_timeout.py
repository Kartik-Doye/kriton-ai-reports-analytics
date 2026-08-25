import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add useCallback to import
content = content.replace("import { useState, useEffect, useRef } from 'react';", "import { useState, useEffect, useRef, useCallback } from 'react';")

# Add resetSession and inactivity timeout
reset_and_timeout = """  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const resetSession = useCallback(() => {
    setJobId(null);
    setJobStatus('pending');
    setLogs([]);
    setDashboardSpec(null);
    setCleanedData(null);
    setEmailStatus('idle');
  }, []);

  useEffect(() => {
    const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        resetSession();
      }, INACTIVITY_TIMEOUT);
    };

    resetTimer();

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [resetSession]);"""

content = content.replace("  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');", reset_and_timeout)

# Replace inline reset with resetSession
content = content.replace("onClick={() => { setJobId(null); setJobStatus('pending'); setLogs([]); setDashboardSpec(null); setCleanedData(null); }}", "onClick={resetSession}")

with open('src/App.tsx', 'w') as f:
    f.write(content)

