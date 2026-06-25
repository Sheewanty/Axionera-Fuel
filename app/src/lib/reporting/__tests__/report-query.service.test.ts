import { describe, expect, it } from "vitest";
import { reportRunScope } from "@/lib/reporting/report-query.service";

describe("report query scope", () => {
  it("allows tenant-wide memberships to query all tenant report runs", () => {
    expect(reportRunScope("tenant-1", "")).toEqual({ tenantId: "tenant-1" });
  });

  it("constrains station memberships to their station reports", () => {
    expect(reportRunScope("tenant-1", "station-1")).toEqual({
      tenantId: "tenant-1",
      stationId: "station-1",
    });
  });
});
