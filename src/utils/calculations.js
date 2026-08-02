import { CATEGORIES } from "../data/presetsData";
import {
  PRICES_STD_USD,
  PRICES_STD_EUR,
  PRICES_HG_USD,
  PRICES_HG_EUR,
  BODY_MATERIAL_ADDONS,
} from "../data/valvesData";
import { ACCESSORIES_DB, DIAPHRAGMS_DB } from "../data/accessoriesData";

/**
 * פורמט מספר למחיר עם תוספת סימן מטבע
 */
export const formatCurrency = (amount, symbol = "") => {
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * פורמט תאריך מלא להצעת המחיר (למשל: July 21st, 2026)
 */
export const getFormattedDate = () => {
  const date = new Date();
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  const nth = (d) => {
    if (d > 3 && d < 21) return "th";
    switch (d % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };
  return `${month} ${day}${nth(day)}, ${year}`;
};

/**
 * פונקציית עזר לשליפת מחיר עם תמיכה בשמות מידות שונים (כמו 2 1/2 מול 2.5) ובממוצע אינטרפולציה
 */
const getPriceWithFallback = (table, code, size) => {
  if (!table || !code || !size) return 0;

  const codeTable = table[code];
  if (!codeTable) return 0;

  // ניקוי ונרמול המידה המבוקשת
  const cleanSize = size.replace(/"/g, "").trim();

  // כל וריאציות המפתחות האפשריות שיכולות להופיע באקסל
  const possibleKeys = [
    size,
    cleanSize,
    cleanSize === "2.5" ? "2 1/2" : null,
    cleanSize === "2 1/2" ? "2.5" : null,
  ].filter(Boolean);

  // חיפוש התאמה ישירה לפי אחת הווריאציות
  for (const key of possibleKeys) {
    if (
      codeTable[key] !== undefined &&
      codeTable[key] !== null &&
      codeTable[key] !== 0
    ) {
      return Number(codeTable[key]);
    }
  }

  // אם מדובר במידה 2.5 (או 2 1/2) ולא נמצא מחיר ישיר, נבצע ממוצע בין 2" ל-3"
  if (cleanSize === "2.5" || cleanSize === "2 1/2" || size === '2.5"') {
    const p2 = codeTable['2"'] ?? codeTable["2"] ?? codeTable["2 1/2"] ?? 0;
    const p3 = codeTable['3"'] ?? codeTable["3"] ?? 0;

    // חיפוש חלופי נוסף אם המפתחות מוגדרים אחרת
    const altP2 = codeTable["2"] || codeTable['2"'] || 0;
    const altP3 = codeTable["3"] || codeTable['3"'] || 0;

    const finalP2 = p2 || altP2;
    const finalP3 = p3 || altP3;

    if (finalP2 && finalP3) {
      return (Number(finalP2) + Number(finalP3)) / 2;
    }
  }

  return 0;
};

/**
 * חישוב מופרד ונקי עבור שורת פריט בודדת (כולל תמיכה במיזוג שורות)
 */
export const calculateRow = (
  item,
  index,
  items,
  currency,
  ignoreMerge = false
) => {
  // 1. שורה ממוזגת (המחיר שלה נכלל בשורת המגוף שמעליה)
  if (!ignoreMerge && item.isIncluded) {
    return { unitPrice: 0, total: 0, trimAdder: 0 };
  }

  // 2. מחיר ידני עבור קטגוריות שאינן Free Text
  if (item.category !== CATEGORIES.FREE_TEXT && item.manualPrice) {
    const up = parseFloat(item.manualPrice) || 0;
    return { unitPrice: up, total: up * item.qty, trimAdder: 0 };
  }

  // 3. Free Text
  if (item.category === CATEGORIES.FREE_TEXT) {
    const up = parseFloat(item.price) || 0;
    return { unitPrice: up, total: up * item.qty, trimAdder: 0 };
  }

  // 4. חישוב שורת מגוף (Valves)
  if (item.category === CATEGORIES.VALVES) {
    if (!item.code || !item.size) {
      return { unitPrice: 0, total: 0, trimAdder: 0 };
    }

    const baseTable = currency === "USD" ? PRICES_STD_USD : PRICES_STD_EUR;
    const basePrice = getPriceWithFallback(baseTable, item.code, item.size);
    const discountedBase = basePrice * (1 - (item.discount || 0) / 100);

    // תוספת חומר גוף
    const bodyAdder = item.bodyMat
      ? getPriceWithFallback(BODY_MATERIAL_ADDONS, item.bodyMat, item.size)
      : 0;

    // תוספת סגסוגת (Trim) עם הגנה יציבה
    let trimAdder = 0;
    if (item.trimMat === "Full Sea Water Trim") {
      trimAdder = 10000;
    } else if (item.trimMat && item.trimMat !== "Copper/Brass") {
      const hgTable = currency === "USD" ? PRICES_HG_USD : PRICES_HG_EUR;
      const hgPrice = getPriceWithFallback(hgTable, item.code, item.size);
      if (hgPrice > 0) {
        trimAdder = Math.max(0, hgPrice - basePrice);
      }
    }

    let unitPrice = discountedBase + bodyAdder + trimAdder;

    // במידה ויש שורות ממוזגות מתחת למגוף (isIncluded), נוסיף את ערכן למחיר היחידה
    if (!ignoreMerge && items && items.length > 0) {
      for (let i = index + 1; i < items.length; i++) {
        if (items[i].isIncluded) {
          const mergedVal = calculateRow(items[i], i, items, currency, true);
          unitPrice += mergedVal.unitPrice * items[i].qty;
        } else {
          break;
        }
      }
    }

    return { unitPrice, total: unitPrice * item.qty, trimAdder };
  }

  // 5. חישוב עבור Accessories, Spare Parts, Diaphragms
  else {
    const db =
      item.category === CATEGORIES.DIAPHRAGMS ? DIAPHRAGMS_DB : ACCESSORIES_DB;

    let base = db[item.code] || 0;

    // בדיקה ספציפית לדיאפרגמות במידה 2.5" או 2 1/2 אם המפתח מורכב או חסר
    if (
      item.category === CATEGORIES.DIAPHRAGMS &&
      (item.size === '2.5"' || item.size === "2 1/2") &&
      !base
    ) {
      const code2 = item.code.replace('2.5"', '2"').replace("2 1/2", '2"');
      const code3 = item.code.replace('2.5"', '3"').replace("2 1/2", '3"');
      const price2 = db[code2] || 0;
      const price3 = db[code3] || 0;
      if (price2 && price3) {
        base = (price2 + price3) / 2;
      }
    }

    // ספייר פארטס מחושבים עם מכפיל 1.5
    const factor = item.category === CATEGORIES.SPARE_PARTS ? 1.5 : 1;
    const unitPrice = base * factor * (1 - (item.discount || 0) / 100);

    return { unitPrice, total: unitPrice * item.qty, trimAdder: 0 };
  }
};
