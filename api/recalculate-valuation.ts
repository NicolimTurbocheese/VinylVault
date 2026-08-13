import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGeminiClient, calculateSmartDynamicValuation } from "./_lib/shared";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      albumTitle,
      artist,
      catalogueNumber,
      country = "US",
      label,
      baseMintValue,
      mediaGrade = "NM",
      sleeveGrade = "NM",
      obiCondition = "N/A",
      packageInclusions,
      freeTextNotes = ""
    } = req.body || {};

    let effectiveBaseMintValue = baseMintValue;
    if (!effectiveBaseMintValue || (effectiveBaseMintValue.median >= 75 && effectiveBaseMintValue.median <= 88 && (effectiveBaseMintValue.low === 40 || effectiveBaseMintValue.low === 45))) {
      effectiveBaseMintValue = calculateSmartDynamicValuation({
        albumTitle,
        artist,
        catalogueNumber,
        country,
        label
      });
    }

    const GOLDMINE_MULTIPLIERS: Record<string, number> = {
      'M': 1.0,
      'NM': 0.88,
      'VG+': 0.75,
      'VG': 0.55,
      'G': 0.35,
      'F_P': 0.15
    };

    const mediaMult = GOLDMINE_MULTIPLIERS[mediaGrade] || 0.88;
    const sleeveMult = GOLDMINE_MULTIPLIERS[sleeveGrade] || 0.88;
    const combinedConditionMult = mediaMult * 0.7 + sleeveMult * 0.3;

    const baselineValue = {
      low: Math.round(effectiveBaseMintValue.low * combinedConditionMult),
      median: Math.round(effectiveBaseMintValue.median * combinedConditionMult),
      high: Math.round(effectiveBaseMintValue.high * combinedConditionMult),
    };

    let aiResult: any = null;

    try {
      const ai = getGeminiClient();
      if (ai) {
        const systemInstruction = `You are VinylVault AI, an expert vinyl record market valuation and condition appraiser.
You are given a vinyl record release profile, its baseline value after Goldmine condition grading, its OBI strip condition (grades 'M', 'NM', 'VG+', 'VG', 'G', 'F_P', or 'N/A' for no OBI), physical package inclusions (Printed Inner Sleeve, Lyrics Insert / Sheet, Booklet / Liner Notes, Original Poster, Photos / Postcards), and free-text notes detailing specific copy characteristics.

Analyze how these specific factors increase or decrease the market value in Singapore Dollars (SGD).
CRITICAL RULES:
1. Missing OBIs or 'N/A' OBI condition must NEVER be discounted or penalized. Present OBI strips receive a positive market value premium scaled to their grade (e.g. M +35%, NM +30%, VG+ +20%, VG +15%, G +10%, F_P +5%).
2. Physical Package Inclusions: Present original inclusions add value (Printed Inner Sleeve +4%, Lyrics Insert +5%, Booklet/Liner Notes +8%, Original Poster +15%, Photos/Postcards +8%).
3. STRICT NO DOUBLE COUNTING: Do NOT apply a free-text adjustment for an item (e.g. OBI, poster, booklet, insert) if it is already selected in OBI condition or Physical Package Inclusions. Free-text adjustments must ONLY apply to distinct copy characteristics (e.g., artist signature, Everclean red wax +35%, Sample / Promo copy +25%, colored vinyl variant, promo stamp, play scratches -15%, edge warps -20%).

Return ONLY a valid JSON object matching this schema:
{
  "obiAdjustment": {
    "feature": "OBI Strip Condition",
    "impactType": "increase", // "increase" or "neutral"
    "amountSGD": 30,
    "percentage": 25,
    "explanation": "Japanese issue with NM OBI strip adds significant collector value."
  },
  "inclusionsAdjustments": [
    {
      "feature": "Original Poster Intact",
      "impactType": "increase",
      "amountSGD": 15,
      "percentage": 15,
      "explanation": "Includes original release wall poster in pristine condition."
    }
  ],
  "freeTextAdjustments": [
    {
      "feature": "Autographed by Artist",
      "impactType": "increase",
      "amountSGD": 50,
      "percentage": 40,
      "explanation": "Verified artist signature adds collector premium."
    }
  ],
  "netAdditionalAdjustmentSGD": 80,
  "finalValuation": {
    "low": 120,
    "median": 180,
    "high": 250
  },
  "valuationRationale": "Summary of how baseline condition, physical inclusions, and copy features adjusted the valuation."
}`;

        const inclusionsStr = packageInclusions
          ? [
              packageInclusions.printedInnerSleeve ? "Printed Inner Sleeve" : null,
              packageInclusions.lyricsInsert ? "Lyrics Insert / Sheet" : null,
              packageInclusions.bookletLinerNotes ? "Booklet / Liner Notes" : null,
              packageInclusions.originalPoster ? "Original Poster" : null,
              packageInclusions.photosPostcards ? "Photos / Postcards" : null,
            ].filter(Boolean).join(", ") || "None selected"
          : "Standard default package";

        const prompt = `Calculate exact market valuation adjustment for this vinyl copy:
Album: ${albumTitle} by ${artist}
Label/Cat#: ${label} (${catalogueNumber})
Country: ${country}
Base Mint Value Range: S${effectiveBaseMintValue.low} - S${effectiveBaseMintValue.median} - S${effectiveBaseMintValue.high}
Media Grade: ${mediaGrade} (${Math.round(mediaMult * 100)}% value)
Sleeve Grade: ${sleeveGrade} (${Math.round(sleeveMult * 100)}% value)
Calculated Baseline Condition Value: S${baselineValue.median} (Range: S${baselineValue.low} - S${baselineValue.high})
OBI Strip Condition: ${obiCondition}
Physical Package Inclusions Present: ${inclusionsStr}
User-Provided Free Text Notes / Characteristics: "${freeTextNotes || 'None'}"`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.1,
          },
        });

        if (response && response.text) {
          let jsonStr = response.text.trim();
          if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/```$/, "").trim();
          } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/^```\s*/, "").replace(/```$/, "").trim();
          }
          aiResult = JSON.parse(jsonStr);
        }
      }
    } catch (err: any) {
      console.warn("[VinylVault Recalculate AI Warning]: Fallback engine engaged", err?.message || err);
    }

    // Fallback valuation engine if AI response unavailable or failed
    if (!aiResult) {
      let obiAdj: any = null;
      let netExtraSGD = 0;
      const inclusionsAdjustments: any[] = [];
      const freeTextAdjustments: any[] = [];

      const baseMedian = baselineValue.median;

      // OBI calculation (Goldmine grades M, NM, VG+, VG, G, F_P or N/A)
      const OBI_PREMIUMS: Record<string, number> = {
        'M': 35,
        'NM': 30,
        'VG+': 20,
        'VG': 15,
        'G': 10,
        'F_P': 5
      };

      if (obiCondition !== "N/A" && OBI_PREMIUMS[obiCondition] !== undefined) {
        const pct = OBI_PREMIUMS[obiCondition];
        const amt = Math.round(baseMedian * (pct / 100));
        if (amt > 0) {
          netExtraSGD += amt;
          obiAdj = {
            feature: `Original OBI Strip (${obiCondition} Condition)`,
            impactType: "increase",
            amountSGD: amt,
            percentage: pct,
            explanation: `Original OBI strip in ${obiCondition} condition adds a +${pct}% collector premium.`
          };
        }
      }

      // Package inclusions calculation
      if (packageInclusions) {
        if (packageInclusions.printedInnerSleeve) {
          const amt = Math.round(baseMedian * 0.04);
          netExtraSGD += amt;
          inclusionsAdjustments.push({
            feature: "Printed Inner Sleeve",
            impactType: "increase",
            amountSGD: amt,
            percentage: 4,
            explanation: "Original custom printed inner sleeve present (+4%)."
          });
        }
        if (packageInclusions.lyricsInsert) {
          const amt = Math.round(baseMedian * 0.05);
          netExtraSGD += amt;
          inclusionsAdjustments.push({
            feature: "Lyrics Insert / Sheet",
            impactType: "increase",
            amountSGD: amt,
            percentage: 5,
            explanation: "Original lyrics sheet/insert present (+5%)."
          });
        }
        if (packageInclusions.bookletLinerNotes) {
          const amt = Math.round(baseMedian * 0.08);
          netExtraSGD += amt;
          inclusionsAdjustments.push({
            feature: "Booklet / Liner Notes",
            impactType: "increase",
            amountSGD: amt,
            percentage: 8,
            explanation: "Original photo booklet / archival liner notes present (+8%)."
          });
        }
        if (packageInclusions.originalPoster) {
          const amt = Math.round(baseMedian * 0.15);
          netExtraSGD += amt;
          inclusionsAdjustments.push({
            feature: "Original Poster",
            impactType: "increase",
            amountSGD: amt,
            percentage: 15,
            explanation: "Original intact release wall poster present (+15%)."
          });
        }
        if (packageInclusions.photosPostcards) {
          const amt = Math.round(baseMedian * 0.08);
          netExtraSGD += amt;
          inclusionsAdjustments.push({
            feature: "Photos / Postcards",
            impactType: "increase",
            amountSGD: amt,
            percentage: 8,
            explanation: "Original band portrait photos / postcards present (+8%)."
          });
        }
      }

      // Free text parsing
      const text = (freeTextNotes || "").toLowerCase();
      if (text.includes("signed") || text.includes("autograph") || text.includes("inscribed")) {
        const amt = Math.round(baseMedian * 0.50);
        netExtraSGD += amt;
        freeTextAdjustments.push({
          feature: "Verified Artist Signature / Autograph",
          impactType: "increase",
          amountSGD: amt,
          percentage: 50,
          explanation: "Signatures by key band members add substantial market value (+50%)."
        });
      }

      if (text.includes("poster") || text.includes("insert") || text.includes("booklet") || text.includes("hype sticker") || text.includes("obi")) {
        if (!text.includes("missing poster") && !text.includes("no poster") && !text.includes("missing insert")) {
          const amt = Math.round(baseMedian * 0.15);
          netExtraSGD += amt;
          freeTextAdjustments.push({
            feature: "Includes Original Inserts / Poster / Hype Sticker",
            impactType: "increase",
            amountSGD: amt,
            percentage: 15,
            explanation: "Complete archival ephemera adds itemized value (+15%)."
          });
        }
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

      aiResult = {
        obiAdjustment: obiAdj,
        inclusionsAdjustments,
        freeTextAdjustments,
        netAdditionalAdjustmentSGD: netExtraSGD,
        finalValuation: {
          low: finalLow,
          median: finalMedian,
          high: finalHigh
        },
        valuationRationale: `Baseline Goldmine ${mediaGrade} media / ${sleeveGrade} sleeve valuation is S${baselineValue.median}. ${
          netExtraSGD >= 0 ? `Physical package inclusions and extra features added +S${netExtraSGD}` : `Defects/missing items reduced value by S${Math.abs(netExtraSGD)}`
        }, resulting in an updated median estimated value of S${finalMedian}.`
      };
    }

    const responseData = {
      baselineValue,
      mediaGrade,
      sleeveGrade,
      obiCondition,
      obiAdjustment: aiResult.obiAdjustment || null,
      packageInclusions,
      inclusionsAdjustments: aiResult.inclusionsAdjustments || [],
      freeTextNotes,
      freeTextAdjustments: aiResult.freeTextAdjustments || [],
      netAdditionalAdjustmentSGD: aiResult.netAdditionalAdjustmentSGD ?? 0,
      finalValuation: aiResult.finalValuation || baselineValue,
      valuationRationale: aiResult.valuationRationale || "Valuation updated successfully."
    };

    return res.json(responseData);
  } catch (err: any) {
    console.error("Error in /api/recalculate-valuation:", err);
    return res.status(500).json({ error: err.message || "Failed to recalculate valuation." });
  }
}
