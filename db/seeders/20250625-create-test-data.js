'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create test companies
    const companies = await queryInterface.bulkInsert('companies', [
      {
        name: 'Acme Corp',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Tech Solutions Ltd',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Global Industries',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Innovation Hub',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Business Ventures',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], { returning: true });

    console.log('✅ Created 5 test companies');

    // Get the company IDs (for PostgreSQL, we need to query them)
    const companyRecords = await queryInterface.sequelize.query(
      'SELECT id, name FROM companies ORDER BY id DESC LIMIT 5',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Create test users with different roles for each company
    const users = [];
    const roles = ['accountant', 'corporateSecretary', 'director'];
    
    for (const company of companyRecords) {
      for (const role of roles) {
        users.push({
          name: `${role} for ${company.name}`,
          role: role,
          companyId: company.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    await queryInterface.bulkInsert('users', users);
    console.log(`✅ Created ${users.length} test users (${roles.length} per company)`);

    // Display summary
    console.log('\n📊 Test Data Seeding Summary:');
    console.log(`Companies: ${companyRecords.length}`);
    console.log(`Users: ${users.length}`);
    console.log('  - Accountants: ' + users.filter(u => u.role === 'accountant').length);
    console.log('  - Corporate Secretaries: ' + users.filter(u => u.role === 'corporateSecretary').length);
    console.log('  - Directors: ' + users.filter(u => u.role === 'director').length);
    console.log('\n✅ Test data seeded successfully!');
    console.log('You can now test the ticket endpoints with company IDs: ' + companyRecords.map(c => c.id).join(', '));
  },

  async down(queryInterface, Sequelize) {
    // Get the test company IDs first
    const testCompanies = await queryInterface.sequelize.query(
      `SELECT id FROM companies WHERE name IN (
        'Acme Corp', 'Tech Solutions Ltd', 'Global Industries', 
        'Innovation Hub', 'Business Ventures'
      )`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const companyIds = testCompanies.map(c => c.id);

    if (companyIds.length > 0) {
      // Remove tickets first (due to foreign key constraints)
      await queryInterface.bulkDelete('tickets', {
        companyId: {
          [Sequelize.Op.in]: companyIds
        }
      });

      // Remove test users (due to foreign key constraints)
      await queryInterface.bulkDelete('users', {
        companyId: {
          [Sequelize.Op.in]: companyIds
        }
      });

      // Remove test companies
      await queryInterface.bulkDelete('companies', {
        id: {
          [Sequelize.Op.in]: companyIds
        }
      });

      console.log('✅ Test data removed successfully');
      console.log(`   Removed companies: ${companyIds.length}`);
      console.log(`   Removed associated users and tickets`);
    } else {
      console.log('ℹ️  No test data found to remove');
    }
  }
}; 