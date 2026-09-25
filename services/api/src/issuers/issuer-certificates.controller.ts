import { Body, Controller, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  generateCsrSchema,
  matchCertificateSchema,
  uploadCertificateSchema,
  type GenerateCsr,
  type MatchCertificate,
  type UploadCertificate,
} from "@chirola/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { CertsService } from "../certs/certs.service";
import { IssuersService } from "./issuers.service";

@Controller("issuers")
@UseGuards(JwtAuthGuard)
export class IssuerCertificatesController {
  constructor(
    private readonly issuers: IssuersService,
    private readonly certs: CertsService,
  ) {}

  @Post(":id/csr")
  async generateCsr(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(generateCsrSchema)) body: GenerateCsr,
  ): Promise<{ csrPem: string }> {
    const issuer = await this.issuers.getFromUser(id, user.sub);
    return await this.certs.generateCsr(id, issuer, body);
  }

  @Put(":id/certificate")
  async matchCertificate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(matchCertificateSchema)) body: MatchCertificate,
  ): Promise<{ ok: boolean }> {
    await this.issuers.getFromUser(id, user.sub);
    await this.certs.matchCertificate(id, body.certPem);
    return { ok: true };
  }

  @Post(":id/certificate")
  async uploadCertificate(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(uploadCertificateSchema))
    body: UploadCertificate,
  ): Promise<{ ok: boolean }> {
    await this.issuers.getFromUser(id, user.sub);
    await this.certs.saveCertificate(id, body.privateKeyPem, body.certPem, body.alias);
    return { ok: true };
  }
}
