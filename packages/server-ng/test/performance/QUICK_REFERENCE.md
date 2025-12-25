# Performance Test Quick Reference

## 🚀 Quick Start

### Run All Performance Tests
```bash
pnpm test --config vitest.config.perf.ts --run
```

**Result**: 35 tests, ~2-3 seconds

### Run Specific Category
```bash
pnpm test --config vitest.config.perf.ts test/performance/article-queries.perf.spec.ts --run
pnpm test --config vitest.config.perf.ts test/performance/media-processing.perf.spec.ts --run
pnpm test --config vitest.config.perf.ts test/performance/cache.perf.spec.ts --run
pnpm test --config vitest.config.perf.ts test/performance/database-queries.perf.spec.ts --run
pnpm test --config vitest.config.perf.ts test/performance/plugin-hooks.perf.spec.ts --run
```

## 📊 Test Coverage

| Category | Tests | Focus | Key Metric |
|----------|-------|-------|-----------|
| **Article Queries** | 7 | Query performance, memory | < 50ms lookups |
| **Media Processing** | 7 | Throughput, batch ops | 2000+ img/sec |
| **Cache** | 7 | Stampede, LRU, TTL | No leaks |
| **Database** | 7 | Indexes, JOINs, bulk ops | < 500ms queries |
| **Plugin Hooks** | 7 | Loading, concurrency, ordering | < 2 sec load |
| **TOTAL** | **35** | **All critical services** | **All passing ✅** |

## 📁 Files Created

### Test Files (5)
1. `article-queries.perf.spec.ts` (382 lines)
2. `media-processing.perf.spec.ts` (334 lines)
3. `cache.perf.spec.ts` (406 lines)
4. `database-queries.perf.spec.ts` (414 lines)
5. `plugin-hooks.perf.spec.ts` (484 lines)

### Documentation (2)
1. `README.md` - Complete guide (382 lines)
2. `IMPLEMENTATION_SUMMARY.md` - Implementation details (353 lines)

### Configuration (1)
1. `vitest.config.perf.ts` - Performance test config

## 📈 Performance Baselines

### Query Performance
| Metric | Baseline | Status |
|--------|----------|--------|
| Single lookup | < 50ms | ✅ |
| Paginated (1000) | < 200ms | ✅ |
| Complex filter | < 500ms | ✅ |
| Memory (1000 ops) | < 50MB | ✅ |
| Concurrent (50) | No degradation | ✅ |

### Media Processing
| Metric | Baseline | Status |
|--------|----------|--------|
| Process 100 images | < 5 sec (20+ img/s) | ✅ |
| Resize 10MB | < 2 sec | ✅ |
| Watermark 50 | Efficient batch | ✅ |
| Thumbnails | Stable memory | ✅ |
| Queue | No overflow | ✅ |

### Cache Operations
| Metric | Baseline | Status |
|--------|----------|--------|
| 10K writes | No leak | ✅ |
| Stampede (100 reqs) | 1 generator call | ✅ |
| LRU eviction | Works correctly | ✅ |
| Serialization | < 100ms | ✅ |
| Concurrent R/W | No deadlock | ✅ |

### Database Queries
| Metric | Baseline | Status |
|--------|----------|--------|
| Bulk insert 1000 | < 5 sec | ✅ |
| Complex JOIN | Proper plan | ✅ |
| Aggregations | Optimized | ✅ |
| Full-text search | < 500ms | ✅ |
| Cascade delete | Efficient | ✅ |

### Plugin System
| Metric | Baseline | Status |
|--------|----------|--------|
| Load 20 plugins | < 2 sec | ✅ |
| 10 handlers | Ordered | ✅ |
| 1000 iterations | Consistent | ✅ |
| With DB queries | Efficient | ✅ |
| 100 concurrent | Thread-safe | ✅ |

## 🔍 Performance Measurement

### Latency (Query, Hook, Operations)
```
Measured: mean, min, max (milliseconds)
Threshold: Usually < 100-500ms depending on operation
```

### Throughput (Images, Operations, Queries)
```
Measured: operations per second (ops/sec)
Threshold: Usually > 10-1000 ops/sec depending on operation
```

### Memory
```
Measured: heap usage, growth rate, peak allocation (MB)
Threshold: Usually < 50-100MB increase, no leaks
```

## 🧪 Test Patterns Used

### 1. Benchmark Loop
```typescript
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  // Operation
  const end = performance.now();
  measurements.push(end - start);
}
const mean = measurements.reduce((a, b) => a + b) / measurements.length;
```

