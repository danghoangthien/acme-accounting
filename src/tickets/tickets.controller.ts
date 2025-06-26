import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    const category =
      type === TicketType.managementReport
        ? TicketCategory.accounting
        : TicketCategory.corporate;

    const userRole =
      type === TicketType.managementReport
        ? UserRole.accountant
        : UserRole.corporateSecretary;

    let assignee: User;
  
    if (type === TicketType.registrationAddressChange) {
      const ticketWithType = await Ticket.findOne({
        where: {
          type,
          companyId,
        },
      });

      if (ticketWithType) {
        throw new ConflictException(
          `Ticket with type ${type} already exists for company ${companyId}`,
        );
      }

      const corporateSecretary = await User.findOne({
        where: {
          companyId,
          role: UserRole.corporateSecretary,
        },
      });
      if (!corporateSecretary) {
        // If there are multiple directors, throw an error.
        const directors = await User.findAll({
          where: {
            companyId,
            role: UserRole.director,
          },
        });
        if (directors.length > 1) {
          throw new ConflictException(
            `Multiple users with role ${UserRole.director}. Cannot create a ${type} ticket`,
          );
        }
        if (directors.length === 0) {
          throw new ConflictException(
            `Cannot find user with role ${UserRole.director} to create a ${type} ticket`,
          );
        }
        assignee = directors[0];

      } else {
        assignee = corporateSecretary;
      }

    } else {
      const assignees = await User.findAll({
        where: { companyId, role: userRole },
        order: [['createdAt', 'DESC']],
      });

      if (!assignees.length)
        throw new ConflictException(
          `Cannot find user with role ${userRole} to create a ticket`,
        );

      if (userRole === UserRole.corporateSecretary && assignees.length > 1)
        throw new ConflictException(
          `Multiple users with role ${userRole}. Cannot create a ticket`,
        );

      assignee = assignees[0];
        
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
