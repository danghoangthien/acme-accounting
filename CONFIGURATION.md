# Advanced Reports Configuration

## Job Storage Management

The Advanced Reports service now includes configurable job storage limits to optimize memory usage and system resources.

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MAX_STORED_JOBS` | Maximum number of completed jobs to keep in memory | `50` | `100` |
| `MAX_JOB_AGE_HOURS` | Maximum age of jobs in hours before deletion | `24` | `48` |

### Configuration Examples

#### Development Environment
```bash
# Keep more jobs for debugging
export MAX_STORED_JOBS=100
export MAX_JOB_AGE_HOURS=48
```

#### Production Environment
```bash
# Optimize for memory usage
export MAX_STORED_JOBS=25
export MAX_JOB_AGE_HOURS=12
```

#### High-Volume Environment
```bash
# Minimal storage for high-traffic systems
export MAX_STORED_JOBS=10
export MAX_JOB_AGE_HOURS=6
```

### Cleanup Behavior

1. **Automatic Cleanup**: Triggered every time a new job is started
2. **Count-Based**: Keeps only the most recent N completed jobs
3. **Age-Based**: Removes jobs older than specified hours
4. **Status-Based**: Only cleans up completed, failed, or cancelled jobs
5. **Active Jobs**: Never deletes jobs that are still pending or processing

### Monitoring

#### Get Storage Statistics
```bash
GET /api/v1/advanced-reports/stats
```

**Response:**
```json
{
  "total": 45,
  "pending": 0,
  "processing": 2,
  "completed": 40,
  "failed": 3,
  "cancelled": 0,
  "maxStoredJobs": 50,
  "maxJobAgeHours": 24
}
```

#### Manual Cleanup
```bash
POST /api/v1/advanced-reports/cleanup
```

**Response:**
```json
{
  "message": "Manual cleanup completed",
  "stats": {
    "total": 30,
    "completed": 25,
    "failed": 3,
    "cancelled": 2,
    "maxStoredJobs": 50,
    "maxJobAgeHours": 24
  }
}
```

### Memory Impact

| Jobs Stored | Estimated Memory | Use Case |
|-------------|------------------|----------|
| 10 jobs | ~1-2 MB | High-volume production |
| 50 jobs | ~5-10 MB | Standard production |
| 100 jobs | ~10-20 MB | Development/debugging |
| 500 jobs | ~50-100 MB | Not recommended |

### Recommendations

- **Production**: Set `MAX_STORED_JOBS=25` and `MAX_JOB_AGE_HOURS=12`
- **Development**: Set `MAX_STORED_JOBS=100` and `MAX_JOB_AGE_HOURS=48`
- **High-Traffic**: Set `MAX_STORED_JOBS=10` and `MAX_JOB_AGE_HOURS=6`
- **Monitor** storage stats regularly via `/stats` endpoint
- **Schedule** periodic manual cleanup during low-traffic periods 