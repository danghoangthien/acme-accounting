import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AdvancedTicketsService, NewTicketDto, TicketDto } from './advanced-tickets.service';
import { ITicketRepository } from '../repositories/interfaces/ticket.repository.interface';
import { IUserRepository } from '../repositories/interfaces/user.repository.interface';
import { ICompanyRepository } from '../repositories/interfaces/company.repository.interface';
import { Ticket, TicketType, TicketStatus, TicketCategory } from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

describe('AdvancedTicketsService', () => {
  let service: AdvancedTicketsService;
  let ticketRepository: jest.Mocked<ITicketRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let companyRepository: jest.Mocked<ICompanyRepository>;

  const mockTickets = [
    {
      id: 1,
      type: TicketType.managementReport,
      companyId: 1,
      assigneeId: 101,
      status: TicketStatus.open,
      category: TicketCategory.accounting,
    },
    {
      id: 2,
      type: TicketType.registrationAddressChange,
      companyId: 2,
      assigneeId: 201,
      status: TicketStatus.open,
      category: TicketCategory.corporate,
    },
  ] as Ticket[];

  const mockUsers = {
    accountant: {
      id: 101,
      name: 'John Accountant',
      role: UserRole.accountant,
      companyId: 1,
    } as User,
    corporateSecretary: {
      id: 201,
      name: 'Jane Secretary',
      role: UserRole.corporateSecretary,
      companyId: 2,
    } as User,
    director: {
      id: 301,
      name: 'Bob Director',
      role: UserRole.director,
      companyId: 3,
    } as User,
  };

  beforeEach(async () => {
    const mockTicketRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findAllWhere: jest.fn(),
      update: jest.fn(),
      findActiveTicketsForCompany: jest.fn(),
      resolveActiveTicketsForCompany: jest.fn(),
    };

    const mockUserRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
    };

    const mockCompanyRepository = {
      findAll: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedTicketsService,
        {
          provide: ITicketRepository,
          useValue: mockTicketRepository,
        },
        {
          provide: IUserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: ICompanyRepository,
          useValue: mockCompanyRepository,
        },
      ],
    }).compile();

    service = module.get<AdvancedTicketsService>(AdvancedTicketsService);
    ticketRepository = module.get(ITicketRepository);
    userRepository = module.get(IUserRepository);
    companyRepository = module.get(ICompanyRepository);

    // Setup console.log and console.error mocks
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have repositories injected', () => {
      expect(ticketRepository).toBeDefined();
      expect(userRepository).toBeDefined();
      expect(companyRepository).toBeDefined();
    });

    it('should have assignment rules configured', () => {
      // Access private property for testing
      const assignmentRules = (service as any).assignmentRules;
      expect(assignmentRules).toBeDefined();
      expect(assignmentRules[TicketType.managementReport]).toBeDefined();
      expect(assignmentRules[TicketType.registrationAddressChange]).toBeDefined();
      expect(assignmentRules[TicketType.strikeOff]).toBeDefined();
    });
  });

  describe('findAll()', () => {
    it('should return all tickets', async () => {
      ticketRepository.findAll.mockResolvedValue(mockTickets);

      const result = await service.findAll();

      expect(ticketRepository.findAll).toHaveBeenCalledTimes(1);
      expect(ticketRepository.findAll).toHaveBeenCalledWith();
      expect(result).toEqual(mockTickets);
    });

    it('should return empty array when no tickets exist', async () => {
      ticketRepository.findAll.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection failed');
      ticketRepository.findAll.mockRejectedValue(error);

      await expect(service.findAll()).rejects.toThrow('Database connection failed');
    });
  });

  describe('create()', () => {
    describe('Management Report Tickets', () => {
      const managementReportDto: NewTicketDto = {
        type: TicketType.managementReport,
        companyId: 1,
      };

      const expectedTicket = {
        id: 1,
        type: TicketType.managementReport,
        companyId: 1,
        assigneeId: 101,
        status: TicketStatus.open,
        category: TicketCategory.accounting,
      } as Ticket;

      it('should create management report ticket successfully', async () => {
        userRepository.findAll.mockResolvedValue([mockUsers.accountant]);
        ticketRepository.create.mockResolvedValue(expectedTicket);

        const result = await service.create(managementReportDto);

        expect(userRepository.findAll).toHaveBeenCalledWith(
          { companyId: 1, role: UserRole.accountant },
          { order: [['createdAt', 'DESC']] }
        );
        expect(ticketRepository.create).toHaveBeenCalledWith({
          companyId: 1,
          assigneeId: 101,
          category: TicketCategory.accounting,
          type: TicketType.managementReport,
          status: TicketStatus.open,
        });
        expect(result).toEqual({
          id: 1,
          type: TicketType.managementReport,
          assigneeId: 101,
          status: TicketStatus.open,
          category: TicketCategory.accounting,
          companyId: 1,
        });
      });

          it('should assign to first accountant when multiple exist', async () => {
      const accountant1 = { ...mockUsers.accountant, id: 100 } as User;
      const accountant2 = { ...mockUsers.accountant, id: 101 } as User;
      userRepository.findAll.mockResolvedValue([accountant2, accountant1]); // DESC order
      ticketRepository.create.mockResolvedValue(expectedTicket);

        const result = await service.create(managementReportDto);

        expect(result.assigneeId).toBe(101); // First in DESC order
      });

      it('should throw error when no accountant available', async () => {
        userRepository.findAll.mockResolvedValue([]);

        await expect(service.create(managementReportDto)).rejects.toThrow(
          new ConflictException(
            'Cannot find user with role accountant to create a managementReport ticket'
          )
        );
      });

      it('should not require uniqueness check for management reports', async () => {
        userRepository.findAll.mockResolvedValue([mockUsers.accountant]);
        ticketRepository.create.mockResolvedValue(expectedTicket);

        await service.create(managementReportDto);

        // Should not call findOne for uniqueness check
        expect(ticketRepository.findOne).not.toHaveBeenCalled();
      });
    });

    describe('Registration Address Change Tickets', () => {
      const registrationChangeDto: NewTicketDto = {
        type: TicketType.registrationAddressChange,
        companyId: 2,
      };

      const expectedTicket = {
        id: 2,
        type: TicketType.registrationAddressChange,
        companyId: 2,
        assigneeId: 201,
        status: TicketStatus.open,
        category: TicketCategory.corporate,
      } as Ticket;

      it('should create registration address change ticket successfully', async () => {
        ticketRepository.findOne.mockResolvedValue(null); // No existing ticket
        userRepository.findAll.mockResolvedValue([mockUsers.corporateSecretary]);
        ticketRepository.create.mockResolvedValue(expectedTicket);

        const result = await service.create(registrationChangeDto);

        expect(ticketRepository.findOne).toHaveBeenCalledWith({
          type: TicketType.registrationAddressChange,
          companyId: 2,
        });
        expect(userRepository.findAll).toHaveBeenCalledWith(
          { companyId: 2, role: UserRole.corporateSecretary },
          { order: [['createdAt', 'DESC']] }
        );
        expect(result.category).toBe(TicketCategory.corporate);
      });

      it('should throw error when ticket already exists for company', async () => {
        const existingTicket = { id: 999 } as Ticket;
        ticketRepository.findOne.mockResolvedValue(existingTicket);

        await expect(service.create(registrationChangeDto)).rejects.toThrow(
          new ConflictException(
            'Ticket with type registrationAddressChange already exists for company 2'
          )
        );
      });

          it('should throw error when multiple corporate secretaries exist', async () => {
      const secretary1 = { ...mockUsers.corporateSecretary, id: 200 } as User;
      const secretary2 = { ...mockUsers.corporateSecretary, id: 201 } as User;
      ticketRepository.findOne.mockResolvedValue(null);
      userRepository.findAll.mockResolvedValue([secretary1, secretary2]);

        await expect(service.create(registrationChangeDto)).rejects.toThrow(
          new ConflictException(
            'Multiple users with role corporateSecretary. Cannot create a registrationAddressChange ticket'
          )
        );
      });

      it('should fallback to director when no corporate secretary available', async () => {
        ticketRepository.findOne.mockResolvedValue(null);
        userRepository.findAll
          .mockResolvedValueOnce([]) // No corporate secretary
          .mockResolvedValueOnce([mockUsers.director]); // Director available
        
              const expectedTicketWithDirector = {
        ...expectedTicket,
        assigneeId: 301,
      } as Ticket;
      ticketRepository.create.mockResolvedValue(expectedTicketWithDirector);

        const result = await service.create(registrationChangeDto);

        expect(userRepository.findAll).toHaveBeenCalledTimes(2);
        expect(userRepository.findAll).toHaveBeenNthCalledWith(1,
          { companyId: 2, role: UserRole.corporateSecretary },
          { order: [['createdAt', 'DESC']] }
        );
        expect(userRepository.findAll).toHaveBeenNthCalledWith(2,
          { companyId: 2, role: UserRole.director },
          { order: [['createdAt', 'DESC']] }
        );
        expect(result.assigneeId).toBe(301);
      });

      it('should throw error when multiple directors exist as fallback', async () => {
        const director1 = { ...mockUsers.director, id: 300 } as User;
        const director2 = { ...mockUsers.director, id: 301 } as User;
        ticketRepository.findOne.mockResolvedValue(null);
        userRepository.findAll
          .mockResolvedValueOnce([]) // No corporate secretary
          .mockResolvedValueOnce([director1, director2]); // Multiple directors

        await expect(service.create(registrationChangeDto)).rejects.toThrow(
          new ConflictException(
            'Multiple users with role director. Cannot create a registrationAddressChange ticket'
          )
        );
      });

      it('should throw error when no corporate secretary or director available', async () => {
        ticketRepository.findOne.mockResolvedValue(null);
        userRepository.findAll
          .mockResolvedValueOnce([]) // No corporate secretary
          .mockResolvedValueOnce([]); // No director

        await expect(service.create(registrationChangeDto)).rejects.toThrow(
          new ConflictException(
            'Cannot find user with role corporateSecretary or director to create a registrationAddressChange ticket'
          )
        );
      });
    });

    describe('Strike-Off Tickets', () => {
      const strikeOffDto: NewTicketDto = {
        type: TicketType.strikeOff,
        companyId: 3,
      };

      const expectedTicket = {
        id: 3,
        type: TicketType.strikeOff,
        companyId: 3,
        assigneeId: 301,
        status: TicketStatus.open,
        category: TicketCategory.management,
      } as Ticket;

      it('should create strike-off ticket successfully', async () => {
        userRepository.findAll.mockResolvedValue([mockUsers.director]);
        ticketRepository.create.mockResolvedValue(expectedTicket);
        ticketRepository.findActiveTicketsForCompany.mockResolvedValue([]);

        const result = await service.create(strikeOffDto);

        expect(userRepository.findAll).toHaveBeenCalledWith(
          { companyId: 3, role: UserRole.director },
          { order: [['createdAt', 'DESC']] }
        );
        expect(result.category).toBe(TicketCategory.management);
        expect(result.type).toBe(TicketType.strikeOff);
      });

          it('should throw error when multiple directors exist', async () => {
      const director1 = { ...mockUsers.director, id: 300 } as User;
      const director2 = { ...mockUsers.director, id: 301 } as User;
      userRepository.findAll.mockResolvedValue([director1, director2]);

        await expect(service.create(strikeOffDto)).rejects.toThrow(
          new ConflictException(
            'Multiple users with role director. Cannot create a strikeOff ticket'
          )
        );
      });

      it('should throw error when no director available', async () => {
        userRepository.findAll.mockResolvedValue([]);

        await expect(service.create(strikeOffDto)).rejects.toThrow(
          new ConflictException(
            'Cannot find user with role director to create a strikeOff ticket'
          )
        );
      });

      it('should resolve all active tickets for company after creation', async () => {
        const activeTickets = [
          { id: 10, status: TicketStatus.open },
          { id: 11, status: TicketStatus.open },
        ] as Ticket[];

        userRepository.findAll.mockResolvedValue([mockUsers.director]);
        ticketRepository.create.mockResolvedValue(expectedTicket);
        ticketRepository.findActiveTicketsForCompany.mockResolvedValue(activeTickets);

        await service.create(strikeOffDto);

        expect(ticketRepository.findActiveTicketsForCompany).toHaveBeenCalledWith(3, 3);
        expect(ticketRepository.resolveActiveTicketsForCompany).toHaveBeenCalledWith(3, 3);
        expect(console.log).toHaveBeenCalledWith(
          '✅ Resolved 2 active tickets for company 3 due to strikeOff ticket creation'
        );
      });

      it('should handle no active tickets to resolve', async () => {
        userRepository.findAll.mockResolvedValue([mockUsers.director]);
        ticketRepository.create.mockResolvedValue(expectedTicket);
        ticketRepository.findActiveTicketsForCompany.mockResolvedValue([]);

        await service.create(strikeOffDto);

        expect(ticketRepository.resolveActiveTicketsForCompany).not.toHaveBeenCalled();
        expect(console.log).not.toHaveBeenCalled();
      });

      it('should handle errors in resolving active tickets gracefully', async () => {
        const error = new Error('Database error');
        userRepository.findAll.mockResolvedValue([mockUsers.director]);
        ticketRepository.create.mockResolvedValue(expectedTicket);
        ticketRepository.findActiveTicketsForCompany.mockRejectedValue(error);

        // Should not throw error, but should complete ticket creation
        const result = await service.create(strikeOffDto);

        expect(result).toEqual({
          id: 3,
          type: TicketType.strikeOff,
          assigneeId: 301,
          status: TicketStatus.open,
          category: TicketCategory.management,
          companyId: 3,
        });
        expect(console.error).toHaveBeenCalledWith(
          '❌ Failed to resolve active tickets for company 3:',
          'Database error'
        );
      });
    });

    describe('Input Validation', () => {
      it('should throw error for unsupported ticket type', async () => {
        const invalidDto = {
          type: 'invalid-type' as TicketType,
          companyId: 1,
        };

        await expect(service.create(invalidDto)).rejects.toThrow(
          new ConflictException('Unsupported ticket type: invalid-type')
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle repository create errors', async () => {
        const managementReportDto: NewTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        userRepository.findAll.mockResolvedValue([mockUsers.accountant]);
        ticketRepository.create.mockRejectedValue(new Error('Database constraint violation'));

        await expect(service.create(managementReportDto)).rejects.toThrow(
          'Database constraint violation'
        );
      });

      it('should handle user repository errors', async () => {
        const managementReportDto: NewTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        userRepository.findAll.mockRejectedValue(new Error('User query failed'));

        await expect(service.create(managementReportDto)).rejects.toThrow('User query failed');
      });
    });
  });

  describe('Business Logic Integration', () => {
    describe('Assignment Rules', () => {
      it('should have correct assignment rules for managementReport', () => {
        const rules = (service as any).assignmentRules;
        const rule = rules[TicketType.managementReport];

        expect(rule.category).toBe(TicketCategory.accounting);
        expect(rule.primaryRole).toBe(UserRole.accountant);
        expect(rule.requireUniqueAssignee).toBe(false);
        expect(rule.requiresUniqueCheck).toBeUndefined();
        expect(rule.fallbackRole).toBeUndefined();
      });

      it('should have correct assignment rules for registrationAddressChange', () => {
        const rules = (service as any).assignmentRules;
        const rule = rules[TicketType.registrationAddressChange];

        expect(rule.category).toBe(TicketCategory.corporate);
        expect(rule.primaryRole).toBe(UserRole.corporateSecretary);
        expect(rule.fallbackRole).toBe(UserRole.director);
        expect(rule.requireUniqueAssignee).toBe(true);
        expect(rule.requiresUniqueCheck).toBe(true);
      });

      it('should have correct assignment rules for strikeOff', () => {
        const rules = (service as any).assignmentRules;
        const rule = rules[TicketType.strikeOff];

        expect(rule.category).toBe(TicketCategory.management);
        expect(rule.primaryRole).toBe(UserRole.director);
        expect(rule.requireUniqueAssignee).toBe(true);
        expect(rule.requiresUniqueCheck).toBeUndefined();
        expect(rule.fallbackRole).toBeUndefined();
      });
    });

    describe('Side Effects', () => {
      it('should only trigger side effects for strikeOff tickets', async () => {
        const managementDto: NewTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        const expectedTicket = {
          id: 1,
          type: TicketType.managementReport,
          companyId: 1,
          assigneeId: 101,
          status: TicketStatus.open,
          category: TicketCategory.accounting,
        } as Ticket;

        userRepository.findAll.mockResolvedValue([mockUsers.accountant]);
        ticketRepository.create.mockResolvedValue(expectedTicket);

        await service.create(managementDto);

        // Should not call any side effect methods
        expect(ticketRepository.findActiveTicketsForCompany).not.toHaveBeenCalled();
        expect(ticketRepository.resolveActiveTicketsForCompany).not.toHaveBeenCalled();
      });
    });

    describe('Data Consistency', () => {
      it('should return consistent DTO format', async () => {
        const dto: NewTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        const createdTicket = {
          id: 123,
          type: TicketType.managementReport,
          companyId: 1,
          assigneeId: 101,
          status: TicketStatus.open,
          category: TicketCategory.accounting,
          // Additional Sequelize properties that should be filtered out
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any;

        userRepository.findAll.mockResolvedValue([mockUsers.accountant]);
        ticketRepository.create.mockResolvedValue(createdTicket);

        const result = await service.create(dto);

        // Should only include DTO fields
        expect(result).toEqual({
          id: 123,
          type: TicketType.managementReport,
          assigneeId: 101,
          status: TicketStatus.open,
          category: TicketCategory.accounting,
          companyId: 1,
        });

        // Should not include Sequelize metadata
        expect(result).not.toHaveProperty('createdAt');
        expect(result).not.toHaveProperty('updatedAt');
      });
    });
  });

  describe('Error Handling', () => {
    it('should preserve original error types', async () => {
      const dto: NewTicketDto = {
        type: TicketType.managementReport,
        companyId: 1,
      };

      const conflictError = new ConflictException('Custom conflict error');
      userRepository.findAll.mockRejectedValue(conflictError);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow('Custom conflict error');
    });

    it('should handle unexpected errors gracefully', async () => {
      const dto: NewTicketDto = {
        type: TicketType.managementReport,
        companyId: 1,
      };

      const unexpectedError = new Error('Unexpected database error');
      userRepository.findAll.mockRejectedValue(unexpectedError);

      await expect(service.create(dto)).rejects.toThrow('Unexpected database error');
    });
  });

  describe('Performance Considerations', () => {
    it('should minimize database calls for simple tickets', async () => {
      const dto: NewTicketDto = {
        type: TicketType.managementReport,
        companyId: 1,
      };

      const expectedTicket = {
        id: 1,
        type: TicketType.managementReport,
        companyId: 1,
        assigneeId: 101,
        status: TicketStatus.open,
        category: TicketCategory.accounting,
      } as Ticket;

      userRepository.findAll.mockResolvedValue([mockUsers.accountant]);
      ticketRepository.create.mockResolvedValue(expectedTicket);

      await service.create(dto);

      // Should only make necessary calls
      expect(userRepository.findAll).toHaveBeenCalledTimes(1);
      expect(ticketRepository.create).toHaveBeenCalledTimes(1);
      expect(ticketRepository.findOne).not.toHaveBeenCalled(); // No uniqueness check
      expect(ticketRepository.findActiveTicketsForCompany).not.toHaveBeenCalled(); // No side effects
    });

    it('should optimize database calls for complex tickets', async () => {
      const dto: NewTicketDto = {
        type: TicketType.registrationAddressChange,
        companyId: 2,
      };

      const expectedTicket = {
        id: 2,
        type: TicketType.registrationAddressChange,
        companyId: 2,
        assigneeId: 201,
        status: TicketStatus.open,
        category: TicketCategory.corporate,
      } as Ticket;

      ticketRepository.findOne.mockResolvedValue(null);
      userRepository.findAll.mockResolvedValue([mockUsers.corporateSecretary]);
      ticketRepository.create.mockResolvedValue(expectedTicket);

      await service.create(dto);

      // Should make all necessary calls but no more
      expect(ticketRepository.findOne).toHaveBeenCalledTimes(1); // Uniqueness check
      expect(userRepository.findAll).toHaveBeenCalledTimes(1); // Find primary role
      expect(ticketRepository.create).toHaveBeenCalledTimes(1);
    });
  });
}); 