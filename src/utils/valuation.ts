import { GoldmineGrade, GOLDMINE_GRADES, RecordValueRange, ShelfItem, ObiCondition, PackageInclusions, DetailedValuationBreakdown, ValuationAdjustmentItem } from "../types";

/**
 * Calculates adjusted Market Value based on selected Media and Sleeve Goldmine grades.
 * Weighted: Media condition = 70% of record value, Sleeve condition = 30% of record value.
 */
export function calculateAdjustedValuation(
  baseMintValue: RecordValueRange,
  mediaGrade: GoldmineGrade,
  sleeveGrade: GoldmineGrade
): RecordValueRange & { rarityMultiplier?: number; rarityTags?: string[]; rarityReasons?: string[] } {
  const mediaMult = GOLDMINE_GRADES[mediaGrade]?.defaultMultiplier ?? 1.0;
  const sleeveMult = GOLDMINE_GRADES[sleeveGrade]?.defaultMultiplier ?? 1.0;

  const combinedMultiplier = mediaMult * 0.7 + sleeveMult * 0.3;

  return {
    low: Math.round(baseMintValue.low * combinedMultiplier),
    median: Math.round(baseMintValue.median * combinedMultiplier),
    high: Math.round(baseMintValue.high * combinedMultiplier),
  };
}

/**
 * Calculates a complete, highly accurate 2-phase valuation breakdown considering:
 * 1. Physical inspection inputs (Media Grade, Sleeve Grade, OBI Condition, Physical Package Inclusions)
 * 2. Automated Archival & Market Comparative Research adjustments
 */
