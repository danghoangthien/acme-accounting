import { registerAs } from '@nestjs/config';

export default registerAs('reports', () => ({
  maxStoredJobs: parseInt(process.env.MAX_STORED_JOBS || '50', 10),
  maxJobAgeHours: parseInt(process.env.MAX_JOB_AGE_HOURS || '24', 10),
  maxWorkers: parseInt(process.env.MAX_WORKERS || '3', 10),
  pollingIntervalMs: parseInt(process.env.POLLING_INTERVAL_MS || '1000', 10),
}));

export interface ReportsConfig {
  maxStoredJobs: number;
  maxJobAgeHours: number;
  maxWorkers: number;
  pollingIntervalMs: number;
} 