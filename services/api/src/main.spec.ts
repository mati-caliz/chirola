import { Logger } from "@nestjs/common";

const mockApp = {
  set: jest.fn(),
  setGlobalPrefix: jest.fn(),
  useGlobalPipes: jest.fn<undefined, [unknown]>(),
  listen: jest.fn(() => Promise.resolve()),
};

jest.mock("./app.module", () => ({ AppModule: Symbol("AppModule") }));
jest.mock("@nestjs/core", () => ({ NestFactory: { create: jest.fn(() => Promise.resolve(mockApp)) } }));

const DEFAULT_PORT = 3000;

async function boot(environment: Record<string, string | undefined>): Promise<void> {
  const previous = { ...process.env };
  Object.assign(process.env, environment);
  for (const [name, value] of Object.entries(environment)) {
    if (value === undefined) Reflect.deleteProperty(process.env, name);
  }
  try {
    await jest.isolateModulesAsync(async () => {
      await import("./main");
    });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    process.env = previous;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Logger.prototype, "log").mockImplementation();
});

describe("arranque de la API", () => {
  it("expone todo bajo /api, valida los cuerpos y escucha en el puerto por defecto", async () => {
    await boot({ PORT: undefined, TRUST_PROXY: undefined });

    expect(mockApp.setGlobalPrefix).toHaveBeenCalledWith("api");
    expect(mockApp.useGlobalPipes.mock.calls[0]?.[0]).toMatchObject({
      isTransformEnabled: true,
      validatorOptions: { whitelist: true },
    });
    expect(mockApp.listen).toHaveBeenCalledWith(DEFAULT_PORT);
    expect(mockApp.set).not.toHaveBeenCalled();
  });

  it("confía en el proxy configurado y usa el puerto del entorno", async () => {
    await boot({ PORT: "4100", TRUST_PROXY: "loopback" });

    expect(mockApp.set).toHaveBeenCalledWith("trust proxy", "loopback");
    expect(mockApp.listen).toHaveBeenCalledWith("4100");
  });

  it("no toca el proxy si la variable viene vacía", async () => {
    await boot({ TRUST_PROXY: "" });

    expect(mockApp.set).not.toHaveBeenCalled();
  });
});
