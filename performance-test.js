// performance-test.js
const fs = require('fs');

class PerformanceTester {
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

  async testReportsEndpoint() {
    console.log('🚀 Starting Performance Test for Reports API');
    console.log('=' .repeat(60));

    // Initialize fetch
    await this.init();

    // Test 1: Check if server is running
    await this.testHealthCheck();

    // Test 2: Check current status
    await this.testGetReportsStatus();

    // Test 3: Measure report generation time
    await this.testReportGeneration();

    // Test 4: Multiple concurrent requests (if brave!)
    // await this.testConcurrentRequests();

    this.generateReport();
  }

  async testHealthCheck() {
    console.log('\n📋 Testing Health Check...');
    
    try {
      const start = performance.now();
      const response = await this.fetch(`${this.baseUrl}/api/v1/healthcheck`);
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

  async testGetReportsStatus() {
    console.log('\n📊 Testing GET /api/v1/reports (Status Check)...');
    
    try {
      const start = performance.now();
      const response = await this.fetch(`${this.baseUrl}/api/v1/reports`);
      const duration = performance.now() - start;
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Status Check: ${duration.toFixed(2)}ms`);
        console.log(`   Current Status:`, data);
      } else {
        console.log(`❌ Status Check failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Status Check error: ${error.message}`);
    }
  }

  async testReportGeneration() {
    console.log('\n⏱️  Testing POST /api/v1/reports (Report Generation)...');
    console.log('   This will process ~2 million records...');
    console.log('   Expected time: 30-60 seconds');
    
    const startTime = Date.now();
    const startPerf = performance.now();
    
    // Show progress indicator
    const progressInterval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      process.stdout.write(`\r   ⏳ Elapsed: ${elapsed.toFixed(1)}s`);
    }, 1000);

    try {
      const response = await this.fetch(`${this.baseUrl}/api/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      clearInterval(progressInterval);
      const duration = performance.now() - startPerf;
      const durationSeconds = duration / 1000;

      console.log(`\n`);

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Report Generation Completed!`);
        console.log(`   Duration: ${durationSeconds.toFixed(2)} seconds`);
        console.log(`   Response:`, data);
        
        // Record performance metrics
        this.results.push({
          test: 'Report Generation',
          duration: durationSeconds,
          status: 'success',
          timestamp: new Date().toISOString()
        });

        // Check generated files
        await this.checkGeneratedFiles();

      } else {
        console.log(`❌ Report Generation failed: ${response.status}`);
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
        
        this.results.push({
          test: 'Report Generation',
          status: 'failed',
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      clearInterval(progressInterval);
      console.log(`\n❌ Report Generation error: ${error.message}`);
      
      if (error.code === 'ECONNRESET') {
        console.log('   This might be a timeout - the operation is taking too long');
      }
      
      this.results.push({
        test: 'Report Generation',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async checkGeneratedFiles() {
    console.log('\n📁 Checking Generated Files...');
    
    const files = ['accounts.csv', 'yearly.csv', 'fs.csv'];
    
    for (const file of files) {
      const filePath = `out/${file}`;
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`   ✅ ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
        } else {
          console.log(`   ❌ ${file}: Not found`);
        }
      } catch (error) {
        console.log(`   ❌ ${file}: Error checking file`);
      }
    }
  }

  async testConcurrentRequests() {
    console.log('\n🔄 Testing Concurrent Requests (2 requests)...');
    console.log('   WARNING: This will be very slow and resource intensive!');
    
    const promises = [
      this.makeRequest('POST', '/api/v1/reports'),
      this.makeRequest('POST', '/api/v1/reports')
    ];

    try {
      const results = await Promise.all(promises);
      console.log('✅ Concurrent requests completed');
      console.log('   Results:', results.map(r => `${r.duration.toFixed(2)}s`));
    } catch (error) {
      console.log('❌ Concurrent requests failed:', error.message);
    }
  }

  async makeRequest(method, path) {
    const start = performance.now();
    const response = await this.fetch(`${this.baseUrl}${path}`, { method });
    const duration = (performance.now() - start) / 1000;
    
    return {
      status: response.status,
      duration,
      ok: response.ok
    };
  }

  generateReport() {
    console.log('\n📈 Performance Test Results');
    console.log('=' .repeat(60));
    
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
      testSuite: 'Reports API Performance Test',
      timestamp: new Date().toISOString(),
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    fs.writeFileSync('performance-test-results.json', JSON.stringify(reportData, null, 2));
    console.log('\n💾 Results saved to: performance-test-results.json');
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
  console.log('🔧 Node.js Performance Testing Tool');
  console.log(`Node Version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);
  
  monitorMemory();
  
  const tester = new PerformanceTester();
  await tester.testReportsEndpoint();
  
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

module.exports = { PerformanceTester };