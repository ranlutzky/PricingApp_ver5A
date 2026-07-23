import React from "react";
import { CATEGORIES, OPTIONS } from "../data/presetsData";
import { PRODUCTS_DB } from "../data/valvesData";
import {
  ACCESSORIES_DB,
  DIAPHRAGMS_DB,
  SORTED_ACCESSORIES_KEYS,
} from "../data/accessoriesData";
import { calculateRow, formatCurrency } from "../utils/calculations";

export default function ItemsTable({ items, setItems, currency }) {
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === "category") {
      newItems[index].code = "";
      newItems[index].description = "";
      newItems[index].manualPrice = "";
    }

    setItems(newItems);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const duplicateItem = (index) => {
    const itemToCopy = { ...items[index] };
    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToCopy);
    setItems(newItems);
  };

  const toggleIncluded = (index) => {
    const newItems = [...items];
    newItems[index].isIncluded = !newItems[index].isIncluded;
    setItems(newItems);
  };

  const currencySymbol = currency === "EUR" ? "€" : "$";

  return (
    <div className="overflow-x-auto mb-4 bg-white rounded shadow-sm border border-gray-200">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-200 text-xs font-bold uppercase text-gray-700 border-b border-gray-300">
            <th className="p-2 border-r border-gray-300 w-28">TYPE</th>
            <th className="p-2 border-r border-gray-300">DESCRIPTION</th>
            <th className="p-2 border-r border-gray-300 w-32">SIZE</th>
            <th className="p-2 border-r border-gray-300 w-16 text-center">
              QTY
            </th>
            <th className="p-2 border-r border-gray-300 w-24 text-right">
              UNIT PRICE
            </th>
            <th className="p-2 border-r border-gray-300 w-20 text-center">
              DISC %
            </th>
            <th className="p-2 border-r border-gray-300 w-28 text-right">
              TOTAL
            </th>
            <th className="p-2 text-center w-20 print:hidden">ACTIONS</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {items.map((item, idx) => {
            const { unitPrice, total } = calculateRow(
              item,
              idx,
              items,
              currency
            );

            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 ${
                  item.isIncluded ? "bg-blue-50/50" : "hover:bg-gray-50"
                }`}
              >
                {/* קטגוריה / TYPE */}
                <td className="p-1.5 border-r border-gray-200">
                  <select
                    value={item.category}
                    onChange={(e) =>
                      updateItem(idx, "category", e.target.value)
                    }
                    className="p-1 border border-gray-300 rounded text-xs w-full bg-white font-medium"
                  >
                    {Object.values(CATEGORIES).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>

                {/* תיאור וקוד פריט */}
                <td className="p-1.5 border-r border-gray-200">
                  <div className="flex flex-col gap-1">
                    {item.category === CATEGORIES.VALVES ? (
                      <select
                        value={item.code || ""}
                        onChange={(e) => {
                          updateItem(idx, "code", e.target.value);
                          if (PRODUCTS_DB[e.target.value]) {
                            updateItem(
                              idx,
                              "description",
                              PRODUCTS_DB[e.target.value].desc
                            );
                          }
                        }}
                        className="p-1 border border-gray-300 rounded text-xs font-bold w-full bg-white"
                      >
                        <option value="">Select Valve Code...</option>
                        {Object.keys(PRODUCTS_DB).map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    ) : item.category === CATEGORIES.FREE_TEXT ? (
                      <input
                        type="text"
                        placeholder="Item Code / Title"
                        value={item.code || ""}
                        onChange={(e) =>
                          updateItem(idx, "code", e.target.value)
                        }
                        className="p-1 border border-gray-300 rounded text-xs font-bold w-full"
                      />
                    ) : (
                      <select
                        value={item.code || ""}
                        onChange={(e) =>
                          updateItem(idx, "code", e.target.value)
                        }
                        className="p-1 border border-gray-300 rounded text-xs font-bold w-full bg-white"
                      >
                        <option value="">Select Code...</option>
                        {item.category === CATEGORIES.DIAPHRAGMS
                          ? Object.keys(DIAPHRAGMS_DB).map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))
                          : SORTED_ACCESSORIES_KEYS.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                      </select>
                    )}

                    <input
                      type="text"
                      value={item.description || ""}
                      onChange={(e) =>
                        updateItem(idx, "description", e.target.value)
                      }
                      placeholder="Description"
                      className="p-1 border border-gray-200 rounded text-xs w-full text-gray-700"
                    />
                  </div>
                </td>

                {/* מידה / חומר גוף */}
                <td className="p-1.5 border-r border-gray-200">
                  {item.category === CATEGORIES.VALVES ? (
                    <div className="flex flex-col gap-1">
                      <select
                        value={item.size || ""}
                        onChange={(e) =>
                          updateItem(idx, "size", e.target.value)
                        }
                        className="p-1 border border-gray-300 rounded text-xs bg-white"
                      >
                        <option value="">Size...</option>
                        {OPTIONS.sizes.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <select
                        value={item.bodyMat || "Ductile Iron"}
                        onChange={(e) =>
                          updateItem(idx, "bodyMat", e.target.value)
                        }
                        className="p-1 border border-gray-300 rounded text-xs bg-white"
                      >
                        {OPTIONS.bodyMaterials.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={item.size || ""}
                      onChange={(e) => updateItem(idx, "size", e.target.value)}
                      placeholder="N/A"
                      className="p-1 border border-gray-200 rounded text-xs w-full text-center"
                    />
                  )}
                </td>

                {/* כמות / QTY */}
                <td className="p-1.5 border-r border-gray-200 text-center">
                  <input
                    type="number"
                    min="1"
                    value={item.qty || 1}
                    onChange={(e) =>
                      updateItem(idx, "qty", parseInt(e.target.value) || 1)
                    }
                    className="p-1 border border-gray-300 rounded text-xs w-full text-center font-bold"
                  />
                </td>

                {/* מחיר יחידה / UNIT PRICE */}
                <td className="p-1.5 border-r border-gray-200 font-mono text-xs text-right font-medium">
                  {item.isIncluded ? (
                    <span className="text-gray-400 italic text-xxs">
                      INCLUDED
                    </span>
                  ) : (
                    formatCurrency(unitPrice, currencySymbol)
                  )}
                </td>

                {/* הנחה / DISC % */}
                <td className="p-1.5 border-r border-gray-200 text-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={item.discount !== undefined ? item.discount : 55}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        "discount",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="p-1 border border-gray-300 rounded text-xs w-full text-center font-bold"
                  />
                </td>

                {/* סה"כ בשורה / TOTAL */}
                <td className="p-1.5 border-r border-gray-200 font-bold font-mono text-xs text-right text-gray-900 bg-gray-50/50">
                  {item.isIncluded ? (
                    <span className="text-gray-400 italic text-xxs">-</span>
                  ) : (
                    formatCurrency(total, currencySymbol)
                  )}
                </td>

                {/* פעולות / ACTIONS */}
                <td className="p-1.5 text-center print:hidden">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => toggleIncluded(idx)}
                      title={
                        item.isIncluded
                          ? "Unlink item"
                          : "Link/Include in item above"
                      }
                      className={`p-1 text-xs rounded border ${
                        item.isIncluded
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      🔗
                    </button>
                    <button
                      onClick={() => duplicateItem(idx)}
                      title="Duplicate Row"
                      className="p-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      title="Remove Row"
                      className="p-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
