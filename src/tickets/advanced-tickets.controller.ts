import { Body, Controller, Get, Post } from '@nestjs/common';
import { AdvancedTicketsService, NewTicketDto, TicketDto } from './advanced-tickets.service';

@Controller('api/v1/advanced-tickets')
export class AdvancedTicketsController {
  constructor(private readonly advancedTicketsService: AdvancedTicketsService) {}

  @Get()
  async findAll() {
    return await this.advancedTicketsService.findAll();
  }

  @Post()
  async create(@Body() newTicketDto: NewTicketDto): Promise<TicketDto> {
    return await this.advancedTicketsService.create(newTicketDto);
  }
} 