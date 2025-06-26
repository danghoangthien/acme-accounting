import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AdvancedTicketsController } from './advanced-tickets.controller';
import { AdvancedTicketsService, NewTicketDto, TicketDto } from './advanced-tickets.service';
import { Ticket, TicketType, TicketStatus, TicketCategory } from '../../db/models/Ticket';
import { UserRole } from '../../db/models/User';

describe('AdvancedTicketsController', () => {
  let controller: AdvancedTicketsController;
  let service: jest.Mocked<AdvancedTicketsService>;

  const mockTickets = [
    {
      id: 1,
      type: TicketType.managementReport,
      companyId: 1,
      assigneeId: 1,
      status: TicketStatus.open,
      category: TicketCategory.accounting,
    },
    {
      id: 2,
      type: TicketType.registrationAddressChange,
      companyId: 2,
      assigneeId: 2,
      status: TicketStatus.open,
      category: TicketCategory.corporate,
    },
    {
      id: 3,
      type: TicketType.strikeOff,
      companyId: 3,
      assigneeId: 3,
      status: TicketStatus.open,
      category: TicketCategory.management,
    },
  ] as Ticket[];

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvancedTicketsController],
      providers: [
        {
          provide: AdvancedTicketsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AdvancedTicketsController>(AdvancedTicketsController);
    service = module.get(AdvancedTicketsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have service injected', () => {
      expect(service).toBeDefined();
    });
  });

  describe('GET /api/v1/advanced-tickets', () => {
    describe('findAll', () => {
      it('should return all tickets', async () => {
        service.findAll.mockResolvedValue(mockTickets);

        const result = await controller.findAll();

        expect(service.findAll).toHaveBeenCalledTimes(1);
        expect(service.findAll).toHaveBeenCalledWith();
        expect(result).toEqual(mockTickets);
      });

      it('should return empty array when no tickets exist', async () => {
        service.findAll.mockResolvedValue([]);

        const result = await controller.findAll();

        expect(service.findAll).toHaveBeenCalledTimes(1);
        expect(result).toEqual([]);
      });

      it('should handle service errors', async () => {
        const error = new Error('Database connection failed');
        service.findAll.mockRejectedValue(error);

        await expect(controller.findAll()).rejects.toThrow('Database connection failed');
        expect(service.findAll).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('POST /api/v1/advanced-tickets', () => {
    describe('create', () => {
      describe('Management Report Tickets', () => {
        const managementReportDto: NewTicketDto = {
          type: TicketType.managementReport,
          companyId: 1,
        };

        const expectedTicket: TicketDto = {
          id: 1,
          type: TicketType.managementReport,
          companyId: 1,
          assigneeId: 101,
          status: TicketStatus.open,
          category: TicketCategory.accounting,
        };

        it('should create management report ticket successfully', async () => {
          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(managementReportDto);

          expect(service.create).toHaveBeenCalledTimes(1);
          expect(service.create).toHaveBeenCalledWith(managementReportDto);
          expect(result).toEqual(expectedTicket);
          expect(result.category).toBe(TicketCategory.accounting);
          expect(result.type).toBe(TicketType.managementReport);
          expect(result.status).toBe(TicketStatus.open);
        });

        it('should handle accountant assignment correctly', async () => {
          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(managementReportDto);

          expect(result.assigneeId).toBe(101);
          expect(result.category).toBe(TicketCategory.accounting);
        });

        it('should handle no accountant available error', async () => {
          const error = new ConflictException(
            'Cannot find user with role accountant to create a managementReport ticket'
          );
          service.create.mockRejectedValue(error);

          await expect(controller.create(managementReportDto)).rejects.toThrow(
            'Cannot find user with role accountant to create a managementReport ticket'
          );
          expect(service.create).toHaveBeenCalledWith(managementReportDto);
        });
      });

      describe('Registration Address Change Tickets', () => {
        const registrationChangeDto: NewTicketDto = {
          type: TicketType.registrationAddressChange,
          companyId: 2,
        };

        const expectedTicket: TicketDto = {
          id: 2,
          type: TicketType.registrationAddressChange,
          companyId: 2,
          assigneeId: 201,
          status: TicketStatus.open,
          category: TicketCategory.corporate,
        };

        it('should create registration address change ticket successfully', async () => {
          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(registrationChangeDto);

          expect(service.create).toHaveBeenCalledTimes(1);
          expect(service.create).toHaveBeenCalledWith(registrationChangeDto);
          expect(result).toEqual(expectedTicket);
          expect(result.category).toBe(TicketCategory.corporate);
          expect(result.type).toBe(TicketType.registrationAddressChange);
        });

        it('should handle corporate secretary assignment', async () => {
          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(registrationChangeDto);

          expect(result.assigneeId).toBe(201);
          expect(result.category).toBe(TicketCategory.corporate);
        });

        it('should handle duplicate ticket error', async () => {
          const error = new ConflictException(
            'Ticket with type registrationAddressChange already exists for company 2'
          );
          service.create.mockRejectedValue(error);

          await expect(controller.create(registrationChangeDto)).rejects.toThrow(
            'Ticket with type registrationAddressChange already exists for company 2'
          );
          expect(service.create).toHaveBeenCalledWith(registrationChangeDto);
        });

        it('should handle multiple corporate secretaries error', async () => {
          const error = new ConflictException(
            'Multiple users with role corporateSecretary. Cannot create a registrationAddressChange ticket'
          );
          service.create.mockRejectedValue(error);

          await expect(controller.create(registrationChangeDto)).rejects.toThrow(
            'Multiple users with role corporateSecretary. Cannot create a registrationAddressChange ticket'
          );
        });

        it('should handle fallback to director role', async () => {
          const expectedTicketWithDirector: TicketDto = {
            ...expectedTicket,
            assigneeId: 202, // Director ID
          };
          service.create.mockResolvedValue(expectedTicketWithDirector);

          const result = await controller.create(registrationChangeDto);

          expect(result.assigneeId).toBe(202);
          expect(result.category).toBe(TicketCategory.corporate);
        });
      });

      describe('Strike-Off Tickets', () => {
        const strikeOffDto: NewTicketDto = {
          type: TicketType.strikeOff,
          companyId: 3,
        };

        const expectedTicket: TicketDto = {
          id: 3,
          type: TicketType.strikeOff,
          companyId: 3,
          assigneeId: 301,
          status: TicketStatus.open,
          category: TicketCategory.management,
        };

        it('should create strike-off ticket successfully', async () => {
          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(strikeOffDto);

          expect(service.create).toHaveBeenCalledTimes(1);
          expect(service.create).toHaveBeenCalledWith(strikeOffDto);
          expect(result).toEqual(expectedTicket);
          expect(result.category).toBe(TicketCategory.management);
          expect(result.type).toBe(TicketType.strikeOff);
        });

        it('should handle director assignment', async () => {
          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(strikeOffDto);

          expect(result.assigneeId).toBe(301);
          expect(result.category).toBe(TicketCategory.management);
        });

        it('should handle multiple directors error', async () => {
          const error = new ConflictException(
            'Multiple users with role director. Cannot create a strikeOff ticket'
          );
          service.create.mockRejectedValue(error);

          await expect(controller.create(strikeOffDto)).rejects.toThrow(
            'Multiple users with role director. Cannot create a strikeOff ticket'
          );
        });

        it('should handle no director available error', async () => {
          const error = new ConflictException(
            'Cannot find user with role director to create a strikeOff ticket'
          );
          service.create.mockRejectedValue(error);

          await expect(controller.create(strikeOffDto)).rejects.toThrow(
            'Cannot find user with role director to create a strikeOff ticket'
          );
        });
      });

      describe('Input Validation', () => {
        it('should handle invalid ticket type', async () => {
          const invalidDto = {
            type: 'invalid-type' as TicketType,
            companyId: 1,
          };

          const error = new ConflictException('Unsupported ticket type: invalid-type');
          service.create.mockRejectedValue(error);

          await expect(controller.create(invalidDto)).rejects.toThrow(
            'Unsupported ticket type: invalid-type'
          );
        });

        it('should handle missing company ID', async () => {
          const invalidDto = {
            type: TicketType.managementReport,
            companyId: null as any,
          };

          const error = new Error('Company ID is required');
          service.create.mockRejectedValue(error);

          await expect(controller.create(invalidDto)).rejects.toThrow('Company ID is required');
        });

        it('should handle non-existent company', async () => {
          const dto: NewTicketDto = {
            type: TicketType.managementReport,
            companyId: 999,
          };

          const error = new ConflictException('Company with ID 999 not found');
          service.create.mockRejectedValue(error);

          await expect(controller.create(dto)).rejects.toThrow('Company with ID 999 not found');
        });
      });

      describe('Edge Cases', () => {
        it('should handle concurrent ticket creation', async () => {
          const dto: NewTicketDto = {
            type: TicketType.registrationAddressChange,
            companyId: 1,
          };

          const error = new ConflictException(
            'Ticket with type registrationAddressChange already exists for company 1'
          );
          service.create.mockRejectedValue(error);

          await expect(controller.create(dto)).rejects.toThrow(
            'Ticket with type registrationAddressChange already exists for company 1'
          );
        });

        it('should handle service timeout', async () => {
          const dto: NewTicketDto = {
            type: TicketType.managementReport,
            companyId: 1,
          };

          const error = new Error('Service timeout');
          service.create.mockRejectedValue(error);

          await expect(controller.create(dto)).rejects.toThrow('Service timeout');
        });

        it('should handle database constraint violations', async () => {
          const dto: NewTicketDto = {
            type: TicketType.strikeOff,
            companyId: 1,
          };

          const error = new Error('Database constraint violation');
          service.create.mockRejectedValue(error);

          await expect(controller.create(dto)).rejects.toThrow('Database constraint violation');
        });
      });

      describe('Business Rules Integration', () => {
        it('should handle strike-off side effects', async () => {
          const strikeOffDto: NewTicketDto = {
            type: TicketType.strikeOff,
            companyId: 1,
          };

          const expectedTicket: TicketDto = {
            id: 4,
            type: TicketType.strikeOff,
            companyId: 1,
            assigneeId: 301,
            status: TicketStatus.open,
            category: TicketCategory.management,
          };

          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(strikeOffDto);

          expect(service.create).toHaveBeenCalledWith(strikeOffDto);
          expect(result).toEqual(expectedTicket);
          // The service should handle resolving other active tickets internally
        });

        it('should maintain data consistency across operations', async () => {
          const dto: NewTicketDto = {
            type: TicketType.managementReport,
            companyId: 1,
          };

          const expectedTicket: TicketDto = {
            id: 5,
            type: TicketType.managementReport,
            companyId: 1,
            assigneeId: 101,
            status: TicketStatus.open,
            category: TicketCategory.accounting,
          };

          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(dto);

          expect(result.companyId).toBe(dto.companyId);
          expect(result.type).toBe(dto.type);
          expect(result.status).toBe(TicketStatus.open);
        });
      });

      describe('Response Format', () => {
        it('should return properly formatted ticket DTO', async () => {
          const dto: NewTicketDto = {
            type: TicketType.managementReport,
            companyId: 1,
          };

          const expectedTicket: TicketDto = {
            id: 1,
            type: TicketType.managementReport,
            companyId: 1,
            assigneeId: 101,
            status: TicketStatus.open,
            category: TicketCategory.accounting,
          };

          service.create.mockResolvedValue(expectedTicket);

          const result = await controller.create(dto);

          // Verify all required fields are present
          expect(result).toHaveProperty('id');
          expect(result).toHaveProperty('type');
          expect(result).toHaveProperty('companyId');
          expect(result).toHaveProperty('assigneeId');
          expect(result).toHaveProperty('status');
          expect(result).toHaveProperty('category');

          // Verify field types
          expect(typeof result.id).toBe('number');
          expect(typeof result.companyId).toBe('number');
          expect(typeof result.assigneeId).toBe('number');
          expect(Object.values(TicketType)).toContain(result.type);
          expect(Object.values(TicketStatus)).toContain(result.status);
          expect(Object.values(TicketCategory)).toContain(result.category);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors correctly', async () => {
      const dto: NewTicketDto = {
        type: TicketType.managementReport,
        companyId: 1,
      };

      const error = new ConflictException('Test error');
      service.create.mockRejectedValue(error);

      await expect(controller.create(dto)).rejects.toThrow(ConflictException);
      await expect(controller.create(dto)).rejects.toThrow('Test error');
    });

    it('should handle unexpected errors gracefully', async () => {
      service.findAll.mockRejectedValue(new Error('Unexpected error'));

      await expect(controller.findAll()).rejects.toThrow('Unexpected error');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multiple ticket types in sequence', async () => {
      const managementDto: NewTicketDto = {
        type: TicketType.managementReport,
        companyId: 1,
      };

      const registrationDto: NewTicketDto = {
        type: TicketType.registrationAddressChange,
        companyId: 1,
      };

      const managementTicket: TicketDto = {
        id: 1,
        type: TicketType.managementReport,
        companyId: 1,
        assigneeId: 101,
        status: TicketStatus.open,
        category: TicketCategory.accounting,
      };

      const registrationTicket: TicketDto = {
        id: 2,
        type: TicketType.registrationAddressChange,
        companyId: 1,
        assigneeId: 201,
        status: TicketStatus.open,
        category: TicketCategory.corporate,
      };

      service.create
        .mockResolvedValueOnce(managementTicket)
        .mockResolvedValueOnce(registrationTicket);

      const result1 = await controller.create(managementDto);
      const result2 = await controller.create(registrationDto);

      expect(result1.type).toBe(TicketType.managementReport);
      expect(result2.type).toBe(TicketType.registrationAddressChange);
      expect(service.create).toHaveBeenCalledTimes(2);
    });
  });
}); 