import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { performance } from 'perf_hooks';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import reportsConfig from '../config/reports.config';

export interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  workers: {
    accounts: WorkerStatus;
    yearly: WorkerStatus;
    fs: WorkerStatus;
  };
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface WorkerStatus {
  status: 'idle' | 'starting' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  duration?: number;
  error?: string;
  memoryUsage?: NodeJS.MemoryUsage;
  filesProcessed?: number;
  totalFiles?: number;
}

@Injectable()
export class AdvancedReportsService {
  private jobs = new Map<string, JobStatus>();
  private activeWorkers = new Map<string, Worker>();
  private readonly maxWorkers: number;
  private readonly maxStoredJobs: number;
  private readonly maxJobAge: number; // in milliseconds

  constructor(
    @Inject(reportsConfig.KEY)
    private config: ConfigType<typeof reportsConfig>,
  ) {
    this.maxWorkers = Math.min(os.cpus().length, this.config.maxWorkers);
    this.maxStoredJobs = this.config.maxStoredJobs;
    this.maxJobAge = this.config.maxJobAgeHours * 60 * 60 * 1000; // convert hours to milliseconds
  }

  async startParallelProcessing(): Promise<string> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job status
    const job: JobStatus = {
      id: jobId,
      status: 'pending',
      startTime: new Date(),
      workers: {
        accounts: { status: 'idle', progress: 0 },
        yearly: { status: 'idle', progress: 0 },
        fs: { status: 'idle', progress: 0 }
      }
    };
    
    this.jobs.set(jobId, job);
    
    // Clean up old jobs before starting new one
    this.cleanupJobs();
    
    // Start processing in background
    setImmediate(() => {
      this.processInParallel(jobId).catch(error => {
        console.error(`Job ${jobId} failed:`, error);
        job.status = 'failed';
        job.error = error.message;
        job.endTime = new Date();
      });
    });
    