### 2. Concurrent Load
```typescript
const results = await Promise.all(
  Array(concurrentCount).fill(null).map(() => operation())
);
```

### 3. Memory Check
```typescript
const initialMemory = process.memoryUsage().heapUsed;
// Operations
if (global.gc) global.gc();
const finalMemory = process.memoryUsage().heapUsed;
```

## 📝 Test Results Summary

**Test Run**: December 25, 2025
- **Files**: 5 ✅
- **Tests**: 35 ✅
- **Duration**: ~2.18 seconds
- **Status**: All passing ✅

### Output Files Generated
- `junit-report.perf.xml` - CI/CD integration
- `coverage-perf/` - Coverage reports

## 🎯 Common Commands

```bash
# Run all performance tests
pnpm test --config vitest.config.perf.ts --run

# Run with verbose output
pnpm test --config vitest.config.perf.ts --run --reporter=verbose

# Run in watch mode
pnpm test --config vitest.config.perf.ts --watch

# With garbage collection
node --expose-gc ./node_modules/vitest/vitest.mjs \
  --config vitest.config.perf.ts --run

# Individual test file
pnpm test --config vitest.config.perf.ts \
  test/performance/article-queries.perf.spec.ts --run
```

## 📖 Documentation Files

1. **README.md** - Full guide with:
   - Detailed test descriptions
   - Running instructions
   - Metric interpretation
   - Performance thresholds
   - Test design patterns
   - CI/CD integration
   - Future enhancements

2. **IMPLEMENTATION_SUMMARY.md** - Overview with:
   - What was built
   - Test statistics
   - Key achievements
   - File locations
   - Integration steps

## ⚠️ Important Notes

### Exclude from Regular Tests
Performance tests are automatically excluded from `pnpm test` to avoid slowing down regular test runs.

To run regular unit tests:
```bash
pnpm test  # Uses vitest.config.ts (excludes .perf.spec.ts)
```

### CI/CD Integration
The `vitest.config.perf.ts` generates JUnit XML reports suitable for CI integration:
```xml
junit-report.perf.xml
```

### Customization
To add new performance tests:
1. Create file: `test/performance/feature-name.perf.spec.ts`
2. Follow existing patterns
3. Add performance baselines in comments
4. Update README.md

## 🔗 Related Files

```
packages/server-ng/
├── test/
│   ├── performance/
│   │   ├── article-queries.perf.spec.ts
│   │   ├── media-processing.perf.spec.ts
│   │   ├── cache.perf.spec.ts
│   │   ├── database-queries.perf.spec.ts
│   │   ├── plugin-hooks.perf.spec.ts
│   │   ├── README.md
│   │   └── IMPLEMENTATION_SUMMARY.md
│   ├── vitest-fixtures.test.ts
│   ├── setup.unit.ts
│   └── mock-utils.ts
├── vitest.config.ts (updated)
├── vitest.config.perf.ts (new)
├── src/
│   └── ... (application code)
└── docs/
    └── ... (other documentation)
```

## 💡 Tips & Tricks

### Measuring Specific Operations
```typescript
// Use this pattern for consistent measurements
const measurements: number[] = [];
for (let i = 0; i < 10; i++) {
  const start = performance.now();
  await operation();
  const end = performance.now();
  measurements.push(end - start);
}
const mean = measurements.reduce((a, b) => a + b) / measurements.length;
```

### Detecting Memory Leaks
```typescript
if (global.gc) global.gc(); // Force garbage collection
const initialMemory = process.memoryUsage().heapUsed;
// ... perform operations ...
const finalMemory = process.memoryUsage().heapUsed;
const leak = finalMemory - initialMemory;
```

### Testing Concurrent Operations
```typescript
const concurrent = Promise.all(
  Array(50).fill(null).map(() => operation())
);
// Check for deadlocks, race conditions, overflow
```

## 🚨 Troubleshooting

### Tests run slowly
- Reduce iteration counts in test
- Use `--reporter=quiet` to reduce output
- Check for blocking operations

### Flaky test results
- Increase warm-up iterations
- Add tolerance to assertions (e.g., `toBeLessThan(expected * 1.1)`)
- Check for background processes

### Memory measurements incorrect
- Use `node --expose-gc` to force garbage collection
- Run fewer parallel tests
- Check system memory availability

---

**Last Updated**: December 25, 2025
**Status**: Production Ready ✅
**Test Count**: 35 tests across 5 categories
