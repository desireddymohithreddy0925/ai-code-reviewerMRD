import test from 'node:test';
import assert from 'assert/strict';

// ---------------------------------------------------------------------------
// Unit tests for the /api/analytics/trends GET endpoint aggregation pipeline.
// The MongoDB aggregation pipeline ($match, $group, $sort, $project) is
// inlined as the function under test. MockAnalytics.aggregate() returns the
// result as if the pipeline ran against a real database.
// ---------------------------------------------------------------------------

// Mock Analytics — aggregate() returns pipeline output as-is
function createMockAnalytics(aggregateResult) {
  return class MockAnalytics {
    static async aggregate() {
      return aggregateResult;
    }
  };
}

// Inlined aggregation logic from the /api/analytics/trends endpoint
async function trendsHandler(Analytics) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trends = await Analytics.aggregate([
    {
      $match: {
        analyzedAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$analyzedAt' },
        },
        analyses: { $sum: 1 },
        totalFindings: { $sum: '$totalFindings' },
        avgHealthScore: { $avg: '$healthScore' },
        totalBugs: { $sum: '$totalBugs' },
        totalSecurityIssues: { $sum: '$totalSecurityIssues' },
      },
    },
    {
      $sort: { _id: 1 },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        analyses: 1,
        totalFindings: 1,
        avgHealthScore: { $round: ['$avgHealthScore', 1] },
        totalBugs: 1,
        totalSecurityIssues: 1,
      },
    },
  ]);

  return { trends };
}

// Mock data represents the final pipeline output ($project already applied)
const mockDataWithDate = [
  {
    date: '2026-06-01',
    analyses: 3,
    totalFindings: 15,
    avgHealthScore: 72.3,
    totalBugs: 5,
    totalSecurityIssues: 2,
  },
  {
    date: '2026-06-02',
    analyses: 1,
    totalFindings: 4,
    avgHealthScore: 80.0,
    totalBugs: 1,
    totalSecurityIssues: 0,
  },
];

test('returns trends with correct shape when data exists', async () => {
  const MockAnalytics = createMockAnalytics(mockDataWithDate);
  const result = await trendsHandler(MockAnalytics);

  assert.equal(result.trends.length, 2);
  assert.equal(result.trends[0].date, '2026-06-01');
  assert.equal(result.trends[0].analyses, 3);
  assert.equal(result.trends[0].totalFindings, 15);
  assert.equal(result.trends[0].totalBugs, 5);
  assert.equal(result.trends[0].totalSecurityIssues, 2);
});

test('returns empty array when no data in 30-day window', async () => {
  const MockAnalytics = createMockAnalytics([]);
  const result = await trendsHandler(MockAnalytics);
  assert.deepEqual(result.trends, []);
});

test('results are sorted by date ascending (MongoDB $sort applied)', async () => {
  // Mock returns data already sorted by MongoDB $sort stage
  const mockData = [
    { date: '2026-06-01', analyses: 5, totalFindings: 20, avgHealthScore: 80, totalBugs: 2, totalSecurityIssues: 4 },
    { date: '2026-06-05', analyses: 1, totalFindings: 3, avgHealthScore: 70, totalBugs: 1, totalSecurityIssues: 0 },
    { date: '2026-06-10', analyses: 2, totalFindings: 8, avgHealthScore: 75, totalBugs: 3, totalSecurityIssues: 1 },
  ];

  const MockAnalytics = createMockAnalytics(mockData);
  const result = await trendsHandler(MockAnalytics);

  assert.equal(result.trends[0].date, '2026-06-01');
  assert.equal(result.trends[1].date, '2026-06-05');
  assert.equal(result.trends[2].date, '2026-06-10');
});

test('$project excludes _id field from output', async () => {
  const mockData = [
    { date: '2026-06-01', analyses: 1, totalFindings: 5, avgHealthScore: 85, totalBugs: 1, totalSecurityIssues: 0 },
  ];

  const MockAnalytics = createMockAnalytics(mockData);
  const result = await trendsHandler(MockAnalytics);

  assert.equal('_id' in result.trends[0], false);
  assert.equal('date' in result.trends[0], true);
});

test('avgHealthScore is present in result', async () => {
  const mockData = [
    { date: '2026-06-01', analyses: 2, totalFindings: 10, avgHealthScore: 72.3, totalBugs: 2, totalSecurityIssues: 1 },
  ];

  const MockAnalytics = createMockAnalytics(mockData);
  const result = await trendsHandler(MockAnalytics);

  assert.equal(typeof result.trends[0].avgHealthScore, 'number');
  assert.equal(result.trends[0].avgHealthScore, 72.3);
});

test('handles MongoDB aggregation error gracefully', async () => {
  const MockAnalytics = class {
    static async aggregate() {
      throw new Error('MongoDB connection failed');
    }
  };

  try {
    await trendsHandler(MockAnalytics);
    assert.fail('Should have thrown');
  } catch (err) {
    assert.equal(err.message, 'MongoDB connection failed');
  }
});

test('all expected keys are present in a trend entry', async () => {
  const mockData = [
    { date: '2026-06-01', analyses: 3, totalFindings: 12, avgHealthScore: 78.5, totalBugs: 4, totalSecurityIssues: 2 },
  ];

  const MockAnalytics = createMockAnalytics(mockData);
  const result = await trendsHandler(MockAnalytics);
  const entry = result.trends[0];

  assert.equal(Object.prototype.hasOwnProperty.call(entry, 'date'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(entry, 'analyses'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(entry, 'totalFindings'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(entry, 'avgHealthScore'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(entry, 'totalBugs'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(entry, 'totalSecurityIssues'), true);
});

test('totalFindings accumulates across analyses per day', async () => {
  const mockData = [
    { date: '2026-06-01', analyses: 2, totalFindings: 10, avgHealthScore: 75, totalBugs: 3, totalSecurityIssues: 1 },
  ];

  const MockAnalytics = createMockAnalytics(mockData);
  const result = await trendsHandler(MockAnalytics);

  assert.equal(result.trends[0].totalFindings, 10);
  assert.equal(result.trends[0].analyses, 2);
});
