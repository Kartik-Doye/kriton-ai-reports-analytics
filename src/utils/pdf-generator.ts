import PDFDocument from 'pdfkit';
import { DashboardSpec } from '../types.js';
import { formatStat } from './data-processing.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

function aggregateKpi(dataToUse: any[], kpiSpec: any) {
    let sum = 0, count = 0, min = Infinity, max = -Infinity;
    dataToUse.forEach(row => {
        const yVal = Number(row[kpiSpec.field]) || 0;
        sum += yVal; count++;
        min = Math.min(min, yVal); max = Math.max(max, yVal);
    });
    let val = 0;
    if (kpiSpec.agg === 'sum') val = sum;
    if (kpiSpec.agg === 'avg') val = count ? sum / count : 0;
    if (kpiSpec.agg === 'count') val = count;
    if (kpiSpec.agg === 'max') val = count ? max : 0;
    if (kpiSpec.agg === 'min') val = count ? min : 0;
    return formatStat(val);
}

function aggregateChart(dataToUse: any[], chartSpec: any) {
    const map: any = {};
    dataToUse.forEach(row => {
        const xVal = String(row[chartSpec.x] || 'Unknown');
        const yVal = Number(row[chartSpec.y]) || 0;
        if (!map[xVal]) map[xVal] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
        map[xVal].sum += yVal;
        map[xVal].count += 1;
        map[xVal].min = Math.min(map[xVal].min, yVal);
        map[xVal].max = Math.max(map[xVal].max, yVal);
    });
    return Object.entries(map).map(([x, stats]: any) => {
        let y = 0;
        if (chartSpec.agg === 'sum') y = stats.sum;
        if (chartSpec.agg === 'avg') y = stats.sum / stats.count;
        if (chartSpec.agg === 'count') y = stats.count;
        if (chartSpec.agg === 'max') y = stats.max;
        if (chartSpec.agg === 'min') y = stats.min;
        return { x, y: formatStat(y) };
    });
}

function formatNumber(num: number) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

export async function generateReportPdf(reportText: string, dashboardSpec?: DashboardSpec, cleanedData?: any[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Cover Page
      doc.rect(0, 0, 595.28, 841.89).fill('#ffffff');
      doc.fillColor('#0f172a').fontSize(32).font('Helvetica-Bold').text('Kriton Analytics', 50, 300, { align: 'center' });
      doc.fontSize(16).font('Helvetica').fillColor('#334155').text('Comprehensive Executive Summary', 50, 350, { align: 'center' });
      doc.fontSize(12).fillColor('#94a3b8').text(`Generated on ${new Date().toLocaleDateString()}`, 50, 750, { align: 'center' });
      
      doc.addPage();
      
      doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('Executive Summary', { align: 'left' });
      doc.moveDown();
      
      // Basic markdown parsing for the PDF
      const lines = reportText.split('\n');
      for (const line of lines) {
        if (line.trim() === '') {
          doc.moveDown(0.5);
        } else if (line.startsWith('# ')) {
          doc.font('Helvetica-Bold').fontSize(18).fillColor('#1e293b').text(line.replace('# ', '')).moveDown(0.5);
        } else if (line.startsWith('## ')) {
          doc.font('Helvetica-Bold').fontSize(16).fillColor('#334155').text(line.replace('## ', '')).moveDown(0.5);
        } else if (line.startsWith('### ')) {
          doc.font('Helvetica-Bold').fontSize(14).fillColor('#475569').text(line.replace('### ', '')).moveDown(0.5);
        } else if (line.startsWith('- ')) {
          doc.font('Helvetica').fontSize(11).fillColor('#334155').text(`• ${line.replace('- ', '')}`, { indent: 20, lineGap: 4 }).moveDown(0.2);
        } else {
          doc.font('Helvetica').fontSize(11).fillColor('#475569').text(line, { lineGap: 4 }).moveDown(0.5);
        }
      }

      // Add Dashboard Sections
      if (dashboardSpec && cleanedData && dashboardSpec.pages && dashboardSpec.pages.length > 0) {
        // Use the first page for the export
        const page = dashboardSpec.pages[0];
        
        doc.addPage();
        doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('Key Performance Indicators', { align: 'left' });
        doc.moveDown(2);
        
        // Draw KPIs in a grid
        let startY = doc.y;
        let xOffset = 50;
        
        page.kpis.forEach((kpi, idx) => {
            if (idx > 0 && idx % 3 === 0) {
                startY += 80;
                xOffset = 50;
            }
            const val = aggregateKpi(cleanedData, kpi);
            const formatVal = formatNumber(val);
            
            // Draw KPI Box
            doc.rect(xOffset, startY, 150, 60).lineWidth(1).stroke('#e2e8f0');
            doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text(kpi.label.toUpperCase(), xOffset + 10, startY + 10, { width: 130 });
            doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text(String(formatVal), xOffset + 10, startY + 30);
            
            xOffset += 165;
        });
        
        // Setup ChartJS Node Canvas
        const width = 800;
        const height = 450;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });
        
        let chartsAdded = 0;

        for (const chartSpec of page.charts) {
            const chartData = aggregateChart(cleanedData, chartSpec);
            
            if (chartData.length === 0 || !chartData.some((d: any) => d.y !== 0)) continue;
            
            if (chartSpec.type === 'bar' || chartSpec.type === 'pie') {
                chartData.sort((a: any, b: any) => b.y - a.y);
            }
            
            const labels = chartData.map((d: any) => d.x);
            const data = chartData.map((d: any) => d.y);
            const type = chartSpec.type === 'line' ? 'line' : (chartSpec.type === 'pie' ? 'pie' : 'bar');
            
            const configuration: any = {
                type: type,
                data: {
                    labels: labels,
                    datasets: [{
                        label: chartSpec.yAxisLabel || chartSpec.y,
                        data: data,
                        backgroundColor: type === 'line' ? 'rgba(59, 130, 246, 0.1)' : (type === 'pie' ? COLORS : COLORS[0]),
                        borderColor: type === 'line' ? COLORS[0] : (type === 'pie' ? '#fff' : COLORS[0]),
                        borderWidth: 1,
                        fill: type === 'line',
                        tension: 0.3
                    }]
                },
                options: {
                    plugins: {
                        legend: { display: type === 'pie' || type === 'line', labels: { font: { size: 14 } } },
                        title: { display: true, text: chartSpec.chartTitle || chartSpec.title, font: { size: 20 } }
                    },
                    scales: type === 'pie' ? {} : {
                        x: { title: { display: !!chartSpec.xAxisLabel, text: chartSpec.xAxisLabel, font: { size: 14 } }, ticks: { font: { size: 12 } } },
                        y: { title: { display: !!chartSpec.yAxisLabel, text: chartSpec.yAxisLabel, font: { size: 14 } }, ticks: { font: { size: 12 } }, beginAtZero: true }
                    }
                }
            };
            
            const imgBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
            
            if (chartsAdded % 2 === 0) {
                doc.addPage();
                doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('Detailed Charts', { align: 'left' });
                doc.moveDown();
                doc.image(imgBuffer, 50, doc.y, { fit: [500, 300], align: 'center' });
            } else {
                doc.image(imgBuffer, 50, doc.y + 320, { fit: [500, 300], align: 'center' });
            }
            chartsAdded++;
        }
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
