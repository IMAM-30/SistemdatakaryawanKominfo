import { describe, expect, it } from "vitest";
import { dateForDisplay, dateForStorage } from "@/lib/date-format";

describe("employee date presentation", () => {
  it("shows existing ISO dates as day/month/year without changing stored data", () => {
    expect(dateForDisplay("2026-10-03")).toBe("03/10/2026");
    expect(dateForDisplay("2026-10-03T00:00:00.000Z")).toBe("03/10/2026");
  });

  it("converts Indonesian date input back to the existing ISO storage contract", () => {
    expect(dateForStorage("03/10/2026")).toBe("2026-10-03");
    expect(dateForStorage("29/02/2024")).toBe("2024-02-29");
  });

  it("rejects impossible or ambiguous dates", () => {
    expect(dateForStorage("31/02/2026")).toBeNull();
    expect(dateForStorage("10/03/26")).toBeNull();
    expect(dateForStorage("03/10/2026 extra")).toBeNull();
  });
});
