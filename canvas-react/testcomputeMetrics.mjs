import { computeMetrics } from './src/Experiment/computeMetricsOnly.js';


// ====================
// helper
// ====================

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    console.log(`PASS: ${label}`);
  } else { 
    console.log(`FAIL: ${label}`);
    console.log(`  expected: ${expected}`);
    console.log(`  actual:   ${actual}`);
  }
}

function runTest(testName, logs, interfaceType, checks) {
  console.log('\n========================');
  console.log(`TEST: ${testName}`);
  console.log('========================');

  const result = computeMetrics(logs, interfaceType);

  for (const check of checks) {
    assertEqual(
      result[check.key],
      check.expected,
      check.key
    );
  }
}


// ====================
// TEST 1 — SCROLL
// ====================

runTest(
  'SCROLL metrics',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'SCROLL',
      details: {
        distancePx: 1000,
        durationMs: 4000,
        backwardDistancePx: 300,
        backwardCount: 2,
        backwardDurationMs: 1500
      }
    }
  ],
  'traditional',
  [
    { key: 'scrollDistPx', expected: 1000 },
    { key: 'scrollDurSec', expected: 4 },
    { key: 'backwardNavDistPx', expected: 300 },
    { key: 'backwardNavCount', expected: 2 },
    { key: 'backwardNavDurSec', expected: 1.5 }
  ]
);


// ====================
// TEST 2 — MOUSE_MOVE
// ====================

runTest(
  'Mouse metrics',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'MOUSE_MOVE',
      details: {
        distancePx: 500,
        durationMs: 3000
      }
    }
  ],
  'traditional',
  [
    { key: 'mouseDistPx', expected: 500 },
    { key: 'mouseDurSec', expected: 3 }
  ]
);


// ====================
// TEST 3 — PROMPT
// ====================

runTest(
  'Prompt count',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'PROMPT_SUBMIT'
    },
    {
      timestamp: '2026-06-26T10:00:01.000Z',
      eventType: 'PROMPT_SUBMIT'
    },
    {
      timestamp: '2026-06-26T10:00:02.000Z',
      eventType: 'PROMPT_SUBMIT_TRADITIONAL'
    }
  ],
  'proposed',
  [
    { key: 'cntUserPrompts', expected: 3 }
  ]
);


// ====================
// TEST 4 — PARALLEL_WINDOW
// ====================

runTest(
  'Parallel window',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'PARALLEL_WINDOW_CREATE'
    },
    {
      timestamp: '2026-06-26T10:00:01.000Z',
      eventType: 'PARALLEL_WINDOW_DELETE'
    }
  ],
  'proposed',
  [
    { key: 'cntParallelWindowCreate', expected: 1 },
    { key: 'cntParallelWindowDelete', expected: 1 }
  ]
);


// ====================
// TEST 5 — MEMO
// ====================

runTest(
  'Memo actions',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'MEMO_CREATE'
    },
    {
      timestamp: '2026-06-26T10:00:01.000Z',
      eventType: 'MEMO_EDIT'
    },
    {
      timestamp: '2026-06-26T10:00:02.000Z',
      eventType: 'MEMO_DELETE'
    },
    {
      timestamp: '2026-06-26T10:00:03.000Z',
      eventType: 'MEMO_DRAG_DROP',
      details: {
        durationMs: 2000
      }
    }
  ],
  'proposed',
  [
    { key: 'cntMemoCreate', expected: 1 },
    { key: 'cntMemoEdit', expected: 1 },
    { key: 'cntMemoDelete', expected: 1 },
    { key: 'cntMemoDragDrop', expected: 1 }
  ]
);


// ====================
// TEST 6 — MAPS_TO_BODY
// ====================

runTest(
  'Maps to body split',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'MAPS_TO_BODY',
      details: {
        sourceType: 'memo'
      }
    },
    {
      timestamp: '2026-06-26T10:00:01.000Z',
      eventType: 'MAPS_TO_BODY',
      details: {
        sourceType: 'parallel_window'
      }
    }
  ],
  'proposed',
  [
    { key: 'cntMemoMapsToBody', expected: 1 },
    { key: 'cntBranchMapsToBody', expected: 1 }
  ]
);


// ====================
// OPTIONAL TEST 7
// ====================

runTest(
  'Traditional contamination check',
  [
    {
      timestamp: '2026-06-26T10:00:00.000Z',
      eventType: 'PARALLEL_WINDOW_DELETE'
    }
  ],
  'traditional',
  [
    { key: 'cntParallelWindowDelete', expected: 0 }
  ]
);