import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  '                          )}\n                        </div>\n                      )}\n                    </motion.div>',
  '                          )}\n                        </div>\n                    </motion.div>'
);
fs.writeFileSync('src/App.tsx', code);
