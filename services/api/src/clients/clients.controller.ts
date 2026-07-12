import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  updateClientSchema,
  createClientSchema,
  type UpdateClient,
  type CreateClient,
} from '@chirola/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { IssuersService } from '../issuers/issuers.service';
import { ClientsService } from './clients.service';

@Controller('issuers/:issuerId/clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(
    private readonly clients: ClientsService,
    private readonly issuers: IssuersService,
  ) {}

  private async assertIssuer(issuerId: string, user: JwtPayload) {
    await this.issuers.getFromUser(issuerId, user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Body(new ZodValidationPipe(createClientSchema)) body: CreateClient,
  ) {
    await this.assertIssuer(issuerId, user);
    return this.clients.create(issuerId, body);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
  ) {
    await this.assertIssuer(issuerId, user);
    return this.clients.list(issuerId);
  }

  @Get(':id')
  async get(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Param('id') id: string,
  ) {
    await this.assertIssuer(issuerId, user);
    return this.clients.get(issuerId, id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClientSchema)) body: UpdateClient,
  ) {
    await this.assertIssuer(issuerId, user);
    return this.clients.update(issuerId, id, body);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('issuerId') issuerId: string,
    @Param('id') id: string,
  ) {
    await this.assertIssuer(issuerId, user);
    return this.clients.delete(issuerId, id);
  }
}
