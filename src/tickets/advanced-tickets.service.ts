import { Injectable, ConflictException } from '@nestjs/common';
import {
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { ITicketRepository } from '../repositories/interfaces/ticket.repository.interface';
import { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import { ICompanyRepository } from '../repositories/interfaces/company.repository.interface';
import { Inject } from '@nestjs/common';

export interface NewTicketDto {
  type: TicketType;
  companyId: number;
}

export interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

interface TicketAssignmentRule {
  category: TicketCategory;
  primaryRole: UserRole;
  fallbackRole?: UserRole;
  requireUniqueAssignee?: boolean;
  requiresUniqueCheck?: boolean;
}

@Injectable()
export class AdvancedTicketsService {
  private readonly assignmentRules: Record<TicketType, TicketAssignmentRule> = {
    [TicketType.managementReport]: {
      category: TicketCategory.accounting,
      primaryRole: UserRole.accountant,
      requireUniqueAssignee: false,
    },
    [TicketType.registrationAddressChange]: {
      category: TicketCategory.corporate,
      primaryRole: UserRole.corporateSecretary,
      fallbackRole: UserRole.director,
      requireUniqueAssignee: true,
      requiresUniqueCheck: true,
    },
    [TicketType.strikeOff]: {
      category: TicketCategory.management,
      primaryRole: UserRole.director,
      requireUniqueAssignee: true,
    },
  };

  constructor(
    @Inject(ITicketRepository)
    private readonly ticketRepository: ITicketRepository,
    @Inject(IUserRepository)
    private readonly userRepository: IUserRepository,
    @Inject(ICompanyRepository)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async findAll() {
    return await this.ticketRepository.findAll();
  }

  async create(newTicketDto: NewTicketDto): Promise<TicketDto> {
    const { type, companyId } = newTicketDto;

    // Get category and assignee based on ticket type using switch logic
    const { category, assignee } = await this.getTicketAssignmentByType(type, companyId);

    const ticket = await this.ticketRepository.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    // Execute post-creation logic
    await this.onTicketCreated(type, companyId, ticket.id);

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

  private async getTicketAssignmentByType(
    type: TicketType, 
    companyId: number
  ): Promise<{ category: TicketCategory; assignee: User }> {
    const rule = this.assignmentRules[type];
    if (!rule) {
      throw new ConflictException(`Unsupported ticket type: ${type}`);
    }

    // Handle uniqueness check if required
    if (rule.requiresUniqueCheck) {
      const existingTicket = await this.ticketRepository.findOne({
        type, 
        companyId,
      });
      if (existingTicket) {
        throw new ConflictException(
          `Ticket with type ${type} already exists for company ${companyId}`,
        );
      }
    }

    // Find assignee based on the rule
    const assignee = await this.findAssigneeByRule(rule, companyId, type);

    return {
      category: rule.category,
      assignee,
    };
  }

  private async onTicketCreated(
    type: TicketType, 
    companyId: number, 
    createdTicketId: number
  ): Promise<void> {
    switch (type) {
      case TicketType.strikeOff:
        await this.resolveAllActiveTicketsForCompany(companyId, createdTicketId);
        break;
      
      // Other ticket types may have post-creation logic in the future
      case TicketType.managementReport:
      case TicketType.registrationAddressChange:
      default:
        // No post-creation logic for these ticket types
        break;
    }
  }

  private async resolveAllActiveTicketsForCompany(
    companyId: number, 
    excludeTicketId: number
  ): Promise<void> {
    try {
      // Find all active tickets for this company (excluding the newly created strikeOff ticket)
      const activeTickets = await this.ticketRepository.findActiveTicketsForCompany(
        companyId, 
        excludeTicketId
      );

      if (activeTickets.length > 0) {
        // Update all active tickets to resolved status
        await this.ticketRepository.resolveActiveTicketsForCompany(
          companyId, 
          excludeTicketId
        );

        console.log(
          `✅ Resolved ${activeTickets.length} active tickets for company ${companyId} due to strikeOff ticket creation`
        );
      }
    } catch (error) {
      console.error(
        `❌ Failed to resolve active tickets for company ${companyId}:`, 
        error.message
      );
      // Don't throw the error to avoid failing the main ticket creation
      // This is a business rule and shouldn't block the primary operation
    }
  }

  private async findAssigneeByRule(
    rule: TicketAssignmentRule,
    companyId: number,
    ticketType: TicketType,
  ): Promise<User> {
    // Try to find users with the primary role
    const primaryAssignees = await this.userRepository.findAll(
      { companyId, role: rule.primaryRole },
      { order: [['createdAt', 'DESC']] }
    );

    // If we found primary assignees, handle them based on the rule
    if (primaryAssignees.length > 0) {
      // Check if unique assignee is required
      if (rule.requireUniqueAssignee && primaryAssignees.length > 1) {
        throw new ConflictException(
          `Multiple users with role ${rule.primaryRole}. Cannot create a ${ticketType} ticket`,
        );
      }
      return primaryAssignees[0];
    }

    // If no primary assignees found and there's a fallback role, try that
    if (rule.fallbackRole) {
      const fallbackAssignees = await this.userRepository.findAll(
        { companyId, role: rule.fallbackRole },
        { order: [['createdAt', 'DESC']] }
      );

      if (fallbackAssignees.length > 0) {
        // Check if unique assignee is required for fallback role too
        if (rule.requireUniqueAssignee && fallbackAssignees.length > 1) {
          throw new ConflictException(
            `Multiple users with role ${rule.fallbackRole}. Cannot create a ${ticketType} ticket`,
          );
        }
        return fallbackAssignees[0];
      }

      // No fallback assignees found either
      throw new ConflictException(
        `Cannot find user with role ${rule.primaryRole} or ${rule.fallbackRole} to create a ${ticketType} ticket`,
      );
    }

    // No primary assignees and no fallback role
    throw new ConflictException(
      `Cannot find user with role ${rule.primaryRole} to create a ${ticketType} ticket`,
    );
  }
}
