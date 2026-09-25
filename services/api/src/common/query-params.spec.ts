import { parseOptionalDate, parseOptionalNumber } from "./query-params";

describe("parseOptionalDate", () => {
  it("returns undefined for missing or empty values", () => {
    expect(parseOptionalDate(undefined)).toBeUndefined();
    expect(parseOptionalDate(null)).toBeUndefined();
    expect(parseOptionalDate("")).toBeUndefined();
  });

  it("parses a present value as a date", () => {
    expect(parseOptionalDate("2026-07-01")).toEqual(new Date("2026-07-01"));
  });
});

describe("parseOptionalNumber", () => {
  it("returns undefined for missing or empty values", () => {
    expect(parseOptionalNumber(undefined)).toBeUndefined();
    expect(parseOptionalNumber("")).toBeUndefined();
  });

  it("converts a present value with Number", () => {
    expect(parseOptionalNumber("25")).toBe(25);
    expect(parseOptionalNumber("abc")).toBeNaN();
  });
});
