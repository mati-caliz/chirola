import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { JwtPayload } from "../auth/auth.service";
import { IssuersService } from "./issuers.service";
import type { ArcaCallLog } from "@prisma/client";
import { ArcaCallLogService, type ArcaCallQuery, type ArcaCallSummary } from "../arca/arca-call-log.service";
import { optionalField } from "../common/optional-field";
import { parseOptionalNumber } from "../common/query-params";

interface ArcaCallsQueryParams {
  operation?: string;
  outcome?: string;
  limit?: string;
}

function toArcaCallQuery({ operation, outcome, limit }: ArcaCallsQueryParams): ArcaCallQuery {
  return {
    ...optionalField("operation", operation),
    ...optionalField("outcome", outcome),
    ...optionalField("limit", parseOptionalNumber(limit)),
  };
}

@Controller("issuers/:issuerId/arca-calls")
@UseGuards(JwtAuthGuard)
export class ArcaCallsController {
  constructor(
    private readonly callLog: ArcaCallLogService,
    private readonly issuers: IssuersService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Param("issuerId") issuerId: string,
    @Query() query: ArcaCallsQueryParams,
  ): Promise<ArcaCallSummary[]> {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return await this.callLog.listForIssuer(issuer.id, toArcaCallQuery(query));
  }

  @Get(":callId")
  async detail(
    @CurrentUser() user: JwtPayload,
    @Param("issuerId") issuerId: string,
    @Param("callId") callId: string,
  ): Promise<ArcaCallLog> {
    const issuer = await this.issuers.getFromUser(issuerId, user.sub);
    return await this.callLog.getForIssuer(issuer.id, callId);
  }
}
