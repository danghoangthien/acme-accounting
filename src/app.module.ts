import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db.module';
import { TicketsController } from './tickets/tickets.controller';
import { AdvancedTicketsController } from './tickets/advanced-tickets.controller';
import { ReportsController } from './reports/reports.controller';
import { AdvancedReportsController } from './reports/advanced-reports.controller';
import { HealthcheckController } from './healthcheck/healthcheck.controller';
import { ReportsService } from './reports/reports.service';
import { AdvancedReportsService } from './reports/advanced-reports.service';
import { AdvancedTicketsService } from './tickets/advanced-tickets.service';
import reportsConfig from './config/reports.config';
import { RepositoriesModule } from './repositories/repositories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [reportsConfig],
    }),
    DbModule,
    RepositoriesModule,
  ],
  controllers: [TicketsController, AdvancedTicketsController, ReportsController, AdvancedReportsController, HealthcheckController],
  providers: [
    ReportsService, 
    AdvancedReportsService, 
    AdvancedTicketsService,
  ],
})
export class AppModule {}
