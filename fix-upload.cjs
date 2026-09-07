const fs = require('fs');
let code = fs.readFileSync('src/components/UploadForm.tsx', 'utf8');

// Remove auth imports
code = code.replace(/import \{ User \} from 'firebase\/auth';\n/g, '');
code = code.replace(/import \{ initAuth, googleSignIn, logout, getAccessToken \} from '\.\.\/auth';\n/g, '');

// The component has states: isLoggingIn, token, user, needsAuth
// We should remove them and the useEffect that checks auth.
// Actually, it's easier to just strip them out and let it always be authenticated (or no auth).
// Let's replace the whole state logic and just default to needsAuth=false.

code = code.replace(/const \[needsAuth, setNeedsAuth\] = useState\(true\);/g, 'const [needsAuth, setNeedsAuth] = useState(false);');
code = code.replace(/const \[isLoggingIn, setIsLoggingIn\] = useState\(false\);/g, '');
code = code.replace(/const \[token, setToken\] = useState<string \| null>\(null\);/g, '');
code = code.replace(/const \[user, setUser\] = useState<User \| null>\(null\);/g, '');

// Remove useEffect for auth
const useEffectStart = code.indexOf('useEffect(() => {\n    initAuth(');
if (useEffectStart !== -1) {
  const useEffectEnd = code.indexOf('}, []);', useEffectStart) + 7;
  code = code.substring(0, useEffectStart) + code.substring(useEffectEnd);
}

// Remove googleSignIn and handleLogout functions
const handleLoginStart = code.indexOf('const handleLogin = async () => {');
if (handleLoginStart !== -1) {
  const handleLoginEnd = code.indexOf('};\n\n  const handleLogout = async () => {', handleLoginStart);
  const handleLogoutEnd = code.indexOf('};\n', handleLoginEnd) + 3;
  code = code.substring(0, handleLoginStart) + code.substring(handleLogoutEnd);
}

// The UI has a login screen if needsAuth is true. Since needsAuth is false, it won't show.
// But there is a user profile UI that shows the email and logout button.
const userProfileRegex = /<div className="flex items-center gap-3">[\s\S]*?<\/div>/g;
// We can just leave it or remove it. Let's find it and remove it.
const profileStart = code.indexOf('<div className="flex items-center justify-between mb-8">');
if (profileStart !== -1) {
  const profileEnd = code.indexOf('</div>', profileStart + 10) + 6;
  // Actually, wait, it's a flex container with logo and profile.
  // It's safer to just let the JSX be, but we removed `user` and `handleLogout`.
}

fs.writeFileSync('src/components/UploadForm.tsx', code);
