import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { GOOGLE_SCRIPT_URL } from "../data/constants";

//TEST GVAT//
// פונקציית עזר להורדת Blob בצורה ישירה
const downloadBlobFallback = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * מעבדת גיליון אקסל בפורמט מטריצה וממירה אותו לאובייקט מחירון
 * @param {Array} sheetData - מערך השורות שנקראו מהאקסל (sheet_to_json)
 */
export const parsePriceMatrixSheet = (sheetData) => {
  const pricesSTD = {};
  const pricesHG = {};

  // מיפוי שמות העמודות באקסל לפורמט המידות של האפליקציה
  const sizeMap = {
    '1 1/2"': '1.5"',
    '1.5"': '1.5"',
    '2"': '2"',
    '2 1/2"': '2.5"',
    '2.5"': '2.5"',
    '3"': '3"',
    '4"': '4"',
    '6"': '6"',
    '8"': '8"',
    '10"': '10"',
    '12"': '12"',
  };

  sheetData.forEach((row) => {
    // ניקוי רווחים מכל מפתחות השורה אוטומטית (מטפל ברווחים נסתרים בכותרות)
    const cleanRow = {};
    Object.keys(row).forEach((k) => {
      cleanRow[k.trim()] = row[k];
    });

    const rawCode = cleanRow["Code"] || cleanRow["code"] || cleanRow["CODE"];
    if (!rawCode) return;

    const code = String(rawCode).trim();
    pricesSTD[code] = {};
    pricesHG[code] = {};

    // סריקת המידות ורישום המחירים
    Object.keys(sizeMap).forEach((excelSizeHeader) => {
      const appSizeKey = sizeMap[excelSizeHeader];

      // קריאת מחיר Standard (עם ניקוי פסיקים ובדיקת רווחים בכותרת)
      const val =
        cleanRow[excelSizeHeader] !== undefined
          ? cleanRow[excelSizeHeader]
          : cleanRow[excelSizeHeader.trim()];
      const cleanStd = val !== undefined ? String(val).replace(/,/g, "") : "";
      const stdPrice = parseFloat(cleanStd);
      if (!isNaN(stdPrice) && stdPrice > 0) {
        pricesSTD[code][appSizeKey] = stdPrice;
      }

      // קריאת מחיר High Grade (עם ניקוי פסיקים בטוח)
      const hgHeader = `${excelSizeHeader}_HG`;
      const valHg =
        cleanRow[hgHeader] !== undefined
          ? cleanRow[hgHeader]
          : cleanRow[hgHeader.trim()];
      const cleanHg =
        valHg !== undefined ? String(valHg).replace(/,/g, "") : "";
      const hgPrice = parseFloat(cleanHg);
      if (!isNaN(hgPrice) && hgPrice > 0) {
        pricesHG[code][appSizeKey] = hgPrice;
      }
    });
  });

  return { pricesSTD, pricesHG };
};

