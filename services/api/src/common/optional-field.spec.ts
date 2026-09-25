import { optionalField } from "./optional-field";

describe("optionalField", () => {
  it("omits the key when the value is undefined", () => {
    expect(optionalField("alias", undefined)).toEqual({});
    expect(Object.keys(optionalField("alias", undefined))).toHaveLength(0);
  });

  it("keeps null and falsy values", () => {
    expect(optionalField("legalName", null)).toEqual({ legalName: null });
    expect(optionalField("count", 0)).toEqual({ count: 0 });
    expect(optionalField("name", "")).toEqual({ name: "" });
  });

  it("keeps a present value under its key", () => {
    expect(optionalField("alias", "chirola")).toEqual({ alias: "chirola" });
  });
});
