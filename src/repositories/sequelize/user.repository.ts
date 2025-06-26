import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../../db/models/User';
import { IUserRepository } from '../interfaces/user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async findAll(where: any, options?: any): Promise<User[]> {
    return await this.userModel.findAll({
      where,
      ...options,
    });
  }

  async findOne(where: any): Promise<User | null> {
    return await this.userModel.findOne({ where });
  }
} 