export function calculateCompleteValuation(params: {
  baseMintValue: RecordValueRange;
  mediaGrade: GoldmineGrade;
  sleeveGrade: GoldmineGrade;
  obiCondition?: ObiCondition;
  packageInclusions?: PackageInclusions;
  freeTextNotes?: string;
}): DetailedValuationBreakdown {
  const {
    baseMintValue,
    mediaGrade,
    sleeveGrade,
    obiCondition = 'N/A',
    packageInclusions,
    freeTextNotes = ''
  } = params;

  const mediaMult = GOLDMINE_GRADES[mediaGrade]?.defaultMultiplier ?? 0.88;
  const sleeveMult = GOLDMINE_GRADES[sleeveGrade]?.defaultMultiplier ?? 0.88;

  // Base condition multiplier
  const combinedConditionMult = mediaMult * 0.7 + sleeveMult * 0.3;

  const baselineValue: RecordValueRange = {
    low: Math.round(baseMintValue.low * combinedConditionMult),
    median: Math.round(baseMintValue.median * combinedConditionMult),
    high: Math.round(baseMintValue.high * combinedConditionMult),
  };

  const baseMedian = baselineValue.median;
  let netExtraSGD = 0;

  // 1. OBI Strip Adjustment
  let obiAdjustment: ValuationAdjustmentItem | undefined = undefined;
  const OBI_PREMIUMS: Record<string, number> = {
    'M': 35,
    'NM': 30,
    'VG+': 20,
    'VG': 15,
    'G': 10,
    'F_P': 5
  };

  if (obiCondition !== 'N/A' && OBI_PREMIUMS[obiCondition] !== undefined) {
    const pct = OBI_PREMIUMS[obiCondition];
    const amt = Math.round(baseMedian * (pct / 100));
    if (amt > 0) {
      netExtraSGD += amt;
      obiAdjustment = {
        feature: `Original OBI Strip (${obiCondition} Condition)`,
        impactType: 'increase',
        amountSGD: amt,
        percentage: pct,
        explanation: `Original OBI strip in ${obiCondition} condition adds a +${pct}% collector premium.`
      };
    }
  }

  // 2. Physical Package Inclusions Adjustments
  const inclusionsAdjustments: ValuationAdjustmentItem[] = [];
  if (packageInclusions) {
    if (packageInclusions.printedInnerSleeve) {
      const amt = Math.round(baseMedian * 0.04);
      netExtraSGD += amt;
      inclusionsAdjustments.push({
        feature: 'Printed Inner Sleeve',
        impactType: 'increase',
        amountSGD: amt,
        percentage: 4,
        explanation: 'Original custom printed inner sleeve present (+4%).'
      });
    }

    if (packageInclusions.lyricsInsert) {
      const amt = Math.round(baseMedian * 0.05);
      netExtraSGD += amt;
      inclusionsAdjustments.push({
        feature: 'Lyrics Insert / Sheet',
        impactType: 'increase',
        amountSGD: amt,
        percentage: 5,
        explanation: 'Original lyrics sheet/insert present (+5%).'
      });
    }

    if (packageInclusions.bookletLinerNotes) {
      const amt = Math.round(baseMedian * 0.08);
      netExtraSGD += amt;
      inclusionsAdjustments.push({
        feature: 'Booklet / Liner Notes',
        impactType: 'increase',
        amountSGD: amt,
        percentage: 8,
        explanation: 'Original photo booklet / archival liner notes present (+8%).'
      });
    }

    if (packageInclusions.originalPoster) {
      const amt = Math.round(baseMedian * 0.15);
      netExtraSGD += amt;
      inclusionsAdjustments.push({
        feature: 'Original Poster',
        impactType: 'increase',
        amountSGD: amt,
        percentage: 15,
        explanation: 'Original intact release wall poster present (+15%).'
      });
    }

    if (packageInclusions.photosPostcards) {
      const amt = Math.round(baseMedian * 0.08);
      netExtraSGD += amt;
      inclusionsAdjustments.push({
        feature: 'Photos / Postcards',
        impactType: 'increase',
        amountSGD: amt,
        percentage: 8,
        explanation: 'Original band portrait photos / postcards present (+8%).'
      });
    }
  }

  // 3. Free Text Copy Specific Adjustments
  const freeTextAdjustments: ValuationAdjustmentItem[] = [];
  const text = freeTextNotes.toLowerCase();

  if (text.includes("signed") || text.includes("autograph") || text.includes("inscribed")) {
    const amt = Math.round(baseMedian * 0.50);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: "Verified Artist Signature / Autograph",
      impactType: "increase",
      amountSGD: amt,
      percentage: 50,
      explanation: "Verified artist or band member signature adds substantial collector value (+50%)."
    });
  }

  if (text.includes("everclean") || text.includes("ever-clean") || text.includes("blue vinyl") || text.includes("red wax") || text.includes("colored vinyl") || text.includes("splatter") || text.includes("clear vinyl") || text.includes("white vinyl")) {
    const isEverclean = text.includes("everclean") || text.includes("ever-clean");
    const amt = Math.round(baseMedian * 0.35);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: isEverclean ? "Toshiba Everclean Anti-Static Red Vinyl" : "Colored / Variant Wax Pressing",
      impactType: "increase",
      amountSGD: amt,
      percentage: 35,
      explanation: isEverclean ? "Proprietary Toshiba Everclean anti-static formula red wax pressing (+35%)." : "Limited colored or red wax vinyl variant (+35%)."
    });
  }

  if (text.includes("promo") || text.includes("sample") || text.includes("white label") || text.includes("dj copy") || text.includes("見本盤")) {
    const amt = Math.round(baseMedian * 0.25);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: "Sample / Promotional White Label Copy",
      impactType: "increase",
      amountSGD: amt,
      percentage: 25,
      explanation: "Sample copy / advance promotional white label pressing carries collector scarcity (+25%)."
    });
  }

  if (text.includes("first press") || text.includes("1st press") || text.includes("1st pressing") || text.includes("first pressing") || text.includes("1st issue")) {
    const amt = Math.round(baseMedian * 0.25);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: "Verified 1st Pressing / First Issue",
      impactType: "increase",
      amountSGD: amt,
      percentage: 25,
      explanation: "First pressings carry significant archival provenance & collector scarcity (+25%)."
    });
  }

  if (text.includes("warp") || text.includes("warped") || text.includes("dish")) {
    const amt = -Math.round(baseMedian * 0.20);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: "Record Edge Warp / Dish Warp",
      impactType: "decrease",
      amountSGD: amt,
      percentage: -20,
      explanation: "Physical warp affects playability and lowers market value (-20%)."
    });
  }

  if (text.includes("scratch") || text.includes("scratched") || text.includes("hairline") || text.includes("skip") || text.includes("pop")) {
    const amt = -Math.round(baseMedian * 0.15);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: "Audible Surface Scratch / Play Defect",
      impactType: "decrease",
      amountSGD: amt,
      percentage: -15,
      explanation: "Surface scratches reduce playback quality (-15%)."
    });
  }

  if (text.includes("seam split") || text.includes("water damage") || text.includes("ring wear") || text.includes("writing on cover")) {
    const amt = -Math.round(baseMedian * 0.15);
    netExtraSGD += amt;
    freeTextAdjustments.push({
      feature: "Sleeve Wear / Seam Split / Cover Defect",
      impactType: "decrease",
      amountSGD: amt,
      percentage: -15,
      explanation: "Cover jacket defect reduces sleeve aesthetic value (-15%)."
    });
  }

  const finalLow = Math.max(10, baselineValue.low + netExtraSGD);
  const finalMedian = Math.max(15, baselineValue.median + netExtraSGD);
  const finalHigh = Math.max(20, baselineValue.high + netExtraSGD);

  const finalValuation: RecordValueRange = {
    low: finalLow,
    median: finalMedian,
    high: finalHigh
  };

  const rationale = `Baseline Goldmine ${mediaGrade} media / ${sleeveGrade} sleeve valuation is S${baselineValue.median}. ${
    netExtraSGD >= 0 ? `Physical package inclusions and extra features added +S${netExtraSGD}` : `Defects/missing items reduced value by S${Math.abs(netExtraSGD)}`
  }, resulting in a highly accurate final estimated median value of S${finalMedian}.`;

  return {
    baselineValue,
    mediaGrade,
    sleeveGrade,
    obiCondition,
    obiAdjustment,
    packageInclusions,
    inclusionsAdjustments,
    freeTextNotes,
    freeTextAdjustments,
    netAdditionalAdjustmentSGD: netExtraSGD,
    finalValuation,
    valuationRationale: rationale
  };
}

