import type { Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";

export interface TestDouble {
  token: Type | string | symbol;
  value: object;
}

export async function instantiateWithDoubles<Instance>(
  target: Type<Instance>,
  doubles: readonly TestDouble[],
): Promise<Instance> {
  const providers = doubles.map((double) => ({ provide: double.token, useValue: double.value }));
  const moduleRef = await Test.createTestingModule({ providers: [target, ...providers] }).compile();
  return await moduleRef.get(target);
}
