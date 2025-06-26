import { Controller, Get, Post, HttpCode, Param, NotFoundException } from '@nestjs/common';
import { AdvancedReportsService, JobStatus, WorkerStatus } from './advanced-reports.service';

@Controller('api/v1/advanced-reports')
export class AdvancedReportsController {
  constructor(private advancedReportsService: AdvancedReportsService) {}

  @Post()
  @HttpCode(202) // 202 Accepted - Processing started
  async generate() {
    const jobId = await this.advancedReportsService.startParallelProcessing();
    
    return {
      message: 'Advanced report generation started with worker threads',
      jobId,
      statusUrl: `/api/v1/advanced-reports/status/${jobId}`,
      workers: ['accounts', 'yearly', 'fs'],
      estimatedDuration: '1 minute' // Faster due to parallelization
    };
  }

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string): Promise<any> {
    const status = this.advancedReportsService.getJobStatus(jobId);
    
    if (!status) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    
    return {
      jobId,
      status: status.status,
      overallProgress: this.calculateOverallProgress(status),
      workers: status.workers,
      startTime: status.startTime,
      endTime: status.endTime,
      duration: status.endTime ? 
        status.endTime.getTime() - status.startTime.getTime() : 
        Date.now() - status.startTime.getTime(),
      results: status.status === 'completed' ? {
        'accounts.csv': `/api/v1/advanced-reports/download/accounts.csv`,
        'yearly.csv': `/api/v1/advanced-reports/download/yearly.csv`,
        'fs.csv': `/api/v1/advanced-reports/download/fs.csv`
      } : null,
      error: status.error
    };
  }

  @Get('download/:filename')
  async downloadReport(@Param('filename') filename: string) {
    const validFiles = ['accounts.csv', 'yearly.csv', 'fs.csv'];
    
    if (!validFiles.includes(filename)) {
      throw new NotFoundException('File not found');
    }
    
    return this.advancedReportsService.getReportFile(filename);
  }

  @Get('jobs')
  async getAllJobs(): Promise<JobStatus[]> {
    return this.advancedReportsService.getAllJobs();
  }

  @Post('cancel/:jobId')
  @HttpCode(200)
  async cancelJob(@Param('jobId') jobId: string) {
    const success = await this.advancedReportsService.cancelJob(jobId);
    
    if (!success) {
      throw new NotFoundException(`Job ${jobId} not found or cannot be cancelled`);
    }
    
    return {
      message: `Job ${jobId} cancelled successfully`
    };
  }

  private calculateOverallProgress(status: any): number {
    const workers = status.workers as Record<string, WorkerStatus>;
    const totalProgress = Object.values(workers)
      .reduce((sum: number, worker: WorkerStatus) => sum + worker.progress, 0);
    return Math.round(totalProgress / 3);
  }
} 