const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /<EmailModal \s*isOpen=\{isEmailModalOpen\}\s*onClose=\{\(\) => setIsEmailModalOpen\(false\)\}\s*onSend=\{handleEmailReport\}\s*status=\{isEmailing \? 'sending' : emailStatus\}\s*\/>/m,
  "<EmailModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} onSend={handleEmailReport} status={isEmailing ? 'sending' : emailStatus} jobId={jobId} jobToken={jobToken} />"
);

fs.writeFileSync('src/App.tsx', code);
