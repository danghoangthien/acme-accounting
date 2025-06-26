import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdvancedReportsController } from './advanced-reports.controller';
import { AdvancedReportsService, JobStatus, WorkerStatus } from './advanced-reports.service';

describe('AdvancedReportsController', () => {
  let controller: AdvancedReportsController;
  let service: jest.Mocked<AdvancedReportsService>;

  const mockJobStatus: JobStatus = {
    id: 'test-job-123',
    status: 'processing',
    workers: {
      accounts: { status: 'processing', progress: 50 },
      yearly: { status: 'completed', progress: 100 },
      fs: { status: 'idle', progress: 0 }
    },
    startTime: new Date('2025-01-01T10:00:00Z'),
    endTime: undefined,
    error: undefined
  };

  const mockCompletedJobStatus: JobStatus = {
    id: 'completed-job-456',
    status: 'completed',
    workers: {
      accounts: { status: 'completed', progress: 100 },
      yearly: { status: 'completed', progress: 100 },
      fs: { status: 'completed', progress: 100 }
    },
    startTime: new Date('2025-01-01T10:00:00Z'),
    endTime: new Date('2025-01-01T10:02:00Z')
  };

  beforeEach(async () => {
    const mockService = {
      startParallelProcessing: jest.fn(),
      getJobStatus: jest.fn(),
      getReportFile: jest.fn(),
      getAllJobs: jest.fn(),
      cancelJob: jest.fn(),
      getStorageStats: jest.fn(),
      cleanupOldJobs: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvancedReportsController],
      providers: [
        {
          provide: AdvancedReportsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdvancedReportsController>(AdvancedReportsController);
    service = module.get(AdvancedReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('POST /api/v1/advanced-reports', () => {
    describe('generate', () => {
      it('should start report generation and return job details', async () => {
        const jobId = 'job_1234567890_abcdef123';
        service.startParallelProcessing.mockResolvedValue(jobId);

        const result = await controller.generate();

        expect(service.startParallelProcessing).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          message: 'Advanced report generation started with worker threads',
          jobId,
          statusUrl: `/api/v1/advanced-reports/status/${jobId}`,
          workers: ['accounts', 'yearly', 'fs'],
          estimatedDuration: '1 minute'
        });
      });

      it('should handle service errors', async () => {
        service.startParallelProcessing.mockRejectedValue(new Error('Service error'));

        await expect(controller.generate()).rejects.toThrow('Service error');
        expect(service.startParallelProcessing).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('GET /api/v1/advanced-reports/status/:jobId', () => {
    describe('getStatus', () => {
      it('should return job status for existing job', async () => {
        const jobId = 'test-job-123';
        service.getJobStatus.mockReturnValue(mockJobStatus);

        const result = await controller.getStatus(jobId);

        expect(service.getJobStatus).toHaveBeenCalledWith(jobId);
        expect(result).toEqual({
          jobId,
          status: 'processing',
          overallProgress: 50, // (50 + 100 + 0) / 3 = 50
          workers: mockJobStatus.workers,
          startTime: mockJobStatus.startTime,
          endTime: undefined,
          duration: expect.any(Number),
          results: null,
          error: undefined
        });
      });

      it('should return completed job with download links', async () => {
        const jobId = 'completed-job-456';
        service.getJobStatus.mockReturnValue(mockCompletedJobStatus);

        const result = await controller.getStatus(jobId);

        expect(service.getJobStatus).toHaveBeenCalledWith(jobId);
        expect(result).toEqual({
          jobId,
          status: 'completed',
          overallProgress: 100,
          workers: mockCompletedJobStatus.workers,
          startTime: mockCompletedJobStatus.startTime,
          endTime: mockCompletedJobStatus.endTime,
          duration: 120000, // 2 minutes in milliseconds
          results: {
            'accounts.csv': '/api/v1/advanced-reports/download/accounts.csv',
            'yearly.csv': '/api/v1/advanced-reports/download/yearly.csv',
            'fs.csv': '/api/v1/advanced-reports/download/fs.csv'
          },
          error: undefined
        });
      });

      it('should throw NotFoundException for non-existent job', async () => {
        const jobId = 'non-existent-job';
        service.getJobStatus.mockReturnValue(null);

        await expect(controller.getStatus(jobId)).rejects.toThrow(
          new NotFoundException(`Job ${jobId} not found`)
        );
        expect(service.getJobStatus).toHaveBeenCalledWith(jobId);
      });

      it('should handle job with error status', async () => {
        const failedJobStatus: JobStatus = {
          ...mockJobStatus,
          status: 'failed',
          error: 'Worker thread crashed'
        };
        service.getJobStatus.mockReturnValue(failedJobStatus);

        const result = await controller.getStatus('failed-job');

        expect(result.status).toBe('failed');
        expect(result.error).toBe('Worker thread crashed');
        expect(result.results).toBeNull();
      });
    });
  });

  describe('GET /api/v1/advanced-reports/download/:filename', () => {
    describe('downloadReport', () => {
      it('should download valid report file', async () => {
        const filename = 'accounts.csv';
        const mockFileData = 'Account,Amount\nCash,1000\nBank,2000';
        service.getReportFile.mockResolvedValue(mockFileData);

        const result = await controller.downloadReport(filename);

        expect(service.getReportFile).toHaveBeenCalledWith(filename);
        expect(result).toBe(mockFileData);
      });

      it('should download yearly report file', async () => {
        const filename = 'yearly.csv';
        const mockFileData = 'Year,Revenue\n2024,100000\n2023,90000';
        service.getReportFile.mockResolvedValue(mockFileData);

        const result = await controller.downloadReport(filename);

        expect(service.getReportFile).toHaveBeenCalledWith(filename);
        expect(result).toBe(mockFileData);
      });

      it('should download financial statements file', async () => {
        const filename = 'fs.csv';
        const mockFileData = 'Statement,Amount\nBalance Sheet,50000';
        service.getReportFile.mockResolvedValue(mockFileData);

        const result = await controller.downloadReport(filename);

        expect(service.getReportFile).toHaveBeenCalledWith(filename);
        expect(result).toBe(mockFileData);
      });

      it('should throw NotFoundException for invalid filename', async () => {
        const filename = 'invalid-file.csv';

        await expect(controller.downloadReport(filename)).rejects.toThrow(
          new NotFoundException('File not found')
        );
        expect(service.getReportFile).not.toHaveBeenCalled();
      });

      it('should handle service errors during file retrieval', async () => {
        const filename = 'accounts.csv';
        service.getReportFile.mockRejectedValue(new Error('File read error'));

        await expect(controller.downloadReport(filename)).rejects.toThrow('File read error');
        expect(service.getReportFile).toHaveBeenCalledWith(filename);
      });
    });
  });

  describe('GET /api/v1/advanced-reports/jobs', () => {
    describe('getAllJobs', () => {
      it('should return all jobs', async () => {
        const mockJobs = [mockJobStatus, mockCompletedJobStatus];
        service.getAllJobs.mockReturnValue(mockJobs);

        const result = await controller.getAllJobs();

        expect(service.getAllJobs).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockJobs);
      });

      it('should return empty array when no jobs exist', async () => {
        service.getAllJobs.mockReturnValue([]);

        const result = await controller.getAllJobs();

        expect(service.getAllJobs).toHaveBeenCalledTimes(1);
        expect(result).toEqual([]);
      });
    });
  });

  describe('POST /api/v1/advanced-reports/cancel/:jobId', () => {
    describe('cancelJob', () => {
      it('should cancel existing job successfully', async () => {
        const jobId = 'test-job-123';
        service.cancelJob.mockResolvedValue(true);

        const result = await controller.cancelJob(jobId);

        expect(service.cancelJob).toHaveBeenCalledWith(jobId);
        expect(result).toEqual({
          message: `Job ${jobId} cancelled successfully`
        });
      });

      it('should throw NotFoundException for non-existent job', async () => {
        const jobId = 'non-existent-job';
        service.cancelJob.mockResolvedValue(false);

        await expect(controller.cancelJob(jobId)).rejects.toThrow(
          new NotFoundException(`Job ${jobId} not found or cannot be cancelled`)
        );
        expect(service.cancelJob).toHaveBeenCalledWith(jobId);
      });

      it('should handle service errors during cancellation', async () => {
        const jobId = 'test-job-123';
        service.cancelJob.mockRejectedValue(new Error('Cancellation failed'));

        await expect(controller.cancelJob(jobId)).rejects.toThrow('Cancellation failed');
        expect(service.cancelJob).toHaveBeenCalledWith(jobId);
      });
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate overall progress correctly', async () => {
      const jobWithVariedProgress: JobStatus = {
        id: 'progress-test',
        status: 'processing',
        workers: {
          accounts: { status: 'completed', progress: 100 },
          yearly: { status: 'processing', progress: 50 },
          fs: { status: 'idle', progress: 0 }
        },
        startTime: new Date()
      };

      service.getJobStatus.mockReturnValue(jobWithVariedProgress);

      const result = await controller.getStatus('progress-test');

      // (100 + 50 + 0) / 3 = 50
      expect(result.overallProgress).toBe(50);
    });

    it('should handle edge case with all workers at 0%', async () => {
      const jobWithZeroProgress: JobStatus = {
        id: 'zero-progress',
        status: 'pending',
        workers: {
          accounts: { status: 'idle', progress: 0 },
          yearly: { status: 'idle', progress: 0 },
          fs: { status: 'idle', progress: 0 }
        },
        startTime: new Date()
      };

      service.getJobStatus.mockReturnValue(jobWithZeroProgress);

      const result = await controller.getStatus('zero-progress');

      expect(result.overallProgress).toBe(0);
    });

    it('should handle edge case with all workers at 100%', async () => {
      const jobWithFullProgress: JobStatus = {
        id: 'full-progress',
        status: 'completed',
        workers: {
          accounts: { status: 'completed', progress: 100 },
          yearly: { status: 'completed', progress: 100 },
          fs: { status: 'completed', progress: 100 }
        },
        startTime: new Date(),
        endTime: new Date()
      };

      service.getJobStatus.mockReturnValue(jobWithFullProgress);

      const result = await controller.getStatus('full-progress');

      expect(result.overallProgress).toBe(100);
    });
  });

  describe('Duration Calculation', () => {
    it('should calculate duration for ongoing job', async () => {
      const startTime = new Date(Date.now() - 30000); // 30 seconds ago
      const ongoingJob: JobStatus = {
        id: 'ongoing-job',
        status: 'processing',
        workers: {
          accounts: { status: 'processing', progress: 75 },
          yearly: { status: 'completed', progress: 100 },
          fs: { status: 'processing', progress: 25 }
        },
        startTime
      };

      service.getJobStatus.mockReturnValue(ongoingJob);

      const result = await controller.getStatus('ongoing-job');

      expect(result.duration).toBeGreaterThan(25000); // Should be around 30000ms
      expect(result.duration).toBeLessThan(35000);
    });

    it('should calculate duration for completed job', async () => {
      service.getJobStatus.mockReturnValue(mockCompletedJobStatus);

      const status = await controller.getStatus('completed-job-456');
      
      // Mock shows 2 minute difference
      expect(status.duration).toBe(120000);
    });
  });
}); 