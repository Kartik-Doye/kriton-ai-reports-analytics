const fs = require('fs');
let code = fs.readFileSync('src/components/UploadForm.tsx', 'utf8');

// Replace handleLogin and isLoggingIn with simple fallbacks just in case the JSX still references them
code = code.replace(/export function UploadForm\(\{ onSuccess, onRestore \}: Props\) \{/g, `export function UploadForm({ onSuccess, onRestore }: Props) {
  const [needsAuth, setNeedsAuth] = useState(false);
  const isLoggingIn = false;
  const handleLogin = async () => {};
`);

fs.writeFileSync('src/components/UploadForm.tsx', code);
