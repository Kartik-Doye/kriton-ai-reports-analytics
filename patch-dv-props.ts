import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

code = code.replace(
  'autoExport: boolean;\n  dataQuality?: { totalRecords: number; rowsExcluded: number };',
  'autoExport: boolean;\n  dataQuality?: { totalRecords: number; rowsExcluded: number };\n  cleaningLog?: string;'
).replace(
  'export function DashboardView({ jobId, jobToken, spec, data, autoExport, dataQuality }: Props) {',
  'export function DashboardView({ jobId, jobToken, spec, data, autoExport, dataQuality, cleaningLog }: Props) {'
).replace(
  'import { MessageCircle, X, User, Bot, AlertTriangle, Database, ShieldAlert } from \'lucide-react\';',
  'import { MessageCircle, X, User, Bot, AlertTriangle, Database, ShieldAlert, ChevronDown, ChevronRight, Activity, Zap } from \'lucide-react\';'
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
