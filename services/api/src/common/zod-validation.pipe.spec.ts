import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const errorsSchema = z.object({
  message: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })),
});
import { ZodValidationPipe } from "./zod-validation.pipe";

const pipe = new ZodValidationPipe(z.object({ cuit: z.string().length(11), total: z.number().positive() }));

describe("ZodValidationPipe", () => {
  it("devuelve el valor ya parseado cuando es válido", () => {
    expect(pipe.transform({ cuit: "20111111112", total: 100, extra: "se descarta" })).toEqual({
      cuit: "20111111112",
      total: 100,
    });
  });

  it("rechaza con un 400 que nombra cada campo inválido", () => {
    let caught: unknown;
    try {
      pipe.transform({ cuit: "1", total: -1 });
    } catch (error) {
      caught = error;
    }

    if (!(caught instanceof BadRequestException)) throw new Error("No rechazó con un 400.");
    const response = errorsSchema.parse(caught.getResponse());
    expect(response.message).toBe("Payload inválido");
    expect(response.errors.map((error) => error.path)).toEqual(["cuit", "total"]);
  });
});