    return jobId;
  }

  private async processInParallel(jobId: string) {
    const job = this.jobs.get(jobId)!;
    job.status = 'processing';

    console.log(`🚀 Starting parallel processing for job ${jobId}`);

    const workerPromises = [
      this.createWorker(jobId, 'accounts'),
      this.createWorker(jobId, 'yearly'),
      this.createWorker(jobId, 'fs')
    ];

    try {
      // Wait for all workers to complete
      await Promise.all(workerPromises);
      
      job.status = 'completed';
      job.endTime = new Date();
      
      console.log(`✅ Job ${jobId} completed successfully`);
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();
      
      console.error(`❌ Job ${jobId} failed:`, error.message);
    }
  }

  private async createWorker(jobId: string, reportType: string): Promise<void> {
    const job = this.jobs.get(jobId)!;
    const workerStatus = job.workers[reportType];
    
    workerStatus.status = 'starting';

    return new Promise((resolve, reject) => {
      console.log(`🧵 Creating worker for ${reportType} report`);
      
      // Create worker thread with current file as worker script
      const worker = new Worker(__filename, {
        workerData: { 
          reportType,
          jobId,
          tmpDir: path.resolve('tmp'),
          outputDir: path.resolve('out')
        }
      });

      // Store worker reference for potential cancellation
      const workerKey = `${jobId}_${reportType}`;
      this.activeWorkers.set(workerKey, worker);

      // Handle worker messages
      worker.on('message', (message) => {
        this.handleWorkerMessage(jobId, reportType, message);
      });

      // Handle worker completion
      worker.on('exit', (code) => {
        this.activeWorkers.delete(workerKey);
        
        if (code === 0) {
          workerStatus.status = 'completed';
          console.log(`✅ Worker ${reportType} completed successfully`);
          resolve();
        } else {
          workerStatus.status = 'failed';
          workerStatus.error = `Worker exited with code ${code}`;
          console.error(`❌ Worker ${reportType} exited with code ${code}`);
          reject(new Error(`Worker exited with code ${code}`));
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        this.activeWorkers.delete(workerKey);
        workerStatus.status = 'failed';
        workerStatus.error = error.message;
        console.error(`❌ Worker ${reportType} error:`, error.message);
        reject(error);
      });
    });
  }

  private handleWorkerMessage(jobId: string, reportType: string, message: any) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const workerStatus = job.workers[reportType];

    switch (message.type) {
      case 'progress':
        workerStatus.status = 'processing';
        workerStatus.progress = message.progress;
        workerStatus.filesProcessed = message.filesProcessed;
        workerStatus.totalFiles = message.totalFiles;
        console.log(`📊 ${reportType}: ${message.progress}% (${message.filesProcessed}/${message.totalFiles} files)`);
        break;
        
      case 'completed':
        workerStatus.status = 'completed';
        workerStatus.progress = 100;
        workerStatus.duration = message.duration;
        workerStatus.memoryUsage = message.memoryUsage;
        console.log(`✅ ${reportType} completed in ${message.duration.toFixed(2)}s`);
        break;
        
      case 'error':
        workerStatus.status = 'failed';
        workerStatus.error = message.error;
        console.error(`❌ ${reportType} error:`, message.error);
        break;
    }
  }

  getJobStatus(jobId: string): JobStatus | null {
    return this.jobs.get(jobId) || null;
  }

  getAllJobs(): JobStatus[] {
    return Array.from(this.jobs.values());
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    // Cancel all workers for this job
    const reportTypes = ['accounts', 'yearly', 'fs'];
    for (const reportType of reportTypes) {
      const workerKey = `${jobId}_${reportType}`;
      const worker = this.activeWorkers.get(workerKey);
      if (worker) {
        await worker.terminate();
        this.activeWorkers.delete(workerKey);
        job.workers[reportType].status = 'cancelled';
      }
    }

    job.status = 'cancelled';
    job.endTime = new Date();
    
    console.log(`🛑 Job ${jobId} cancelled`);
    return true;
  }

  async getReportFile(filename: string): Promise<any> {
    const filePath = path.join('out', filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Report file not found');
    }
    
    return {
      filename,
      path: filePath,
      size: fs.statSync(filePath).size,
      lastModified: fs.statSync(filePath).mtime
    };
  }

  // Enhanced cleanup with configurable limits
  private cleanupJobs() {
    const now = Date.now();
    const completedJobs: Array<[string, JobStatus]> = [];
    
    // Separate completed/failed jobs from active ones
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        completedJobs.push([jobId, job]);
      }
    }
    
    // Sort completed jobs by end time (newest first)
    completedJobs.sort((a, b) => {
      const timeA = a[1].endTime?.getTime() || 0;
      const timeB = b[1].endTime?.getTime() || 0;
      return timeB - timeA;
    });
    
    let deletedCount = 0;
    
    // Remove jobs that exceed the maximum count limit
    if (completedJobs.length > this.maxStoredJobs) {
      const jobsToDelete = completedJobs.slice(this.maxStoredJobs);
      for (const [jobId] of jobsToDelete) {
        this.jobs.delete(jobId);
        deletedCount++;
        console.log(`🧹 Deleted job ${jobId} (exceeded max count: ${this.maxStoredJobs})`);
      }
    }
    
    // Remove jobs that exceed the maximum age limit
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        const jobAge = now - job.startTime.getTime();
        if (jobAge > this.maxJobAge) {
          this.jobs.delete(jobId);
          deletedCount++;
          console.log(`🧹 Deleted job ${jobId} (exceeded max age: ${this.maxJobAge / (60 * 60 * 1000)} hours)`);
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleanup completed: ${deletedCount} jobs deleted, ${this.jobs.size} jobs remaining`);
    }
  }
  
  // Public method for manual cleanup (optional)
  cleanupOldJobs() {
    this.cleanupJobs();
  }
  
  // Get storage statistics
  getStorageStats() {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      maxStoredJobs: this.maxStoredJobs,
      maxJobAgeHours: this.config.maxJobAgeHours,
      maxWorkers: this.maxWorkers,
      pollingIntervalMs: this.config.pollingIntervalMs
    };
    
    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }
    
    return stats;
  }
}

// Worker Thread Code (executed when !isMainThread)
if (!isMainThread) {
  const { reportType, jobId, tmpDir, outputDir } = workerData;
  
  console.log(`🧵 Worker started for ${reportType} in job ${jobId}`);

  async function processReport() {
    const startTime = performance.now();
    
    try {
      // Send initial progress
      parentPort?.postMessage({
        type: 'progress',
        progress: 0,
        message: `Starting ${reportType} processing`,
        filesProcessed: 0,
        totalFiles: 0
      });

      // Get list of CSV files
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.csv'));
      const totalFiles = files.length;

      // Process based on report type
      switch (reportType) {
        case 'accounts':
          await processAccounts(tmpDir, outputDir, files, totalFiles);
          break;
        case 'yearly':
          await processYearly(tmpDir, outputDir, files, totalFiles);
          break;
        case 'fs':
          await processFinancialStatements(tmpDir, outputDir, files, totalFiles);
          break;
      }

      const duration = (performance.now() - startTime) / 1000;
      
      // Send completion message
      parentPort?.postMessage({
        type: 'completed',
        duration,
        memoryUsage: process.memoryUsage()
      });

      console.log(`✅ Worker ${reportType} completed in ${duration.toFixed(2)}s`);

    } catch (error) {
      console.error(`❌ Worker ${reportType} error:`, error.message);
      parentPort?.postMessage({
        type: 'error',
        error: error.message
      });
      process.exit(1);
    }
  }

  // Worker processing functions
  async function processAccounts(tmpDir: string, outputDir: string, files: string[], totalFiles: number) {
    const accountBalances: Record<string, number> = {};
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(tmpDir, file);
      
      // Report progress
      const progress = Math.round((i / files.length) * 100);
      parentPort?.postMessage({
        type: 'progress',
        progress,
        filesProcessed: i + 1,
        totalFiles,
        message: `Processing accounts: ${file}`
      });

      // Process file with streaming for memory efficiency
      await processFileInChunks(filePath, (line) => {
        const [, account, , debit, credit] = line.split(',');
        if (!accountBalances[account]) {
          accountBalances[account] = 0;
        }
        accountBalances[account] += 
          parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
      });
    }

    // Write output
    const output = ['Account,Balance'];
    for (const [account, balance] of Object.entries(accountBalances)) {
      output.push(`${account},${balance.toFixed(2)}`);
    }
    
    await fs.promises.writeFile(
      path.join(outputDir, 'accounts.csv'), 
      output.join('\n')
    );
  }

  async function processYearly(tmpDir: string, outputDir: string, files: string[], totalFiles: number) {
    const cashByYear: Record<string, number> = {};
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(tmpDir, file);
      
      const progress = Math.round((i / files.length) * 100);
      parentPort?.postMessage({
        type: 'progress',
        progress,
        filesProcessed: i + 1,
        totalFiles,
        message: `Processing yearly data: ${file}`
      });

      await processFileInChunks(filePath, (line) => {
        const [date, account, , debit, credit] = line.split(',');
        if (account === 'Cash') {
          const year = new Date(date).getFullYear();
          if (!cashByYear[year]) {
            cashByYear[year] = 0;
          }
          cashByYear[year] += 
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      });
    }

    const output = ['Financial Year,Cash Balance'];
    Object.keys(cashByYear)
      .sort()
      .forEach((year) => {
        output.push(`${year},${cashByYear[year].toFixed(2)}`);
      });
      
    await fs.promises.writeFile(
      path.join(outputDir, 'yearly.csv'), 
      output.join('\n')
    );
  }

  async function processFinancialStatements(tmpDir: string, outputDir: string, files: string[], totalFiles: number) {
    const categories = {
      'Income Statement': {
        Revenues: ['Sales Revenue'],
        Expenses: [
          'Cost of Goods Sold',
          'Salaries Expense',
          'Rent Expense',
          'Utilities Expense',
          'Interest Expense',
          'Tax Expense',
        ],
      },
      'Balance Sheet': {
        Assets: [
          'Cash',
          'Accounts Receivable',
          'Inventory',
          'Fixed Assets',
          'Prepaid Expenses',
        ],
        Liabilities: [
          'Accounts Payable',
          'Loan Payable',
          'Sales Tax Payable',
          'Accrued Liabilities',
          'Unearned Revenue',
          'Dividends Payable',
        ],
        Equity: ['Common Stock', 'Retained Earnings'],
      },
    };

    const balances: Record<string, number> = {};
    for (const section of Object.values(categories)) {
      for (const group of Object.values(section)) {
        for (const account of group) {
          balances[account] = 0;
        }
      }
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(tmpDir, file);
      
      const progress = Math.round((i / files.length) * 100);
      parentPort?.postMessage({
        type: 'progress',
        progress,
        filesProcessed: i + 1,
        totalFiles,
        message: `Processing financial statements: ${file}`
      });

      await processFileInChunks(filePath, (line) => {
        const [, account, , debit, credit] = line.split(',');
        if (balances.hasOwnProperty(account)) {
          balances[account] +=
            parseFloat(String(debit || 0)) - parseFloat(String(credit || 0));
        }
      });
    }

    // Generate financial statement output (same as original logic)
    const output: string[] = [];
    output.push('Basic Financial Statement');
    output.push('');
    output.push('Income Statement');
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    for (const account of categories['Income Statement']['Revenues']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalRevenue += value;
    }
    
    for (const account of categories['Income Statement']['Expenses']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalExpenses += value;
    }
    
    output.push(`Net Income,${(totalRevenue - totalExpenses).toFixed(2)}`);
    output.push('');
    output.push('Balance Sheet');
    
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    
    output.push('Assets');
    for (const account of categories['Balance Sheet']['Assets']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalAssets += value;
    }
    output.push(`Total Assets,${totalAssets.toFixed(2)}`);
    output.push('');
    
    output.push('Liabilities');
    for (const account of categories['Balance Sheet']['Liabilities']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalLiabilities += value;
    }
    output.push(`Total Liabilities,${totalLiabilities.toFixed(2)}`);
    output.push('');
    
    output.push('Equity');
    for (const account of categories['Balance Sheet']['Equity']) {
      const value = balances[account] || 0;
      output.push(`${account},${value.toFixed(2)}`);
      totalEquity += value;
    }
    output.push(
      `Retained Earnings (Net Income),${(totalRevenue - totalExpenses).toFixed(2)}`,
    );
    totalEquity += totalRevenue - totalExpenses;
    output.push(`Total Equity,${totalEquity.toFixed(2)}`);
    output.push('');
    output.push(
      `Assets = Liabilities + Equity, ${totalAssets.toFixed(2)} = ${(totalLiabilities + totalEquity).toFixed(2)}`,
    );
    
    await fs.promises.writeFile(
      path.join(outputDir, 'fs.csv'), 
      output.join('\n')
    );
  }

  async function processFileInChunks(filePath: string, lineProcessor: (line: string) => void) {
    return new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath, { encoding: 'utf8' });
      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        if (line.trim()) {
          lineProcessor(line);
        }
      });
      
      rl.on('close', () => {
        resolve();
      });
      
      rl.on('error', (error) => {
        reject(error);
      });
    });
  }

  // Start processing
  processReport();
} 