import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AdvancedReportsService } from './advanced-reports.service';
import reportsConfig from '../config/reports.config';

// Mock worker_threads to avoid actual worker creation during tests
jest.mock('worker_threads', () => ({
  Worker: jest.fn(),
  isMainThread: true,
  parentPort: null,
  workerData: null
}));

// Mock fs operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  createReadStream: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn(),
  statSync: jest.fn()
}));

describe('AdvancedReportsService', () => {
  let service: AdvancedReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [reportsConfig],
          isGlobal: true,
        }),
      ],
      providers: [AdvancedReportsService],
    }).compile();

    service = module.get<AdvancedReportsService>(AdvancedReportsService);
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be an instance of AdvancedReportsService', () => {
      expect(service).toBeInstanceOf(AdvancedReportsService);
    });
  });

  describe('Job Management', () => {
    describe('startParallelProcessing', () => {
      it('should generate a unique job ID', async () => {
        const jobId = await service.startParallelProcessing();
        
        expect(jobId).toBeDefined();
        expect(typeof jobId).toBe('string');
        expect(jobId).toMatch(/^job_\d+_[a-z0-9]+$/);
      });

      it('should generate different job IDs for multiple calls', async () => {
        const jobId1 = await service.startParallelProcessing();
        const jobId2 = await service.startParallelProcessing();
        
        expect(jobId1).not.toBe(jobId2);
      });
    });

    describe('getJobStatus', () => {
      it('should return null for non-existent job', () => {
        const status = service.getJobStatus('non-existent-job');
        expect(status).toBeNull();
      });

      it('should return job status after starting a job', async () => {
        const jobId = await service.startParallelProcessing();
        const status = service.getJobStatus(jobId);
        
        expect(status).toBeDefined();
        expect(status?.id).toBe(jobId);
        expect(status?.startTime).toBeInstanceOf(Date);
        expect(['pending', 'processing', 'completed', 'failed']).toContain(status?.status);
      });
    });

    describe('getAllJobs', () => {
      it('should return empty array initially', () => {
        const jobs = service.getAllJobs();
        expect(jobs).toEqual([]);
      });

      it('should return jobs after creating them', async () => {
        await service.startParallelProcessing();
        await service.startParallelProcessing();
        
        const jobs = service.getAllJobs();
        expect(jobs).toHaveLength(2);
        expect(jobs[0]).toHaveProperty('id');
        expect(jobs[0]).toHaveProperty('status');
        expect(jobs[0]).toHaveProperty('startTime');
      });
    });

    describe('cancelJob', () => {
      it('should return false for non-existent job', async () => {
        const result = await service.cancelJob('non-existent-job');
        expect(result).toBe(false);
      });

      it('should return true for existing pending job', async () => {
        const jobId = await service.startParallelProcessing();
        const result = await service.cancelJob(jobId);
        
        expect(result).toBe(true);
        
        const status = service.getJobStatus(jobId);
        expect(status?.status).toBe('cancelled');
      });
    });
  });

  describe('Storage Management', () => {
    describe('getStorageStats', () => {
      it('should return storage statistics', () => {
        const stats = service.getStorageStats();
        
        expect(stats).toBeDefined();
        expect(stats).toHaveProperty('total');
        expect(stats).toHaveProperty('pending');
        expect(stats).toHaveProperty('processing');
        expect(stats).toHaveProperty('completed');
        expect(stats).toHaveProperty('failed');
        expect(stats).toHaveProperty('cancelled');
        expect(stats).toHaveProperty('maxStoredJobs');
        expect(stats).toHaveProperty('maxJobAgeHours');
        expect(stats).toHaveProperty('maxWorkers');
        expect(stats).toHaveProperty('pollingIntervalMs');
        
        expect(typeof stats.total).toBe('number');
        expect(typeof stats.maxStoredJobs).toBe('number');
        expect(stats.maxStoredJobs).toBeGreaterThan(0);
      });

      it('should reflect job counts correctly', async () => {
        const initialStats = service.getStorageStats();
        expect(initialStats.total).toBe(0);
        
        await service.startParallelProcessing();
        await service.startParallelProcessing();
        
        const updatedStats = service.getStorageStats();
        expect(updatedStats.total).toBe(2);
      });
    });

    describe('cleanupOldJobs', () => {
      it('should not throw when called', () => {
        expect(() => service.cleanupOldJobs()).not.toThrow();
      });

      it('should be callable multiple times', () => {
        expect(() => {
          service.cleanupOldJobs();
          service.cleanupOldJobs();
          service.cleanupOldJobs();
        }).not.toThrow();
      });
    });
  });

  describe('File Operations', () => {
    describe('getReportFile', () => {
      it('should handle file operations', async () => {
        const fs = require('fs');
        fs.existsSync.mockReturnValue(false);
        
        await expect(service.getReportFile('test.csv'))
          .rejects.toThrow();
      });

      it('should validate filename parameter', async () => {
        await expect(service.getReportFile(''))
          .rejects.toThrow();
          
        await expect(service.getReportFile(null as any))
          .rejects.toThrow();
      });
    });
  });

  describe('Worker Status Tracking', () => {
    it('should initialize worker statuses correctly', async () => {
      const jobId = await service.startParallelProcessing();
      const status = service.getJobStatus(jobId);
      
      expect(status?.workers).toBeDefined();
      expect(status?.workers.accounts).toBeDefined();
      expect(status?.workers.yearly).toBeDefined();
      expect(status?.workers.fs).toBeDefined();
      
      // Each worker should have initial status
      Object.values(status?.workers || {}).forEach(worker => {
        expect(worker).toHaveProperty('status');
        expect(worker).toHaveProperty('progress');
        expect(typeof worker.progress).toBe('number');
        expect(worker.progress).toBeGreaterThanOrEqual(0);
        expect(worker.progress).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Configuration Integration', () => {
    it('should use injected configuration', () => {
      const stats = service.getStorageStats();
      
      // Verify configuration values are being used
      expect(stats.maxStoredJobs).toBeGreaterThan(0);
      expect(stats.maxJobAgeHours).toBeGreaterThan(0);
      expect(stats.maxWorkers).toBeGreaterThan(0);
      expect(stats.pollingIntervalMs).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', () => {
      expect(() => service.getJobStatus('')).not.toThrow();
      expect(() => service.getJobStatus(null as any)).not.toThrow();
      expect(() => service.getJobStatus(undefined as any)).not.toThrow();
      
      expect(service.getJobStatus('')).toBeNull();
      expect(service.getJobStatus(null as any)).toBeNull();
      expect(service.getJobStatus(undefined as any)).toBeNull();
    });

    it('should handle edge cases in job operations', async () => {
      // Test with empty string job ID
      const result1 = await service.cancelJob('');
      expect(result1).toBe(false);
      
      // Test with null job ID
      const result2 = await service.cancelJob(null as any);
      expect(result2).toBe(false);
    });
  });
}); 