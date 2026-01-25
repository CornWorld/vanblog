# Performance & Stress Test Suite

**Location**: `/packages/server-ng/test/performance/`

**Purpose**: Comprehensive performance benchmarking and stress testing for critical services in the VanBlog server.

## Overview

The performance test suite measures system behavior under various load conditions, ensuring that critical services maintain acceptable performance as data volume and concurrency increase. Tests focus on throughput, latency, memory stability, and resource efficiency.

## Test Files

### 1. Article Query Performance (`article-queries.perf.spec.ts`)

**Objective**: Validate article query performance under various conditions.

**Test Coverage**:

| Test | Scenario | Baseline | Metric |
|------|----------|----------|--------|
| Single Article Lookup | Find 1 article by ID | < 50ms | Latency |
| Paginate 1000 Articles | Query 10 pages of results | < 200ms/page | Throughput |
| Complex Filters | Tags + Categories + Date Range | < 500ms | Latency (p99) |
| 50 Concurrent Reads | Parallel article access | No degradation | Consistency |
| Article + 100 Tags | Query with many relations | Acceptable | Latency |
| Memory Stability | 1000 queries without leak | < 50MB increase | Memory |

**Performance Baselines**:
- Single lookup: < 50ms
- Paginated query: < 200ms
- Complex filter: < 500ms
- Concurrent reads: Consistent throughput
- Article with 100+ tags: Query performant
- Memory: < 50MB increase over 1000 queries

### 2. Media Processing Performance (`media-processing.perf.spec.ts`)

**Objective**: Measure image processing throughput and memory efficiency.

**Test Coverage**:

| Test | Scenario | Baseline | Metric |
|------|----------|----------|--------|
| Process 100 Images | Parallel processing | < 5 seconds | Throughput |
| Resize 10MB Image | Large file handling | < 2 seconds | Latency |
| Watermark 50 Images | Batch watermarking | Efficient | Batch time |
| Generate 100 Thumbnails | Bulk thumbnail creation | Stable memory | Memory |
| 20 Concurrent Uploads | Multiple clients uploading | No queue overflow | Queue depth |
| Queue Stability | 200 images in queue | No overflow | Queue behavior |

**Performance Baselines**:
- Process 100 images: < 5 seconds (20+ images/sec)
- Resize 10MB: < 2 seconds
- Watermark 50 images: Batch processing efficient
- Thumbnails: Memory growth < 20MB/batch
- Concurrent uploads: 20 clients × 5 files each
- Queue: No overflow at max capacity

### 3. Cache Performance (`cache.perf.spec.ts`)

**Objective**: Validate cache system behavior under various access patterns.

**Test Coverage**:

| Test | Scenario | Baseline | Metric |
|------|----------|----------|--------|
| 10K Cache Writes | Bulk write operations | No memory leak | Memory pattern |
| Stampede Mitigation | 100 concurrent miss requests | Single generator call | Call count |
| LRU Eviction (1000+ keys) | Cache capacity exceeded | Eviction works | Eviction count |
| Serialization | Complex object JSON | < 100ms | Latency |
| Concurrent R/W (50/50) | Mixed read/write ops | No deadlock | Consistency |
| TTL Expiration | Entry expiration cleanup | All expired removed | Cleanup |

**Performance Baselines**:
- 10K writes: Memory growth < 100MB
- Stampede: Generator called once or twice
- LRU: Size stays at capacity
- Serialization: < 10ms for complex objects
- Concurrent R/W: No deadlock
- TTL: Complete expiration

### 4. Database Query Optimization (`database-queries.perf.spec.ts`)

**Objective**: Ensure database queries scale efficiently with data volume.

**Test Coverage**:

| Test | Scenario | Baseline | Metric |
|------|----------|----------|--------|
| Bulk Insert 1000 | Batch insert performance | < 5 seconds | Throughput |
| Complex JOIN | Multi-table joins | Proper indexing | Latency |
| Aggregations | COUNT, SUM, GROUP BY | Optimized | Latency |
| Full-Text Search (10K articles) | Search performance | Acceptable latency | P95 latency |
| Cascade Delete 1000 | Foreign key cleanup | Efficient | Throughput |
| Index Efficiency | Indexed vs non-indexed | Measurable improvement | Ratio |

