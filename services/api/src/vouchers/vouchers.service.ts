import { Injectable, NotFoundException } from "@nestjs/common";
import { hasText, type EmissionPlan, type IssueVoucher } from "@chirola/shared";
import type { VoucherAmounts } from "../arca/wsfe/wsfe.types";
import { calculateAmounts } from "../arca/wsfe/iva-calculator";
import type { AuthenticatedApiClient } from "../service-auth/api-client.service";
import { renderQrPng } from "./qr-image.util";
import { renderVoucherPdf } from "./pdf.util";
import { buildVoucherPdfData } from "./voucher-pdf-data";
import { VoucherAccessService } from "./voucher-access.service";
import { VoucherEmissionService } from "./voucher-emission.service";
import { EmissionPlanService } from "./emission-plan.service";
import type { IssuedVoucher } from "./voucher-emission.types";
import type { VoucherDetail, VoucherListEntry } from "./voucher-tables";

export type { IssuedVoucher } from "./voucher-emission.types";

@Injectable()
export class VouchersService {
  constructor(
    private readonly access: VoucherAccessService,
    private readonly emission: VoucherEmissionService,
    private readonly plans: EmissionPlanService,
  ) {}

  get(userId: string, id: string): Promise<VoucherDetail> {
    return this.access.get(userId, id);
  }

  getForApiClient(apiClient: AuthenticatedApiClient, id: string): Promise<VoucherDetail> {
    return this.access.getForApiClient(apiClient, id);
  }

  async listByIssuer(userId: string, issuerId: string): Promise<VoucherListEntry[]> {
    await this.access.findOwnedIssuer(userId, issuerId);
    return await this.access.listForIssuer(issuerId);
  }

  async listForApiClient(
    apiClient: AuthenticatedApiClient,
    issuerId: string,
    limit?: number,
  ): Promise<VoucherListEntry[]> {
    await this.access.assertGranted(apiClient, issuerId);
    return await this.access.listForIssuer(issuerId, limit);
  }

  async buildQrPngBuffer(userId: string, id: string): Promise<Buffer> {
    const voucher = await this.get(userId, id);
    if (!hasText(voucher.qrData)) {
      throw new NotFoundException("El comprobante no tiene QR (no autorizado).");
    }
    return await renderQrPng(voucher.qrData);
  }

  async renderPdf(userId: string, id: string): Promise<Buffer> {
    return await this.buildPdf(await this.get(userId, id));
  }

  async renderPdfForApiClient(apiClient: AuthenticatedApiClient, id: string): Promise<Buffer> {
    return await this.buildPdf(await this.getForApiClient(apiClient, id));
  }

  async issue(userId: string, input: IssueVoucher, idempotencyKey?: string): Promise<IssuedVoucher> {
    const issuer = await this.access.findOwnedIssuer(userId, input.issuerId);
    return await this.emission.issueAuthorized(issuer, input, idempotencyKey);
  }

  async issueForApiClient(
    apiClient: AuthenticatedApiClient,
    input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> {
    await this.access.assertIssuerExists(input.issuerId);
    const issuer = await this.access.findGrantedIssuer(apiClient, input.issuerId);
    return await this.emission.issueAuthorized(issuer, input, idempotencyKey);
  }

  async previewForUser(userId: string, input: IssueVoucher): Promise<VoucherAmounts> {
    await this.access.findOwnedIssuer(userId, input.issuerId);
    return calculateAmounts(input.voucherType, input.items, input.tributes);
  }

  async previewForApiClient(apiClient: AuthenticatedApiClient, input: IssueVoucher): Promise<VoucherAmounts> {
    await this.access.assertGranted(apiClient, input.issuerId);
    return calculateAmounts(input.voucherType, input.items, input.tributes);
  }

  async computeEmissionPlanForUser(userId: string, input: IssueVoucher): Promise<EmissionPlan> {
    const issuer = await this.access.findOwnedIssuer(userId, input.issuerId);
    return await this.plans.computeEmissionPlan(issuer, input);
  }

  async computeEmissionPlanForApiClient(
    apiClient: AuthenticatedApiClient,
    input: IssueVoucher,
  ): Promise<EmissionPlan> {
    const issuer = await this.access.findGrantedIssuer(apiClient, input.issuerId);
    return await this.plans.computeEmissionPlan(issuer, input);
  }

  private async buildPdf(voucher: VoucherDetail): Promise<Buffer> {
    if (!hasText(voucher.qrData) || !hasText(voucher.cae)) {
      throw new NotFoundException("El comprobante no está autorizado todavía (sin CAE/QR).");
    }
    const qrPng = await renderQrPng(voucher.qrData);
    return await renderVoucherPdf(
      buildVoucherPdfData({ ...voucher, qrData: voucher.qrData, cae: voucher.cae }, qrPng),
    );
  }
}
