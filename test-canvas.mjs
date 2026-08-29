import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
const width = 800;
const height = 450;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
const configuration = {
  type: 'bar',
  data: {
    labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
    datasets: [{ label: '# of Votes', data: [12, 19, 3, 5, 2, 3] }]
  }
};
const image = await chartJSNodeCanvas.renderToBuffer(configuration);
console.log("Canvas works, buffer length:", image.length);