**Performance Baselines**:
- Bulk insert: < 5 seconds (200+ articles/sec)
- Complex JOIN: < 200ms
- Aggregations: < 150ms
- Full-text search: < 500ms mean, < 1000ms max
- Cascade delete: < 500ms per operation
- Index efficiency: 2-5x improvement with indexes

### 5. Plugin Hook Performance (`plugin-hooks.perf.spec.ts`)

**Objective**: Measure plugin system overhead and ensure hooks scale efficiently.

**Test Coverage**:

| Test | Scenario | Baseline | Metric |
|------|----------|----------|--------|
| Load 20 Plugins | Plugin initialization | < 2 seconds | Throughput |
| Hook + 10 Handlers | Multiple handler execution | Ordered execution | Latency |
| Filter 1000 Iterations | Repeated transformations | No slowdown | Consistency |
| Hook with DB Queries | Database in hooks | Connection pool efficient | Latency |
| 100 Concurrent Hooks | Parallel hook execution | Thread-safe | Concurrency |
| Hook Priority/Order | Execution ordering | Priority respected | Correctness |

**Performance Baselines**:
- Load 20 plugins: < 2 seconds (10+ plugins/sec)
- Hook execution: < 50ms with 10 handlers
- Filter transformations: < 100ms for 1000 iterations
- Hook + DB: < 50ms per execution
- Concurrent hooks: Safe execution at 100 parallel
- Hook ordering: Priority order maintained

## Running Performance Tests

### Run All Performance Tests

```bash
# All performance tests (includes coverage exclusion)
pnpm test test/performance/*.perf.spec.ts

# With verbose output
pnpm test test/performance/*.perf.spec.ts --reporter=verbose
```

### Run Specific Performance Test

```bash
# Article queries only
pnpm test test/performance/article-queries.perf.spec.ts

# Media processing only
pnpm test test/performance/media-processing.perf.spec.ts

# Cache tests only
pnpm test test/performance/cache.perf.spec.ts

# Database tests only
pnpm test test/performance/database-queries.perf.spec.ts

# Plugin tests only
pnpm test test/performance/plugin-hooks.perf.spec.ts
```

### Run with Garbage Collection

```bash
# Force garbage collection between tests (more accurate memory measurement)
node --expose-gc ./node_modules/vitest/vitest.mjs test test/performance/*.perf.spec.ts
```

### Run in Watch Mode

```bash
# Watch performance tests during development
pnpm test test/performance/*.perf.spec.ts --watch
```

## Performance Metrics

### Measurement Approaches

#### 1. Latency Measurements
- **Mean**: Average response time
- **Min/Max**: Range of response times
- **P95/P99**: Percentile latencies for tail performance

Example output:
```
Single article lookup - Mean: 2.45ms, Min: 1.82ms, Max: 5.31ms
```

#### 2. Throughput Measurements
- **Operations per second**: Total ops / elapsed time
- **Batch throughput**: Ops in batch / batch time

Example output:
```
Processing 100 images - Throughput: 25.5 img/s
```

#### 3. Memory Measurements
- **Heap used**: Total heap allocation
- **Growth rate**: Memory increase per operation
- **Peak memory**: Maximum observed heap usage

Example output:
```
Cache 10,000 writes - Total memory: 45.23MB, Per-key: 46.27KB, Growth pattern: 8.5, 8.3, 8.4MB
```

#### 4. Consistency Checks
- **Degradation detection**: Performance drop over time
- **Queue overflow**: Unhandled request accumulation
- **Memory leak patterns**: Growing memory without release

## Performance Thresholds

### Acceptable Ranges

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Query latency | < 100ms | 100-500ms | > 500ms |
| Throughput (images) | > 20/sec | 10-20/sec | < 10/sec |
| Memory per item | < 50KB | 50-100KB | > 100KB |
| Concurrent ops | > 50 | 20-50 | < 20 |
| Cache hit ratio | > 80% | 60-80% | < 60% |

### Performance Regression Detection

Performance tests should be run:
1. **Before commits**: Baseline measurement
2. **After optimization**: Verify improvements
3. **Periodic checks**: Weekly/monthly regression detection
4. **Stress testing**: Load testing before release

