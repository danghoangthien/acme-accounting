import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Ticket } from '../../../db/models/Ticket';
import { Company } from '../../../db/models/Company';
import { User } from '../../../db/models/User';
import { ITicketRepository, CreateTicketData } from '../interfaces/ticket.repository.interface';

@Injectable()
export class TicketRepository implements ITicketRepository {
  constructor(
    @InjectModel(Ticket)
    private ticketModel: typeof Ticket,
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async findAll(): Promise<Ticket[]> {
    return await this.ticketModel.findAll({ 
      include: [this.companyModel, this.userModel] 
    });
  }

  async create(data: CreateTicketData): Promise<Ticket> {
    return await this.ticketModel.create(data as any);
  }

  async findOne(where: any): Promise<Ticket | null> {
    return await this.ticketModel.findOne({ where });
  }

  async findAllWhere(where: any): Promise<Ticket[]> {
    return await this.ticketModel.findAll({ where });
  }

  async update(values: any, where: any): Promise<void> {
    await this.ticketModel.update(values, { where });
  }

  // Specific methods for advanced ticket operations
  async findActiveTicketsForCompany(companyId: number, excludeTicketId: number): Promise<Ticket[]> {
    return await this.ticketModel.findAll({
      where: {
        companyId,
        status: 'open',
        id: { [Op.ne]: excludeTicketId }
      }
    });
  }

  async resolveActiveTicketsForCompany(companyId: number, excludeTicketId: number): Promise<void> {
    await this.ticketModel.update(
      { status: 'resolved' },
      {
        where: {
          companyId,
          status: 'open',
          id: { [Op.ne]: excludeTicketId }
        }
      }
    );
  }
} 