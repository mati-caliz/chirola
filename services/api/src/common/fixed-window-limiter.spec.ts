import { HttpException } from "@nestjs/common";
import { FixedWindowLimiter } from "./fixed-window-limiter";

describe("FixedWindowLimiter", () => {
  afterEach(() => jest.restoreAllMocks());

  it("permite hasta el máximo por clave y después corta con 429", () => {
    const limiter = new FixedWindowLimiter(2, 60_000);

    limiter.consume("email:a@b.com");
    limiter.consume("email:a@b.com");
    limiter.consume("email:otro@b.com");

    expect(() => limiter.consume("email:a@b.com")).toThrow(HttpException);
  });

  it("vuelve a permitir cuando vence la ventana", () => {
    const limiter = new FixedWindowLimiter(1, 1_000);
    const start = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(start);
    limiter.consume("ip:1.2.3.4");
    expect(() => limiter.consume("ip:1.2.3.4")).toThrow(HttpException);

    jest.spyOn(Date, "now").mockReturnValue(start + 1_001);
    expect(() => limiter.consume("ip:1.2.3.4")).not.toThrow();
  });
});