## Performance Test Design Patterns

### 1. Benchmark Pattern

```typescript
const measurements: number[] = [];

for (let i = 0; i < iterations; i++) {
  const start = performance.now();

  // Operation to benchmark
  await operation();

  const end = performance.now();
  measurements.push(end - start);
}

const mean = measurements.reduce((a, b) => a + b) / measurements.length;
const min = Math.min(...measurements);
const max = Math.max(...measurements);

expect(mean).toBeLessThan(expectedThreshold);
```

### 2. Throughput Pattern

```typescript
const startTime = performance.now();

// Execute N operations
for (let i = 0; i < operationCount; i++) {
  await operation(i);
}

const totalTime = performance.now() - startTime;
const throughput = operationCount / (totalTime / 1000); // ops/sec

expect(throughput).toBeGreaterThan(minimumThroughput);
```

### 3. Memory Pattern

```typescript
const initialMemory = process.memoryUsage().heapUsed;

// Perform operations
for (let i = 0; i < iterations; i++) {
  await operation();
}

if (global.gc) global.gc(); // Force garbage collection

const finalMemory = process.memoryUsage().heapUsed;
const memoryIncrease = finalMemory - initialMemory;

expect(memoryIncrease).toBeLessThan(maxExpectedIncrease);
```

### 4. Concurrent Load Pattern

```typescript
const operations = Array.from({ length: concurrentCount },
  (_, i) => operation(i)
);

const startTime = performance.now();
const results = await Promise.all(operations);
const totalTime = performance.now() - startTime;

expect(results).toHaveLength(concurrentCount);
expect(totalTime).toBeLessThan(expectedDuration);
```

## Continuous Performance Monitoring

### CI/CD Integration

Performance tests should:
1. **Run on every push**: Catch regressions early
2. **Store baselines**: Track performance history
3. **Alert on degradation**: Fail CI if > 10% slowdown
4. **Generate reports**: HTML/JSON for analysis

### Manual Performance Testing

```bash
# Full performance suite (all 5 test files)
pnpm test test/performance/*.perf.spec.ts --run

# Generate performance report
pnpm test test/performance/*.perf.spec.ts --reporter=verbose --run > perf-report.txt
```

## Interpreting Results

### Good Results ✅

```
✓ Single article lookup - Mean: 2.45ms
✓ Paginate 1000 articles - Mean: 89.3ms
✓ Cache 10000 writes - Total: 45.2MB (< 100MB threshold)
```

### Warning Results ⚠️

```
✓ Complex filter - Mean: 350ms (nearing 500ms threshold)
✓ Concurrent reads - Degradation: 35% (moderate)
```

### Critical Results ❌

```
✗ Query timeout - Expected < 500ms, got 1200ms
✗ Memory leak - Expected < 50MB, got 150MB increase
✗ Queue overflow - Lost 15 of 100 operations
```

## Future Enhancements

- [ ] Load testing with sustained concurrent load
- [ ] Spike testing (sudden load spikes)
- [ ] Soak testing (long-running stability)
- [ ] Endurance testing (memory leak detection over hours)
- [ ] Chaos testing (random failures, delays)
- [ ] Automated regression reporting
- [ ] Performance dashboard visualization
- [ ] Distributed tracing integration

## Related Documentation

- Main test guide: `./../../CLAUDE.md` (Testing Strategy section)
- Server-ng module docs: `./../../packages/server-ng/CLAUDE.md`
- Article query optimization: `./database-queries.perf.spec.ts`
- Plugin system design: `./plugin-hooks.perf.spec.ts`
- Media processing pipeline: `./media-processing.perf.spec.ts`

## Contact & Support

For performance-related questions or to add new performance tests:

1. Create test file in `/test/performance/`
2. Follow naming convention: `*.perf.spec.ts`
3. Include baseline thresholds in comments
4. Add test summary to this documentation
5. Run `pnpm test test/performance/*.perf.spec.ts` to verify

---

**Last Updated**: 2025-12-25
**Test Count**: 5 files, 40+ performance tests
**Coverage**: Articles, Media, Cache, Database, Plugins
