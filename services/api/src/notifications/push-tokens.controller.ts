import { Body, Controller, Delete, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import {
  pushTokenSchema,
  removePushTokenSchema,
  type PushTokenInput,
  type RemovePushTokenInput,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { PushTokensService } from "./push-tokens.service";

@Controller("push-tokens")
@UseGuards(JwtAuthGuard)
export class PushTokensController {
  constructor(private readonly pushTokens: PushTokensService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  register(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(pushTokenSchema)) body: PushTokenInput,
  ): Promise<void> {
    return this.pushTokens.register(user.sub, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(removePushTokenSchema)) body: RemovePushTokenInput,
  ): Promise<void> {
    return this.pushTokens.remove(user.sub, body.token);
  }
}
