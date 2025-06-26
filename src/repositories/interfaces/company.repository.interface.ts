import { Company } from '../../../db/models/Company';

export abstract class ICompanyRepository {
  abstract findOne(where: any): Promise<Company | null>;
  abstract findAll(): Promise<Company[]>;
} 