import { describe, expect, it } from "vitest";
import { MemoryVisionClient } from "./vision-client.js";

describe("MemoryVisionClient", () => {
  it("parses valid traits", async () => {
    const client = new MemoryVisionClient(() => ({
      summary: "Gato naranja",
      colors: ["naranja"],
      markings: ["rayas"],
      notableFeatures: [],
    }));
    const traits = await client.analyzeAnimalPhotos([
      { mime: "image/jpeg", base64: "aaa" },
    ]);
    expect(traits.summary).toBe("Gato naranja");
  });

  it("retries invalid JSON then throws", async () => {
    let calls = 0;
    const client = new MemoryVisionClient(() => {
      calls += 1;
      return { bad: true };
    });
    await expect(
      client.analyzeAnimalPhotos([{ mime: "image/jpeg", base64: "x" }]),
    ).rejects.toThrow();
    expect(calls).toBe(2);
  });

  it("retries thrown errors once", async () => {
    let calls = 0;
    const client = new MemoryVisionClient(() => {
      calls += 1;
      throw new Error("provider down");
    });
    await expect(
      client.analyzeAnimalPhotos([{ mime: "image/jpeg", base64: "x" }]),
    ).rejects.toThrow(/provider down/);
    expect(calls).toBe(2);
  });
});
