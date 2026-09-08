
import test from 'node:test';
import assert from 'node:assert';
import { applyCleaningPlan, computeStats, parseFile } from '../src/utils/data-processing';

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

test('Data processing tracks unique values and applies outlier plans', () => {
  const rows = [
    { value: '1', group: 'a' }, { value: '2', group: 'a' }, { value: '3', group: 'a' },
    { value: '4', group: 'a' }, { value: '5', group: 'a' }, { value: '6', group: 'a' },
    { value: '7', group: 'a' }, { value: '8', group: 'a' }, { value: '9', group: 'a' },
    { value: '10', group: 'a' }, { value: '2000', group: 'b' }
  ];
  const stats = computeStats(rows);
  assert.strictEqual(stats.value.uniqueCount, 11);
  assert.strictEqual(stats.group.uniqueCount, 2);

  const result = applyCleaningPlan(rows, {
    columns: [{ name: 'value', type: 'number', null_handling: 'leave' }],
    dedup_keys: [],
    outliers: [{ column: 'value', rule: 'clip_to_3std', threshold: '3' }]
  });
  assert.ok(Number(result.cleanedData[10].value) < 2000);
  assert.match(result.log, /Clipped/);
});

test('JSON parser accepts arrays and nested arrays', () => {
  const direct = parseFile(Buffer.from('[{"id":1}]'), 'data.json');
  const nested = parseFile(Buffer.from('{"rows":[{"id":2}]}'), 'data.json');
  assert.deepStrictEqual(direct.data, [{ id: 1 }]);
  assert.deepStrictEqual(nested.data, [{ id: 2 }]);
});
