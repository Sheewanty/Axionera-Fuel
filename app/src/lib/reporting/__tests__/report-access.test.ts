import { describe, expect, it } from "vitest";
import { resolveReportStationId } from "@/lib/reporting/report-access";

describe("report access", () => {
  it("keeps tenant-wide all-station reports unscoped when the template allows it", () => {
    expect(
      resolveReportStationId({
        membershipStationId: "",
        templateStationScoped: false,
      })
    ).toBeUndefined();
  });

  it("requires a selected station for tenant-wide station-scoped reports", () => {
    expect(
      resolveReportStationId({
        membershipStationId: "",
        templateStationScoped: true,
      })
    ).toBeUndefined();

    expect(
      resolveReportStationId({
        membershipStationId: "",
        requestedStationId: "station-1",
        templateStationScoped: true,
      })
    ).toBe("station-1");
  });

  it("constrains station-scoped users to a station when no station is requested", () => {
    expect(
      resolveReportStationId({
        membershipStationId: "station-1",
        templateStationScoped: false,
      })
    ).toBe("station-1");
  });
});
