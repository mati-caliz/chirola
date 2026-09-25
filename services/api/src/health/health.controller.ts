import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string; service: string; ts: string } {
    return { status: "ok", service: "chirola-api", ts: new Date().toISOString() };
  }
}
