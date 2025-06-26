import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Ticket } from '../../db/models/Ticket';
import { User } from '../../db/models/User';
import { Company } from '../../db/models/Company';
import { 
  ticketRepositoryProvider, 
  userRepositoryProvider, 
  companyRepositoryProvider 
} from './repository.providers';

@Module({
  imports: [
    SequelizeModule.forFeature([Ticket, User, Company])
  ],
  providers: [
    ticketRepositoryProvider,
    userRepositoryProvider,
    companyRepositoryProvider,
  ],
  exports: [
    ticketRepositoryProvider,
    userRepositoryProvider,
    companyRepositoryProvider,
  ],
})
export class RepositoriesModule {} 