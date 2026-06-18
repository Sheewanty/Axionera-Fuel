import {
  calcLitresSold,
  calcExpectedAmount,
  calcNozzleVariance,
  calcHqSettlement,
  calcTankMeterSold,
  calcTankVariance,
  calcExpectedTankAfterDischarge,
  calcDischargeVariance,
  calcMartNetSales,
  calcMartVariance,
  calcLubeBayLubricantAmount,
  calcLubeBayTotalExpected,
  calcLubeBayVariance,
  calcNetCashPosition,
  calcNetExpenditure,
  calcPhysicalCashToBank,
  calcCashCollectionVariance,
  calcTotalAccountedSales,
  varianceSeverity,
} from "@/lib/calculations";

describe("calcLitresSold", () => {
  it("returns positive difference of meters", () => {
    expect(calcLitresSold(1500, 1000)).toBe(500);
  });
  it("returns 0 when current === previous (no sales)", () => {
    expect(calcLitresSold(1000, 1000)).toBe(0);
  });
  it("returns NEGATIVE value when current < previous (meter rollback — must be flagged by caller)", () => {
    // Callers must check for negative and throw/flag — not silently accept
    expect(calcLitresSold(900, 1000)).toBe(-100);
  });
});

describe("calcExpectedAmount", () => {
  it("multiplies litres by price", () => {
    expect(calcExpectedAmount(100, 21.5)).toBeCloseTo(2150);
  });
  it("handles zero litres", () => {
    expect(calcExpectedAmount(0, 21.5)).toBe(0);
  });
});

describe("calcNozzleVariance", () => {
  it("positive when total collected > expected", () => {
    // 2000 cash + 200 gocard = 2200. Expected 2150. Variance +50.
    expect(calcNozzleVariance(2000, 200, 0, 0, 0, 2150)).toBeCloseTo(50);
  });
  it("negative when total collected < expected", () => {
    expect(calcNozzleVariance(2000, 0, 0, 0, 0, 2150)).toBeCloseTo(-150);
  });
});

describe("calcHqSettlement", () => {
  it("sums all non-cash channels", () => {
    expect(calcHqSettlement(100, 50, 25, 10)).toBe(185);
  });
});

describe("calcTankMeterSold", () => {
  it("sums litresSold across readings", () => {
    const readings = [{ litresSold: 100 }, { litresSold: 250 }, { litresSold: 75 }];
    expect(calcTankMeterSold(readings)).toBe(425);
  });
  it("returns 0 for empty array", () => {
    expect(calcTankMeterSold([])).toBe(0);
  });
});

describe("calcTankVariance", () => {
  it("positive variance means gain", () => {
    // opening 5000 + receipts 2000 - meter 1000 - closing 5800 = 200 gain
    expect(calcTankVariance(5000, 2000, 1000, 5800)).toBe(200);
  });
  it("negative variance means loss", () => {
    // opening 5000 + receipts 2000 - meter 1000 - closing 6100 = -100 loss
    expect(calcTankVariance(5000, 2000, 1000, 6100)).toBe(-100);
  });
});

describe("calcExpectedTankAfterDischarge", () => {
  it("sums before tank + discharged + top up", () => {
    expect(calcExpectedTankAfterDischarge(5000, 1000, 50)).toBe(6050);
  });
});

describe("calcDischargeVariance", () => {
  it("returns zero when after tank matches expected", () => {
    expect(calcDischargeVariance(6000, 6000)).toBe(0);
  });
  it("returns negative when after tank is less than expected (loss)", () => {
    expect(calcDischargeVariance(5950, 6000)).toBe(-50);
  });
  it("returns positive when after tank is more than expected (gain)", () => {
    expect(calcDischargeVariance(6050, 6000)).toBe(50);
  });
});

describe("calcMartNetSales", () => {
  it("adds sales and deducts returns", () => {
    expect(calcMartNetSales(500, 200, 100, 50)).toBe(750);
  });
});

describe("calcMartVariance", () => {
  it("returns physical cash count minus mart cash sales", () => {
    expect(calcMartVariance(800, 750)).toBe(50);
  });
});

describe("lube bay calculations", () => {
  it("calculates lubricant amount", () => {
    expect(calcLubeBayLubricantAmount(4, 85)).toBe(340);
  });

  it("calculates total expected sales", () => {
    expect(calcLubeBayTotalExpected(340, 50, 120, 10)).toBe(500);
  });

  it("calculates variance across payment channels", () => {
    expect(calcLubeBayVariance(200, 100, 100, 100, 500)).toBe(0);
    expect(calcLubeBayVariance(200, 100, 100, 50, 500)).toBe(-50);
  });
});

describe("calcNetExpenditure", () => {
  it("subtracts bank payment from gross", () => {
    expect(calcNetExpenditure(1000, 200)).toBe(800);
  });
});

describe("calcPhysicalCashToBank", () => {
  it("subtracts net expenditure from total cash received", () => {
    expect(calcPhysicalCashToBank(10000, 500)).toBe(9500);
    expect(calcPhysicalCashToBank(5000, 5000)).toBe(0);
  });
});

describe("calcCashCollectionVariance", () => {
  it("calculates difference between amount to bank and expected cash", () => {
    expect(calcCashCollectionVariance(10000, 10000)).toBe(0);
    expect(calcCashCollectionVariance(10500, 10000)).toBe(500); // over
    expect(calcCashCollectionVariance(9000, 10000)).toBe(-1000); // short
  });
});

describe("calcTotalAccountedSales", () => {
  it("sums physical cash, HQ settlement, and net expenditure", () => {
    expect(calcTotalAccountedSales(4200, 1000, 800)).toBe(6000);
  });
});

describe("calcNetCashPosition", () => {
  it("banked + mart - expenditure", () => {
    expect(calcNetCashPosition(10000, 5000, 2000)).toBe(13000);
  });
});

describe("varianceSeverity", () => {
  it("ok for zero", () => expect(varianceSeverity(0)).toBe("ok"));
  it("ok for small positive", () => expect(varianceSeverity(200)).toBe("ok"));
  it("warning for medium", () => expect(varianceSeverity(1000)).toBe("warning"));
  it("danger for large", () => expect(varianceSeverity(3000)).toBe("danger"));
  it("uses absolute value for negatives", () => expect(varianceSeverity(-3000)).toBe("danger"));
});
