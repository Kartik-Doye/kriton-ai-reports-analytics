
import test from 'node:test';
import assert from 'node:assert';

test('Dashboard Spec Validation', () => {
  const fakeCleanedStats = {
    'Revenue': { type: 'number' },
    'Date': { type: 'date' }
  };
  
  const spec = {
    pages: [
      {
        id: '1',
        title: 'Overview',
        kpis: [
          { label: 'Total', field: 'Revenue', agg: 'sum' },
          { label: 'Bad', field: 'NonExistent', agg: 'sum' }
        ],
        charts: [
          { id: 'c1', type: 'line', title: 'Rev by Date', chartTitle: 'R', xAxisLabel: 'D', yAxisLabel: 'R', x: 'Date', y: 'Revenue', agg: 'sum' },
          { id: 'c2', type: 'line', title: 'Bad', chartTitle: 'B', xAxisLabel: 'D', yAxisLabel: 'R', x: 'Date', y: 'FakeCol', agg: 'sum' }
        ],
        insights: []
      }
    ]
  };

  const validColumns = new Set(Object.keys(fakeCleanedStats));
  spec.pages.forEach(page => {
    page.kpis = page.kpis.filter(kpi => validColumns.has(kpi.field));
    page.charts = page.charts.filter(chart => validColumns.has(chart.x) && validColumns.has(chart.y));
  });

  assert.strictEqual(spec.pages[0].kpis.length, 1, 'Should strip invalid KPI');
  assert.strictEqual(spec.pages[0].kpis[0].field, 'Revenue', 'Should keep valid KPI');
  assert.strictEqual(spec.pages[0].charts.length, 1, 'Should strip invalid chart');
  assert.strictEqual(spec.pages[0].charts[0].id, 'c1', 'Should keep valid chart');
});
