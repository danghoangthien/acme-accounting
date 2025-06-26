const fs = require('fs');

class AdvancedPerformanceTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.results = [];
    this.fetch = null;
  }

  async init() {
    // Dynamic import for node-fetch v3+
    const { default: fetch } = await import('node-fetch');
    this.fetch = fetch;
  }

  async testAdvancedEndpoints() {
    console.log('🚀 Starting Advanced Performance Test (Worker Threads)');
    console.log('='.repeat(60));

    // Initialize fetch
    await this.init();

    // Test 1: Check if server is running
    await this.testHealthCheck();

    // Test 2: Test advanced reports endpoints (Worker Threads)
    await this.testReportsEndpoints();

    this.generateReport();
  }

  async testHealthCheck() {
    console.log('\n📋 Testing Health Check...');
    
    try {
      const start = performance.now();
      const response = await this.fetch(`${this.baseUrl}/healthcheck`);
      const duration = performance.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Health Check: ${duration.toFixed(2)}ms`);
        console.log(`   Response:`, data);
      } else {
        console.log(`❌ Health Check failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Health Check error: ${error.message}`);
      console.log('   Make sure the server is running on http://localhost:3000');
      process.exit(1);
    }
  }

  async testReportsEndpoints() {
    // Test 1: Generate reports with worker threads
    await this.testAdvancedReportGeneration();

    // Test 2: Test polling mechanism
    await this.testPollingMechanism();

    // Test 3: Test concurrent requests
    await this.testConcurrentRequests();
  }

  async testAdvancedReportGeneration() {
    console.log('\n⏱️  Testing POST /api/v1/advanced-reports (Worker Threads)...');
    console.log('   This uses parallel processing with worker threads');
    console.log('   Expected: Immediate 202 response + background processing');
    
    const startTime = Date.now();
    const startPerf = performance.now();

    try {
      // Step 1: Start generation (should be immediate)
      const response = await this.fetch(`${this.baseUrl}/api/v1/advanced-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const responseTime = performance.now() - startPerf;

      if (response.status === 202) {
        const data = await response.json();
        console.log(`✅ Immediate Response: ${responseTime.toFixed(2)}ms`);
        console.log(`   Job ID: ${data.jobId}`);
        console.log(`   Status URL: ${data.statusUrl}`);
        
        // Step 2: Poll for completion
        const processingTime = await this.pollForCompletion(data.jobId);
        
        // Record total processing time (this is the main metric)
        this.results.push({
          test: 'Advanced Report Generation',
          duration: processingTime,
          status: 'success',
          timestamp: new Date().toISOString()
        });

        // Check generated files
        await this.checkGeneratedFiles();

      } else {
        console.log(`❌ Advanced Report Generation failed: ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
        
        this.results.push({
          test: 'Advanced Report Generation',
          status: 'failed',
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.log(`\n❌ Advanced Report Generation error: ${error.message}`);
      
      this.results.push({
        test: 'Advanced Report Generation',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async pollForCompletion(jobId) {
    console.log('\n🔄 Polling for completion...');
    const startTime = Date.now();
    let pollCount = 0;
    
    while (true) {
      pollCount++;
      
      try {
        const response = await this.fetch(`${this.baseUrl}/api/v1/advanced-reports/status/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }
        
        const status = await response.json();
        const elapsed = (Date.now() - startTime) / 1000;
        
        console.log(`   Poll ${pollCount}: ${status.status} - ${status.overallProgress}% (${elapsed.toFixed(1)}s)`);
        
        // Show worker progress
        if (status.workers) {
          Object.entries(status.workers).forEach(([worker, info]) => {
            console.log(`     ${worker}: ${info.progress}% (${info.status})`);
          });
        }
        
        switch (status.status) {
          case 'completed':
            console.log(`✅ Processing completed in ${elapsed.toFixed(2)} seconds`);
            console.log(`   Total polls: ${pollCount}`);
            console.log(`   Results available at:`, status.results);
            return elapsed;
            
          case 'failed':
            console.error(`❌ Processing failed: ${status.error}`);
            throw new Error(status.error);
            
          case 'processing':
          case 'pending':
            // Continue polling
            await this.sleep(1000); // Poll every second
            break;
            
          default:
            throw new Error(`Unknown status: ${status.status}`);
        }
        
      } catch (error) {
        console.error(`❌ Polling error: ${error.message}`);
        throw error;
      }
    }
  }

  async checkGeneratedFiles() {
    console.log('\n📁 Checking Generated Files...');
    
    const files = ['accounts.csv', 'yearly.csv', 'fs.csv'];
    
    for (const file of files) {
      try {
        const response = await this.fetch(`${this.baseUrl}/api/v1/advanced-reports/download/${file}`);
        if (response.ok) {
          const contentLength = response.headers.get('content-length');
          if (contentLength) {
            console.log(`   ✅ ${file}: ${(parseInt(contentLength) / 1024).toFixed(2)} KB`);
          } else {
            console.log(`   ✅ ${file}: Available for download`);
          }
        } else {
          console.log(`   ❌ ${file}: Not available (${response.status})`);
        }
      } catch (error) {
        console.log(`   ❌ ${file}: Error checking file`);
      }
    }
  }

  async testPollingMechanism() {
    console.log('\n🔍 Testing Polling Mechanism...');
    
    try {
      // Start a job
      const response = await this.fetch(`${this.baseUrl}/api/v1/advanced-reports`, {
        method: 'POST'
      });
      
      if (response.status === 202) {
        const data = await response.json();
        
        // Test status endpoint multiple times
        for (let i = 0; i < 3; i++) {
          const statusResponse = await this.fetch(`${this.baseUrl}/api/v1/advanced-reports/status/${data.jobId}`);
          const statusData = await statusResponse.json();
          
          console.log(`   Status check ${i + 1}: ${statusData.status} - ${statusData.overallProgress}%`);
          await this.sleep(500);
        }
        
        console.log('✅ Polling mechanism working correctly');
      }
      
    } catch (error) {
      console.log(`❌ Polling test failed: ${error.message}`);
    }
  }

  async testConcurrentRequests() {
    console.log('\n🔄 Testing Concurrent Requests (3 parallel jobs)...');
    
    try {
      const promises = [
        this.startJob('Job 1'),
        this.startJob('Job 2'),
        this.startJob('Job 3')
      ];

      const results = await Promise.all(promises);
      
      console.log('✅ Concurrent requests completed');
      results.forEach((result, index) => {
        console.log(`   Job ${index + 1}: ${result.responseTime.toFixed(2)}ms response`);
      });
      
    } catch (error) {
      console.log('❌ Concurrent requests failed:', error.message);
    }
  }

  async startJob(jobName) {
    const start = performance.now();
    const response = await this.fetch(`${this.baseUrl}/api/v1/advanced-reports`, {
      method: 'POST'
    });
    const responseTime = performance.now() - start;
    
    const data = await response.json();
    
    return {
      jobName,
      jobId: data.jobId,
      responseTime,
      status: response.status
    };
  }







  generateReport() {
    console.log('\n📈 Advanced Performance Test Results');
    console.log('='.repeat(60));
    
    this.results.forEach(result => {
      console.log(`Test: ${result.test}`);
      console.log(`Status: ${result.status}`);
      if (result.duration) {
        console.log(`Duration: ${result.duration.toFixed(2)} seconds`);
      }
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      console.log(`Timestamp: ${result.timestamp}`);
      console.log('-'.repeat(40));
    });

    // Save results to file
    const reportData = {
      testSuite: 'Advanced Reports API Performance Test (Worker Threads)',
      timestamp: new Date().toISOString(),
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    fs.writeFileSync('advanced-performance-results.json', JSON.stringify(reportData, null, 2));
    console.log('\n💾 Results saved to: advanced-performance-results.json');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Memory monitoring
function monitorMemory() {
  const usage = process.memoryUsage();
  console.log('\n🧠 Memory Usage:');
  console.log(`   RSS: ${(usage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   External: ${(usage.external / 1024 / 1024).toFixed(2)} MB`);
}

// Run the test
async function main() {
  console.log('🔧 Advanced Reports Performance Testing Tool (Worker Threads)');
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  
  monitorMemory();
  
  const tester = new AdvancedPerformanceTester();
  await tester.testAdvancedEndpoints();
  
  monitorMemory();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Test interrupted by user');
  process.exit(0);
});

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { AdvancedPerformanceTester }; 