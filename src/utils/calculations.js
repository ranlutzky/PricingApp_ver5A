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
    const basePrice = baseTable?.[item.code]?.[item.size] || 0;
    const discountedBase = basePrice * (1 - (item.discount || 0) / 100);

    // תוספת חומר גוף
    const bodyAdder = item.bodyMat
      ? BODY_MATERIAL_ADDONS[item.bodyMat]?.[item.size] || 0
      : 0;

    // תוספת סגסוגת (Trim)
    let trimAdder = 0;
    if (item.trimMat === "Full Sea Water Trim") {
      trimAdder = 10000;
    } else if (item.trimMat && item.trimMat !== "Copper/Brass") {
      const hgTable = currency === "USD" ? PRICES_HG_USD : PRICES_HG_EUR;
      trimAdder = Math.max(
        0,
        (hgTable?.[item.code]?.[item.size] || basePrice) - basePrice
      );
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

    const base = db[item.code] || 0;
    // ספייר פארטס מחושבים עם מכפיל 1.5
    const factor = item.category === CATEGORIES.SPARE_PARTS ? 1.5 : 1;
    const unitPrice = base * factor * (1 - (item.discount || 0) / 100);

    return { unitPrice, total: unitPrice * item.qty, trimAdder: 0 };
  }
};