export const handleSmartSaveService = async ({
  cust,
  ref,
  jsonData,
  onBeforeSave,
  getPdfBlob,
  getExcelBlob,
}) => {
  try {
    if (onBeforeSave) {
      await onBeforeSave();
    }

    const safeCustomer = (cust?.name || "Customer").replace(
      /[/\\?%*:|"<>]/g,
      "-"
    );
    const safeRef = (ref || "NoRef").replace(/[/\\?%*:|"<>]/g, "-");
    const baseName = `${safeCustomer}_${safeRef}`;

    const pdfBlob = await getPdfBlob();
    const excelBlob = await getExcelBlob();
    const jsonString = JSON.stringify(jsonData, null, 2);
    const jsonBlob = new Blob([jsonString], { type: "application/json" });

    const isIframe = window.self !== window.top;
    const canUsePicker = "showSaveFilePicker" in window && !isIframe;

    if (canUsePicker) {
      try {
        const pdfHandle = await window.showSaveFilePicker({
          suggestedName: `${baseName}.pdf`,
          types: [
            {
              description: "PDF Document",
              accept: { "application/pdf": [".pdf"] },
            },
          ],
        });
        const pdfWritable = await pdfHandle.createWritable();
        await pdfWritable.write(pdfBlob);
        await pdfWritable.close();

        const excelHandle = await window.showSaveFilePicker({
          suggestedName: `${baseName}.xlsx`,
          types: [
            {
              description: "Excel Spreadsheet",
              accept: {
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                  [".xlsx"],
              },
            },
          ],
        });
        const excelWritable = await excelHandle.createWritable();
        await excelWritable.write(excelBlob);
        await excelWritable.close();

        const jsonHandle = await window.showSaveFilePicker({
          suggestedName: `${baseName}.json`,
          types: [
            {
              description: "JSON File",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const jsonWritable = await jsonHandle.createWritable();
        await jsonWritable.write(jsonBlob);
        await jsonWritable.close();

        return;
      } catch (err) {
        if (err.name === "AbortError") return;
        console.warn("Picker failed, using fallback downloads:", err);
      }
    }

    downloadBlobFallback(pdfBlob, `${baseName}.pdf`);
    downloadBlobFallback(excelBlob, `${baseName}.xlsx`);
    downloadBlobFallback(jsonBlob, `${baseName}.json`);
  } catch (error) {
    console.error("Smart Save Error:", error);
    alert("Storage Error: " + error.message);
  }
};

export const createGlobalPDFBlob = async (
  items,
  cust,
  salesPerson,
  currencySymbol,
  subTotal,
  packingCost,
  grandTotal,
  includePacking,
  terms,
  ref,
  PRODUCTS_DB,
  SIGNATURES,
  calculateRow,
  formatCurrency,
  getFormattedDate
) => {
  const doc = new jsPDF();

  // 1. Logo Insertion
  try {
    const img = new Image();
    img.src = "/raphael_logo_final.png";
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    if (img.complete && img.naturalWidth !== 0) {
      doc.addImage(img, "PNG", 14, 12, 45, 15);
    }
  } catch (e) {
    console.warn("Logo overlay skipped:", e);
  }

  // Header Text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("COMMERCIAL QUOTATION", 14, 38);

  doc.text(`Date: ${getFormattedDate()}`, 135, 38);
  doc.text(`Reference: ${ref}`, 135, 44);

  // Customer Section
  doc.setFontSize(10);
  doc.text(`Attn: ${cust?.contactName || ""}`, 14, 48);
  doc.text(`Company: ${cust?.name || ""}`, 14, 54);

  // Table Columns
  const tableColumn = [
    "No",
    "Model",
    `Description`,
    "DN",
    "Qty",
    `Unit Price (${currencySymbol})`,
    `Total (${currencySymbol})`,
  ];

  // Table Body Rows
  const tableRows = items.map((item, idx) => {
    const fin = calculateRow(item, idx);
    let desc = PRODUCTS_DB[item.code]?.desc || item.description || "";
    if (item.customDesc) {
      desc += `\n${item.customDesc}`;
    }

    return [
      idx + 1,
      item.code || "-",
      desc,
      item.size || "-",
      item.qty,
      fin.unitPrice.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      fin.total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    ];
  });

  // Totals Rows Inside Table Grid
  tableRows.push([
    "",
    "",
    "",
    "",
    "",
    { content: "Subtotal:", styles: { fontStyle: "bold", halign: "right" } },
    {
      content: formatCurrency(subTotal, currencySymbol),
      styles: { fontStyle: "bold", halign: "right" },
    },
  ]);

  if (includePacking) {
    tableRows.push([
      "",
      "",
      "",
      "",
      "",
      {
        content: "Packing &\nHandling (3.5%):",
        styles: { fontStyle: "bold", halign: "right" },
      },
      {
        content: formatCurrency(packingCost, currencySymbol),
        styles: { fontStyle: "bold", halign: "right" },
      },
    ]);
  }

  tableRows.push([
    "",
    "",
    "",
    "",
    "",
    { content: "GRAND TOTAL:", styles: { fontStyle: "bold", halign: "right" } },
    {
      content: formatCurrency(grandTotal, currencySymbol),
      styles: { fontStyle: "bold", halign: "right" },
    },
  ]);

  // Generate Table with Grid Theme
  doc.autoTable({
    startY: 62,
    head: [tableColumn],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [15, 44, 89], // Dark Navy Blue
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { fontStyle: "bold", cellWidth: 28 },
      2: { cellWidth: 62 },
      3: { halign: "center", cellWidth: 14 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 28 },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 12;

  // Commercial Terms Section
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Commercial Terms:", 14, finalY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Payment: ${terms.payment}`, 14, finalY + 6);
  doc.text(`Lead time: ${terms.leadTime}`, 14, finalY + 12);

  doc.text(`Delivery: ${terms.delivery}`, 85, finalY + 6);
  doc.text(`Validity: ${terms.validity}`, 85, finalY + 12);

  // Sales Person Signature Section
  const sig = SIGNATURES[salesPerson] || SIGNATURES["OTHER"];
  const sigY = finalY + 26;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 44, 89);
  doc.text(sig.name || salesPerson, 14, sigY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(sig.title || "", 14, sigY + 5);
  if (sig.region) doc.text(sig.region, 14, sigY + 10);
  if (sig.phone) doc.text(`Phone: ${sig.phone}`, 14, sigY + 15);
  if (sig.email) doc.text(`Email: ${sig.email}`, 14, sigY + 20);

  return doc.output("blob");
};

export const createGlobalExcelBlob = (
  items,
  cust,
  salesPerson,
  currencySymbol,
  subTotal,
  packingCost,
  grandTotal,
  includePacking,
  ref,
  PRODUCTS_DB,
  calculateRow
) => {
  const wb = XLSX.utils.book_new();

  const wsData = [
    ["RAPHAEL VALVES INDUSTRIES - QUOTATION"],
    ["Reference", ref],
    ["Customer", cust?.name || ""],
    ["Contact", cust?.contactName || ""],
    ["Country", cust?.country || ""],
    ["Sales Person", salesPerson],
    [],
    [
      "No",
      "Type",
      "Model",
      "Commercial Notes",
      "Internal Notes",
      "Body Material",
      "Trim Material",
      "DN",
      "Qty",
      `Unit Price (${currencySymbol})`,
      `Total (${currencySymbol})`,
    ],
  ];

  items.forEach((item, idx) => {
    const fin = calculateRow(item, idx);
    wsData.push([
      idx + 1,
      item.category,
      item.code || "",
      item.customDesc || "",
      item.internalNotes || "",
      item.bodyMat || "",
      item.trimMat || "",
      item.size || "-",
      item.qty,
      fin.unitPrice,
      fin.total,
    ]);
  });

  wsData.push([]);
  wsData.push(["", "", "", "", "", "", "", "", "", "Subtotal", subTotal]);
  if (includePacking) {
    wsData.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Packing (3.5%)",
      packingCost,
    ]);
  }
  wsData.push(["", "", "", "", "", "", "", "", "", "Grand Total", grandTotal]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Quotation");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([wbout], { type: "application/octet-stream" });
};

// פונקציה לייצוא מחירון בסיס מלא לקובץ Excel מובנה
export const exportMasterPriceListExcel = (
  PRODUCTS_DB,
  PRICES_STD_USD,
  PRICES_HG_USD,
  PRICES_STD_EUR,
  PRICES_HG_EUR,
  ACCESSORIES_DB,
  DIAPHRAGMS_DB,
  BODY_MATERIAL_ADDONS
) => {
  const wb = XLSX.utils.book_new();

  // 1. Valves USD
  const valvesUSDData = [
    ["Code", "Description", "Size", "Price_STD_USD", "Price_HG_USD"],
  ];
  Object.keys(PRODUCTS_DB || {}).forEach((code) => {
    const prod = PRODUCTS_DB[code];
    const std = PRICES_STD_USD?.[code] || 0;
    const hg = PRICES_HG_USD?.[code] || 0;
    valvesUSDData.push([code, prod.desc || "", prod.size || "", std, hg]);
  });
  const wsValvesUSD = XLSX.utils.aoa_to_sheet(valvesUSDData);
  XLSX.utils.book_append_sheet(wb, wsValvesUSD, "Valves_USD");

  // 2. Valves EUR
  const valvesEURData = [
    ["Code", "Description", "Size", "Price_STD_EUR", "Price_HG_EUR"],
  ];
  Object.keys(PRODUCTS_DB || {}).forEach((code) => {
    const prod = PRODUCTS_DB[code];
    const std = PRICES_STD_EUR?.[code] || 0;
    const hg = PRICES_HG_EUR?.[code] || 0;
    valvesEURData.push([code, prod.desc || "", prod.size || "", std, hg]);
  });
  const wsValvesEUR = XLSX.utils.aoa_to_sheet(valvesEURData);
  XLSX.utils.book_append_sheet(wb, wsValvesEUR, "Valves_EUR");

  // 3. Accessories
  const accData = [["Code", "Description", "Price_USD", "Price_EUR"]];
  if (ACCESSORIES_DB) {
    if (Array.isArray(ACCESSORIES_DB)) {
      ACCESSORIES_DB.forEach((acc) => {
        accData.push([
          acc.code || "",
          acc.desc || "",
          acc.priceUSD || 0,
          acc.priceEUR || 0,
        ]);
      });
    } else {
      Object.keys(ACCESSORIES_DB).forEach((code) => {
        const item = ACCESSORIES_DB[code];
        const desc = typeof item === "object" ? item.desc || code : code;
        const priceUSD = typeof item === "object" ? item.priceUSD || 0 : item;
        const priceEUR = typeof item === "object" ? item.priceEUR || 0 : item;
        accData.push([code, desc, priceUSD, priceEUR]);
      });
    }
  }
  const wsAcc = XLSX.utils.aoa_to_sheet(accData);
  XLSX.utils.book_append_sheet(wb, wsAcc, "Accessories");

  // 4. Diaphragms
  const diaData = [["Code", "Description", "Size", "Price_USD", "Price_EUR"]];
  if (DIAPHRAGMS_DB) {
    if (Array.isArray(DIAPHRAGMS_DB)) {
      DIAPHRAGMS_DB.forEach((dia) => {
        diaData.push([
          dia.code || "",
          dia.desc || "",
          dia.size || "",
          dia.priceUSD || 0,
          dia.priceEUR || 0,
        ]);
      });
    } else {
      Object.keys(DIAPHRAGMS_DB).forEach((code) => {
        const item = DIAPHRAGMS_DB[code];
        const desc = typeof item === "object" ? item.desc || code : code;
        const size = typeof item === "object" ? item.size || "" : "";
        const priceUSD = typeof item === "object" ? item.priceUSD || 0 : item;
        const priceEUR = typeof item === "object" ? item.priceEUR || 0 : item;
        diaData.push([code, desc, size, priceUSD, priceEUR]);
      });
    }
  }
  const wsDia = XLSX.utils.aoa_to_sheet(diaData);
  XLSX.utils.book_append_sheet(wb, wsDia, "Diaphragms");

  // 5. Material Addons
  const addonsData = [["Category", "Material_Name", "Size", "Type", "Value"]];
  if (BODY_MATERIAL_ADDONS) {
    Object.keys(BODY_MATERIAL_ADDONS).forEach((cat) => {
      Object.keys(BODY_MATERIAL_ADDONS[cat]).forEach((mat) => {
        const val = BODY_MATERIAL_ADDONS[cat][mat];
        addonsData.push([
          cat,
          mat,
          "All",
          typeof val === "number" ? "Percentage" : "Fixed",
          val,
        ]);
      });
    });
  }
  const wsAddons = XLSX.utils.aoa_to_sheet(addonsData);
  XLSX.utils.book_append_sheet(wb, wsAddons, "Material_Addons");

  // 6. Customer PriceLists
  const custPLData = [
    ["Customer_Name", "Assigned_PriceList"],
    ["Riego Pro", "USD_STD"],
    ["Example Customer", "EUR_HG"],
  ];
  const wsCustPL = XLSX.utils.aoa_to_sheet(custPLData);
  XLSX.utils.book_append_sheet(wb, wsCustPL, "Customer_PriceLists");

  // הורדת הקובץ למחשב
  XLSX.writeFile(wb, "Raphael_Master_Pricelist.xlsx");
};

// פונקציית טעינת מחירון דרך Google Apps Script Proxy
export const fetchMasterPriceListFromCloud = async () => {
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getPriceList`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (result.status !== "success" || !result.data) {
      throw new Error(
        "Failed to fetch binary data from Apps Script: " +
          (result.message || "")
      );
    }

    // המרת Base64 לטקסט ולמערך בייטים
    const binaryString = window.atob(result.data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    let workbook;
    try {
      // ניסיון קריאה כקובץ Excel בינארי (XLSX/XLS)
      workbook = XLSX.read(bytes, { type: "array" });
    } catch (binaryError) {
      console.warn("Binary read failed, fallback to text/CSV reading...");
      // מענה גיבוי למקרה שהנתונים שהוחזרו מקודדים כ-CSV/Text
      workbook = XLSX.read(binaryString, { type: "string" });
    }

    // פונקציית עזר פנימית מעודכנת לניקוי ונרמול מפתחות הגדלים באקסל
    const cleanSheetData = (data) => {
      if (!Array.isArray(data)) return data;
      return data.map((row) => {
        const newRow = {};
        Object.keys(row).forEach((key) => {
          const val = row[key];
          // נרמול אגרסיבי: הסרת מרכאות והמרת רצפי רווחים לרווח יחיד לצורך זיהוי אחיד
          const cleanKey = key.replace(/["']/g, "").replace(/\s+/g, " ").trim();

          if (cleanKey.includes("2 1/2") || cleanKey === "2 1/2") {
            if (cleanKey.includes("HG")) {
              newRow['2.5"_HG'] = val;
            } else {
              newRow['2.5"'] = val;
            }
          } else {
            // ניקוי מפתחות אחרים ושמירת ערכם
            newRow[key.replace(/["']/g, "").trim()] = val;
          }
        });
        return newRow;
      });
    };

    // קריאת הגיליון של הדולר
    const sheetUSD =
      workbook.Sheets["Valves_USD"] || workbook.Sheets[workbook.SheetNames[0]];
    const rawDataUSD = XLSX.utils.sheet_to_json(sheetUSD, { defval: "" });
    const dataUSD = cleanSheetData(rawDataUSD);
    const { pricesSTD: pricesUSD_STD, pricesHG: pricesUSD_HG } =
      parsePriceMatrixSheet(dataUSD);

    // קריאת הגיליון של היורו
    const sheetEUR = workbook.Sheets["Valves_EUR"];
    let pricesEUR_STD = null;
    let pricesEUR_HG = null;

    if (sheetEUR) {
      const rawDataEUR = XLSX.utils.sheet_to_json(sheetEUR, { defval: "" });
      const dataEUR = cleanSheetData(rawDataEUR);
      const parsedEUR = parsePriceMatrixSheet(dataEUR);
      pricesEUR_STD = parsedEUR.pricesSTD;
      pricesEUR_HG = parsedEUR.pricesHG;
    } else {
      console.warn(
        "Valves_EUR sheet NOT found in workbook. Available sheets:",
        workbook.SheetNames
      );
    }

    return {
      PRICES_STD: pricesUSD_STD,
      PRICES_HG: pricesUSD_HG,
      PRICES_EUR_STD: pricesEUR_STD,
      PRICES_EUR_HG: pricesEUR_HG,
    };
  } catch (error) {
    console.error("Error fetching or parsing price list from cloud:", error);
    return null;
  }
};
