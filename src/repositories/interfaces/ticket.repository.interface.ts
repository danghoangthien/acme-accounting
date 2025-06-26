import { Ticket, TicketType, TicketStatus } from '../../../db/models/Ticket';

export interface CreateTicketData {
  companyId: number;
  assigneeId: number;
  category: string;
  type: TicketType;
  status: TicketStatus;
}

export abstract class ITicketRepository {
  abstract findAll(): Promise<Ticket[]>;
  abstract create(data: CreateTicketData): Promise<Ticket>;
  abstract findOne(where: any): Promise<Ticket | null>;
  abstract findAllWhere(where: any): Promise<Ticket[]>;
  abstract update(values: any, where: any): Promise<void>;
  abstract findActiveTicketsForCompany(companyId: number, excludeTicketId: number): Promise<Ticket[]>;
  abstract resolveActiveTicketsForCompany(companyId: number, excludeTicketId: number): Promise<void>;
} 