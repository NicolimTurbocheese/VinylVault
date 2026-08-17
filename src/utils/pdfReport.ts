import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ShelfItem } from "../types";

export function exportValuationReportPdf(items: ShelfItem[], filename = "vinylvault-valuation-report.pdf") {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalMedian = items.reduce((sum, i) => sum + (i.calculatedValue?.median || 0), 0);
  const totalLow = items.reduce((sum, i) => sum + (i.calculatedValue?.low || 0), 0);
  const totalHigh = items.reduce((sum, i) => sum + (i.calculatedValue?.high || 0), 0);
  const totalPurchase = items.reduce((sum, i) => sum + (i.purchasePrice || 0), 0);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("VinylVault Collection Valuation Report", pageWidth / 2, 50, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleDateString()} — ${items.length} record${items.length === 1 ? "" : "s"}`, pageWidth / 2, 68, { align: "center" });

  doc.setDrawColor(200);
  doc.line(40, 82, pageWidth - 40, 82);

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Summary", 40, 105);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const summaryLines = [
    `Total records: ${items.length}`,
    `Total estimated value (median): S$${totalMedian.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `Estimated value range: S$${totalLow.toLocaleString(undefined, { maximumFractionDigits: 0 })} - S$${totalHigh.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `Total recorded purchase cost: S$${totalPurchase.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
  ];
  summaryLines.forEach((line, i) => doc.text(line, 40, 122 + i * 15));

  const rows = [...items]
    .sort((a, b) => (b.calculatedValue?.median || 0) - (a.calculatedValue?.median || 0))
    .map((i) => [
      i.albumTitle || "",
      i.artist || "",
      i.catalogueNumber || "",
      `${i.mediaGrade || ""}/${i.sleeveGrade || ""}`,
      i.purchasePrice != null ? `S$${i.purchasePrice.toFixed(2)}` : "-",
      `S$${(i.calculatedValue?.median || 0).toFixed(2)}`,
    ]);

  autoTable(doc, {
    startY: 195,
    head: [["Album", "Artist", "Cat#", "Grade (M/S)", "Purchase", "Est. Value"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [169, 74, 66], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 248, 243] },
    columnStyles: {
      0: { cellWidth: 140 },
      1: { cellWidth: 100 },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `VinylVault — page ${p} of ${pageCount} — values are estimates, not a certified appraisal`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  }

  doc.save(filename);
}
