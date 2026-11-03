import { describe, expect, it } from "vitest";
import { redactDocumentId, validateDocumentId } from "./document.js";

describe("validateDocumentId", () => {
  it("accepts DNI with dots", () => {
    expect(validateDocumentId("12.345.678")).toBe("12345678");
  });

  it("accepts passport-like alphanumerics", () => {
    expect(validateDocumentId("AB123456")).toBe("AB123456");
  });

  it("rejects empty or short", () => {
    expect(validateDocumentId("")).toBeNull();
    expect(validateDocumentId("123")).toBeNull();
  });
});

describe("redactDocumentId", () => {
  it("masks middle", () => {
    expect(redactDocumentId("12345678")).toBe("12***78");
  });
});
