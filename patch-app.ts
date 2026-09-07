import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Remove import
code = code.replace(/import \{ EmailModal \} from '\.\/components\/EmailModal';\n/g, '');

// Remove states
code = code.replace(/  const \[isEmailing, setIsEmailing\] = useState\(false\);\n/g, '');
code = code.replace(/  const \[emailStatus, setEmailStatus\] = useState<'idle' \| 'success' \| 'error'>\('idle'\);\n/g, '');
code = code.replace(/  const \[emailErrorMsg, setEmailErrorMsg\] = useState\(''\);\n/g, '');
code = code.replace(/  const \[isEmailModalOpen, setIsEmailModalOpen\] = useState\(false\);\n/g, '');

// Remove reset state lines inside handleReset
code = code.replace(/    setEmailStatus\('idle'\);\n/g, '');
code = code.replace(/    setIsEmailModalOpen\(false\);\n/g, '');

// Remove handleEmailReport
const handleEmailRegex = /  const handleEmailReport = async [\s\S]*?setTimeout\(\(\) => setEmailStatus\('idle'\), 3000\);\n    \}\n  \};\n/g;
code = code.replace(handleEmailRegex, '');

// Remove EmailModal component from JSX
code = code.replace(/      <EmailModal isOpen=\{isEmailModalOpen\}[\s\S]*? \/>\n/g, '');

// Adjust rendering condition
code = code.replace(/\$\{jobStatus === 'emailing' \? 'opacity-50 pointer-events-none' : ''\}/g, '');

// Check for the error message display for email
code = code.replace(/\{jobStatus === 'delivery_error' \? emailErrorMsg : 'An error occurred during processing.'\}/g, `'An error occurred during processing.'`);

// Remove "Email Report" button
const emailButtonRegex = /<button[\s\S]*?setIsEmailModalOpen\(true\)[\s\S]*?<\/button>/g;
code = code.replace(emailButtonRegex, '');

fs.writeFileSync('src/App.tsx', code);
