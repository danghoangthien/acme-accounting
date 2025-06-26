import { User, UserRole } from '../../../db/models/User';

export abstract class IUserRepository {
  abstract findAll(where: any, options?: any): Promise<User[]>;
  abstract findOne(where: any): Promise<User | null>;
} 