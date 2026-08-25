import PDFDocument from 'pdfkit';

export async function generateReportPdf(reportText: string, dashboardImage?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Cover Page
      doc.rect(0, 0, 595.28, 841.89).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold').text('Kriton Analytics', 50, 200, { align: 'center' });
      doc.fontSize(16).font('Helvetica').text('Comprehensive Executive Summary', 50, 250, { align: 'center' });
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
      
      // Add Dashboard Image
      if (dashboardImage) {
        doc.addPage();
        doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('Dashboard Snapshot', { align: 'left' });
        doc.moveDown();
        const base64Data = dashboardImage.replace(/^data:image\/\w+;base64,/, '');
        const imgBuffer = Buffer.from(base64Data, 'base64');
        doc.image(imgBuffer, 50, doc.y, { fit: [500, 700], align: 'center' });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
