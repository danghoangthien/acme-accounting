import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Company } from '../../../db/models/Company';
import { ICompanyRepository } from '../interfaces/company.repository.interface';

@Injectable()
export class CompanyRepository implements ICompanyRepository {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
  ) {}

  async findOne(where: any): Promise<Company | null> {
    return await this.companyModel.findOne({ where });
  }

  async findAll(): Promise<Company[]> {
    return await this.companyModel.findAll();
  }
} 