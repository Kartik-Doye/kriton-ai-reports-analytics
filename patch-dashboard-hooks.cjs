const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const replacement = `
  const [dataToUse, setDataToUse] = useState<any[]>(data);
  const [crossFilter, setCrossFilter] = useState<{ field: string, value: string } | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  
  useEffect(() => {
    if (crossFilter) {
      setDataToUse(data.filter(r => String(r[crossFilter.field]) === crossFilter.value));
    } else {
      setDataToUse(data);
    }
  }, [crossFilter, data]);
  
  const allColumns = data.length > 0 ? Object.keys(data[0]) : [];
  const [selectedColumns, setSelectedColumns] = useState<string[]>(allColumns.slice(0, 10));

  const handleChartClick = (e: any, chartSpec: any) => {
    if (!e || !e.activePayload || e.activePayload.length === 0) return;
    const xVal = e.activePayload[0].payload.x;
    
    if (crossFilter && crossFilter.field === chartSpec.x && crossFilter.value === String(xVal)) {
      setCrossFilter(null);
    } else {
      setCrossFilter({ field: chartSpec.x, value: String(xVal) });
    }
  };

  const handleExportCsv = () => {
    const csv = Papa.unparse(data.map(row => {
      const exportRow: any = {};
      selectedColumns.forEach(c => exportRow[c] = row[c]);
      return exportRow;
    }));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kriton_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;
    const newMessage = { role: 'user' as const, content: chatMessage };
    setChatHistory([...chatHistory, newMessage]);
    setChatMessage('');
    setIsChatLoading(true);

    try {
      const res = await fetch(\`/api/job/\${jobId}/chat\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatMessage, jobToken })
      });
      const resData = await res.json();
      setChatHistory(prev => [...prev, { role: 'assistant', content: resData.reply }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Sorry, failed to get a response.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };
`;

code = code.replace("  // Group data for charts", replacement + "\n  // Group data for charts");
fs.writeFileSync('src/components/DashboardView.tsx', code);