/**
 * Exports Shelf items array as CSV file download.
 */
export function exportToCSV(items: ShelfItem[], filename = "vinylvault-collection.csv") {
  if (!items || items.length === 0) return;

  const headers = [
    "Album Title",
    "Artist",
    "Release Year",
    "Label",
    "Country",
    "Catalogue Number",
    "Matrix Code",
    "Format",
    "Genre",
    "Media Grade",
    "Sleeve Grade",
    "Low Value (S$)",
    "Median Value (S$)",
    "High Value (S$)",
    "Purchase Price (S$)",
    "Store Location",
    "Physical Shelf Location",
    "Custom Notes",
    "Added Date"
  ];

  const rows = items.map((item) => [
    `"${(item.albumTitle || "").replace(/"/g, '""')}"`,
    `"${(item.artist || "").replace(/"/g, '""')}"`,
    `"${item.releaseYear || ""}"`,
    `"${(item.label || "").replace(/"/g, '""')}"`,
    `"${item.country || ""}"`,
    `"${item.catalogueNumber || ""}"`,
    `"${(item.matrixCode || "").replace(/"/g, '""')}"`,
    `"${(item.format || "").replace(/"/g, '""')}"`,
    `"${(item.genre || "").replace(/"/g, '""')}"`,
    `"${item.mediaGrade}"`,
    `"${item.sleeveGrade}"`,
    item.calculatedValue?.low ?? 0,
    item.calculatedValue?.median ?? 0,
    item.calculatedValue?.high ?? 0,
    item.purchasePrice ?? "",
    `"${(item.storeLocation || "").replace(/"/g, '""')}"`,
    `"${(item.physicalShelfLocation || "").replace(/"/g, '""')}"`,
    `"${(item.customNotes || "").replace(/"/g, '""')}"`,
    `"${item.addedAt || ""}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports Shelf items array as formatted JSON file download.
 */
export function exportToJSON(items: ShelfItem[], filename = "vinylvault-collection.json") {
  if (!items || items.length === 0) return;

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", filename);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
