const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

async function createTestData() {
  console.log('🌱 Running database seeder for test data...');
  console.log('This will create companies and users for testing the ticket endpoints.');
  
  try {
    // Run the seeder
    const { stdout, stderr } = await execAsync('npm run seed:test-data');
    
    if (stdout) {
      console.log(stdout);
    }
    
    if (stderr && !stderr.includes('Loaded configuration file')) {
      console.error('Seeder warnings:', stderr);
    }
    
    console.log('\n🎯 To undo the test data, run: npm run db:seed:undo');
    console.log('🎯 To run all seeders, use: npm run db:seed');
    
  } catch (error) {
    console.error('❌ Error running seeder:', error.message);
    console.log('\n💡 Make sure you have:');
    console.log('   1. Database running (Docker)');
    console.log('   2. Migrations applied (npm run migrate)');
    console.log('   3. Sequelize CLI installed');
    process.exit(1);
  }
}

console.log('🔧 Test Data Creation Tool');
console.log('Using Sequelize seeders for proper database management');
console.log('');
console.log('💡 Available commands:');
console.log('   npm run seed:test-data    - Create test data');
console.log('   npm run db:seed:undo      - Remove all seeded data');
console.log('   npm run seed:fresh        - Remove and recreate test data');
console.log('   node create-test-data.js  - Run this script (calls seed:test-data)');
console.log('');

createTestData(); 