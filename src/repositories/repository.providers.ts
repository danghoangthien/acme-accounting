import { Provider } from '@nestjs/common';
import { ITicketRepository } from './interfaces/ticket.repository.interface';
import { IUserRepository } from './interfaces/user.repository.interface';
import { ICompanyRepository } from './interfaces/company.repository.interface';
import { TicketRepository } from './sequelize/ticket.repository';
import { UserRepository } from './sequelize/user.repository';
import { CompanyRepository } from './sequelize/company.repository';

export const ticketRepositoryProvider: Provider = {
  provide: ITicketRepository,
  useClass: TicketRepository,
};

export const userRepositoryProvider: Provider = {
  provide: IUserRepository,
  useClass: UserRepository,
};

export const companyRepositoryProvider: Provider = {
  provide: ICompanyRepository,
  useClass: CompanyRepository,
}; 