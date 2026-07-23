import "./styles.css";
import React, { useState, useEffect } from "react";
import {
  createGlobalPDFBlob,
  createGlobalExcelBlob,
  handleSmartSaveService,
  fetchMasterPriceListFromCloud,
} from "./services/exportService";
import {
  INITIAL_CUSTOMERS,
  SALES_PEOPLE,
  SIGNATURES,
  CATEGORIES,
  DIAPHRAGMS_DB,
  ACCESSORIES_DB,
  PRODUCTS_DB,
  SORTED_ACCESSORIES_KEYS,
  PRICES_STD_USD_RAW,
  PRICES_HG_USD_RAW,
  PRICES_STD_EUR_RAW,
  PRICES_HG_EUR_RAW,
  BODY_MATERIAL_ADDONS,
  OPTIONS,
  COUNTRIES,
  SHAREPOINT_EXCEL_URL,
  GOOGLE_SCRIPT_URL,
} from "./data/constants.js";

// פונקציית עזר לבניית שם הקובץ: שם לקוח_רפרנס
const getGenerateFileName = (customerName, reference) => {
  const name = customerName || "Customer";
  const ref = reference || "NoRef";
  const safeName = `${name}_${ref}`.replace(/[/\\?%*:|"<>]/g, "-");
  return safeName;
};

// --- 1. CONSTANTS & HELPER FUNCTIONS ---

const addSize2_5 = (priceList) => {
  if (!priceList) return {};
  const newPriceList = { ...priceList };
  Object.keys(newPriceList).forEach((key) => {
    const item = newPriceList[key];
    if (item && item['2"'] && item['3"'] && !item['2.5"']) {
      const avg = (item['2"'] + item['3"']) / 2;
      newPriceList[key] = { ...item, '2.5"': avg };
    }
  });
  return newPriceList;
};

const formatCurrency = (amount, symbol = "") => {
  const num = Number(amount) || 0;
  return `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getFormattedDate = () => {
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

// --- 3. PROCESSED DATA ---
const PRICES_STD_USD = addSize2_5(PRICES_STD_USD_RAW);
const PRICES_HG_USD = addSize2_5(PRICES_HG_USD_RAW);
const PRICES_STD_EUR = addSize2_5(PRICES_STD_EUR_RAW);
const PRICES_HG_EUR = addSize2_5(PRICES_HG_EUR_RAW);

export default function QuotationApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(false);

  const loadSavedData = () => {
    try {
      const saved = localStorage.getItem("RAPHAEL_QUOTATION_DATA");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  };

  const loadSavedCustomers = () => {
    try {
      const saved = localStorage.getItem("RAPHAEL_CUSTOMERS");
      return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    } catch (e) {
      return INITIAL_CUSTOMERS;
    }
  };

  const saved = loadSavedData();
  const [items, setItems] = useState(saved?.items || []);
  const [salesPerson, setSalesPerson] = useState(
    saved?.salesPerson || "RAN LUTZKY"
  );
  const [cust, setCust] = useState(
    saved?.cust || {
      name: "",
      contactName: "",
      email: "",
      phone: "",
      defaultDiscount: 55,
      country: "",
    }
  );

  const [customerList, setCustomerList] = useState(loadSavedCustomers());
  const [currency, setCurrency] = useState(saved?.currency || "USD");
  const [ref, setRef] = useState("");
  const [refSuffix, setRefSuffix] = useState(saved?.refSuffix || 1);
  const [includePacking, setIncludePacking] = useState(
    saved?.includePacking ?? true
  );
  const [terms, setTerms] = useState(
    saved?.terms || {
      payment: "AS USUAL",
      delivery: "EXW",
      leadTime: "6-8 weeks",
      validity: "30 Days",
    }
  );
  const [syncStatus, setSyncStatus] = useState({
    isOnline: false,
    lastUpdated: "Not synced",
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [masterData, setMasterData] = useState(null);

  // --- ALL EFFECTS MUST BE DECLARED BEFORE ANY CONDITIONAL RETURN ---
  useEffect(() => {
    const dataToSave = {
      items,
      cust,
      salesPerson,
      currency,
      terms,
      refSuffix,
      includePacking,
    };
    localStorage.setItem("RAPHAEL_QUOTATION_DATA", JSON.stringify(dataToSave));
  }, [items, cust, salesPerson, currency, terms, refSuffix, includePacking]);

  useEffect(() => {
    const loadCloudData = async () => {
      const cloudData = await fetchMasterPriceListFromCloud();
      if (cloudData) {
        console.log("🚀 DATA LOADED SUCCESSFULLY:", cloudData);
        setMasterData(cloudData);
        const now = new Date();
        setSyncStatus({
          isOnline: true,
          lastUpdated:
            now.toLocaleDateString("en-GB") +
            " " +
            now.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            }),
        });
      } else {
        console.warn("Using local fallback data.");
        setSyncStatus({
          isOnline: false,
          lastUpdated: "Offline (Local Data)",
        });
      }
    };

    loadCloudData();
  }, []);

  useEffect(() => {
    let initials =
      salesPerson === "RAN LUTZKY"
        ? "RL"
        : salesPerson === "TAL FISHBHIN"
        ? "TF"
        : salesPerson === "OGENIA ARBITMAN"
        ? "OA"
        : salesPerson === "OHAD LEV"
        ? "OL"
        : "FP";
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(2);
    const suffixNum = refSuffix === 1 ? "01" : String((refSuffix - 1) * 11);
    setRef(`${initials}${day}${month}${year}${suffixNum}`);
  }, [salesPerson, refSuffix]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === "RaphaelFP" && passwordInput === "Fire2026") {
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  // --- CONDITIONAL RETURN FOR LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img
              src="/raphael_logo_final.png"
              alt="Logo"
              className="h-16 w-auto"
            />
          </div>
          <h2 className="text-2xl font-bold text-center text-blue-900 mb-6 uppercase">
            Quotation System Login
          </h2>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            {loginError && (
              <p className="text-red-600 text-xs font-bold text-center">
                Invalid username or password
              </p>
            )}
            <button
              type="submit"
              className="bg-blue-900 text-white font-bold py-2 px-4 rounded hover:bg-blue-800 transition-colors mt-2"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  const sendToGoogleSheet = async (data) => {
    const SCRIPT_URL =
      "https://script.google.com/macros/s/AKfycbzblZE9TLa5MTznVbKqK7uLZvM2NpGEA57CkeRzYAT4sR-sFzce3yg1HCihebF0T_wj/exec";

    const now = new Date();
    const timestamp =
      now.toLocaleDateString("en-GB") + " " + now.toLocaleTimeString("en-GB");
    const enrichedData = {
      ...data,
      saveTime: timestamp,
      country: cust.country || "",
    };
    try {
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrichedData),
      });
    } catch (err) {
      console.error("Sheet sync failed:", err);
    }
  };

  const saveCustomerToList = (customerName) => {
    if (!customerName) return;
    const trimmedName = customerName.trim();
    if (trimmedName && !customerList.includes(trimmedName)) {
      const newList = [...customerList, trimmedName].sort((a, b) =>
        a.localeCompare(b)
      );
      setCustomerList(newList);
      localStorage.setItem("RAPHAEL_CUSTOMERS", JSON.stringify(newList));
    }
  };

  const cycleRefSuffix = () => setRefSuffix((prev) => prev + 1);

  const addItem = (category) => {
    const initialDiscount =
      category === CATEGORIES.VALVES ? cust.defaultDiscount : 0;
    setItems([
      ...items,
      {
        id: Date.now(),
        category,
        code: "",
        size: "",
        qty: 1,
        discount: initialDiscount,
        isIncluded: false,
        customDesc: "",
        internalNotes: "",
        bodyMat: "",
        trimMat: "",
      },
    ]);
  };

  const duplicateRow = (index) => {
    const itemToCopy = { ...items[index], id: Date.now() + Math.random() };
    const newItems = [...items];
    newItems.splice(index + 1, 0, itemToCopy);
    setItems(newItems);
  };

  const updateItem = (id, field, value) =>
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const removeItem = (id) => setItems(items.filter((i) => i.id !== id));

  const applyGlobalDiscount = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmGlobalDiscount = () => {
    setItems(
      items.map((item) => ({ ...item, discount: cust.defaultDiscount }))
    );
    setShowConfirmModal(false);
  };

  const handleCancelGlobalDiscount = () => {
    setShowConfirmModal(false);
  };

  const handleCleanAll = () => {
    if (window.confirm("Are you sure?")) {
      setItems([]);
      setCust({
        name: "",
        contactName: "",
        email: "",
        phone: "",
        defaultDiscount: 55,
        country: "",
      });
      setIncludePacking(true);
      localStorage.removeItem("RAPHAEL_QUOTATION_DATA");
    }
  };

  const calculateRow = (item, index, ignoreMerge = false) => {
    if (!ignoreMerge && item.isIncluded)
      return { unitPrice: 0, total: 0, trimAdder: 0 };
    if (item.category !== CATEGORIES.FREE_TEXT && item.manualPrice) {
      const up = parseFloat(item.manualPrice) || 0;
      return { unitPrice: up, total: up * item.qty, trimAdder: 0 };
    }
    if (item.category === CATEGORIES.FREE_TEXT) {
      const up = parseFloat(item.price) || 0;
      return { unitPrice: up, total: up * item.qty, trimAdder: 0 };
    }
    if (item.category === CATEGORIES.VALVES) {
      if (!item.code || !item.size)
        return { unitPrice: 0, total: 0, trimAdder: 0 };

      const baseTable =
        masterData &&
        masterData.PRICES_STD &&
        Object.keys(masterData.PRICES_STD).length > 0
          ? masterData.PRICES_STD
          : currency === "USD"
          ? PRICES_STD_USD
          : PRICES_STD_EUR;

      const basePrice = baseTable?.[item.code]?.[item.size] || 0;
      const discountedBase = basePrice * (1 - item.discount / 100);
      const bodyAdder = item.bodyMat
        ? BODY_MATERIAL_ADDONS[item.bodyMat]?.[item.size] || 0
        : 0;
      let trimAdder = 0;
      if (item.trimMat === "Full Sea Water Trim") trimAdder = 10000;
      else if (item.trimMat && item.trimMat !== "Copper/Brass") {
        const hgTable =
          masterData && masterData.PRICES_HG
            ? masterData.PRICES_HG
            : currency === "USD"
            ? PRICES_HG_USD
            : PRICES_HG_EUR;
        trimAdder = Math.max(
          0,
          (hgTable?.[item.code]?.[item.size] || basePrice) - basePrice
        );
      }
      let unitPrice = discountedBase + bodyAdder + trimAdder;
      if (!ignoreMerge) {
        for (let i = index + 1; i < items.length; i++) {
          if (items[i].isIncluded) {
            const mergedVal = calculateRow(items[i], i, true);
            unitPrice += mergedVal.unitPrice * items[i].qty;
          } else break;
        }
      }
      return { unitPrice, total: unitPrice * item.qty, trimAdder };
    } else {
      const db =
        item.category === CATEGORIES.DIAPHRAGMS
          ? DIAPHRAGMS_DB
          : ACCESSORIES_DB;
      const base = db[item.code] || 0;
      const factor = item.category === CATEGORIES.SPARE_PARTS ? 1.5 : 1;
      const unitPrice = base * factor * (1 - item.discount / 100);
      return { unitPrice, total: unitPrice * item.qty, trimAdder: 0 };
    }
  };

  const toggleMerge = (id, index) => {
    if (
      !items.slice(0, index).some((x) => x.category === CATEGORIES.VALVES) &&
      !items[index].isIncluded
    ) {
      return alert("No valve above.");
    }
    updateItem(id, "isIncluded", !items[index].isIncluded);
  };

  const subTotal = items.reduce(
    (sum, item, idx) => sum + calculateRow(item, idx).total,
    0
  );
  const packingCost = includePacking ? subTotal * 0.035 : 0;
  const grandTotal = subTotal + packingCost;
  const currencySymbol = currency === "USD" ? "$" : "€";

  const handleExportPDF = async () => {
    try {
      saveCustomerToList(cust.name);
      sendToGoogleSheet({
        date: new Date().toLocaleDateString("en-GB"),
        reference: ref,
        customer: cust.name,
        amount: grandTotal.toFixed(2),
        currency: currencySymbol,
        preparedBy: salesPerson,
        contact: cust.contactName,
        status: "Sent",
      });
      const blob = await createGlobalPDFBlob(
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
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${getGenerateFileName(cust.name, ref)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Saving PDF failed!");
    }
  };

  const handleExportExcel = () => {
    try {
      saveCustomerToList(cust.name);
      sendToGoogleSheet({
        date: new Date().toLocaleDateString("en-GB"),
        reference: ref,
        customer: cust.name,
        amount: grandTotal.toFixed(2),
        currency: currencySymbol,
        preparedBy: salesPerson,
        contact: cust.contactName,
        status: "Sent",
      });
      const blob = createGlobalExcelBlob(
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
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${getGenerateFileName(cust.name, ref)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Saving Excel failed!");
    }
  };

  const handleSmartSave = async () => {
    await handleSmartSaveService({
      cust,
      ref,
      jsonData: {
        items,
        cust,
        salesPerson,
        currency,
        terms,
        ref,
        grandTotal,
      },
      onBeforeSave: async () => {
        saveCustomerToList(cust.name);
        await sendToGoogleSheet({
          date: new Date().toLocaleDateString("en-GB"),
          reference: ref,
          customer: cust.name,
          amount: grandTotal.toFixed(2),
          currency: currencySymbol,
          preparedBy: salesPerson,
          contact: cust.contactName,
          status: "Sent",
        });
      },
      getPdfBlob: () =>
        createGlobalPDFBlob(
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
        ),
      getExcelBlob: () =>
        createGlobalExcelBlob(
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
        ),
    });
  };

  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (importedData.items) setItems(importedData.items);
        if (importedData.cust) setCust(importedData.cust);
        if (importedData.currency) setCurrency(importedData.currency);
        if (importedData.terms) setTerms(importedData.terms);
        alert("Quotation imported successfully!");
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="min-h-screen bg-gray-50 p-2 md:p-8 font-sans text-gray-900"
      dir="ltr"
    >
      <div className="max-w-7xl mx-auto bg-white shadow-xl rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-900 text-white p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start w-full md:w-auto">
            <img
              src="/raphael_logo_final.png"
              alt="Logo"
              className="h-12 w-auto mb-4 bg-white rounded p-1"
            />
            <h1 className="text-2xl md:text-3xl font-bold uppercase">
              RAPHAEL VALVES QUOTATION FORM
            </h1>
            <div className="flex flex-col gap-2 mt-2 bg-blue-800 p-2 rounded">
              <div className="flex items-center gap-2">
                <span className="text-blue-200 text-xs">Ref:</span>
                <span className="font-mono font-bold">{ref}</span>
                <button
                  onClick={cycleRefSuffix}
                  className="bg-blue-600 px-2 py-0.5 rounded text-[10px]"
                >
                  + ID
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-200 text-xs">Prepared By:</span>
                <select
                  className="text-black text-xs rounded p-1"
                  value={salesPerson}
                  onChange={(e) => setSalesPerson(e.target.value)}
                >
                  {SALES_PEOPLE.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-4 w-full md:w-auto">
            <div className="text-right w-full flex justify-between md:block">
              <label className="block text-xs text-blue-200">Currency</label>
              <select
                className="text-black rounded px-2 py-1 text-sm font-bold"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
              <div className="flex items-center justify-end gap-1.5 mt-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    syncStatus.isOnline ? "bg-green-400" : "bg-red-500"
                  } inline-block`}
                ></span>
                <span className="text-[11px] text-blue-200 font-mono">
                  {syncStatus.lastUpdated}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto items-end">
              <div className="flex gap-2">
                <button
                  onClick={handleExportPDF}
                  className="bg-slate-500 text-white font-bold py-1 px-4 rounded text-sm"
                >
                  Export PDF
                </button>
                <button
                  onClick={handleExportExcel}
                  className="bg-green-600 text-white font-bold py-1 px-4 rounded text-sm"
                >
                  Export Excel
                </button>
              </div>
              <button
                onClick={handleSmartSave}
                className="w-[218px] bg-yellow-400 text-blue-900 font-bold rounded py-2 text-[11px]"
              >
                📂 SMART SAVE (PDF + EXCEL)
              </button>
              <label className="bg-pink-500 text-white font-bold py-2 px-4 rounded shadow-md text-sm cursor-pointer hover:bg-pink-600 flex items-center justify-center">
                IMPORT JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Customer Details */}
        <div className="p-4 md:p-6 bg-gray-100 border-b">
          <h3 className="text-sm font-bold mb-3 uppercase">Customer Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              list="customers-list"
              className="p-2 border rounded"
              value={cust.name}
              onChange={(e) => setCust({ ...cust, name: e.target.value })}
              placeholder="Company Name"
            />
            <datalist id="customers-list">
              {customerList.map((c, i) => (
                <option key={i} value={c} />
              ))}
            </datalist>

            <input
              className="p-2 border rounded"
              value={cust.contactName}
              onChange={(e) =>
                setCust({ ...cust, contactName: e.target.value })
              }
              placeholder="Contact Person"
            />
            {/* Country Input + Datalist */}
            <input
              list="countries-list"
              className="p-2 border rounded"
              value={cust.country || ""}
              onChange={(e) => setCust({ ...cust, country: e.target.value })}
              placeholder="Country"
            />
            <datalist id="countries-list">
              {COUNTRIES.map((country, i) => (
                <option key={i} value={country} />
              ))}
            </datalist>

            <input
              className="p-2 border rounded"
              value={cust.email}
              onChange={(e) => setCust({ ...cust, email: e.target.value })}
              placeholder="Email"
            />
            <input
              className="p-2 border rounded"
              value={cust.phone}
              onChange={(e) => setCust({ ...cust, phone: e.target.value })}
              placeholder="Phone"
            />
            <div className="bg-white p-2 rounded border border-blue-200 flex gap-2">
              <input
                type="number"
                className="p-1 border rounded w-16 font-bold"
                value={cust.defaultDiscount}
                onChange={(e) =>
                  setCust({
                    ...cust,
                    defaultDiscount: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <button
                onClick={applyGlobalDiscount}
                className="text-[10px] bg-blue-100 px-2 rounded"
              >
                Apply %
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white border-b flex flex-wrap gap-2">
          <button
            onClick={() => addItem(CATEGORIES.VALVES)}
            className="bg-green-600 text-white px-3 py-2 rounded text-xs"
          >
            + Valve
          </button>
          <button
            onClick={() => addItem(CATEGORIES.ACCESSORIES)}
            className="bg-blue-600 text-white px-3 py-2 rounded text-xs"
          >
            + Accessory
          </button>
          <button
            onClick={() => addItem(CATEGORIES.SPARE_PARTS)}
            className="bg-amber-800 text-white px-3 py-2 rounded text-xs"
          >
            + Spare Part
          </button>
          <button
            onClick={() => addItem(CATEGORIES.DIAPHRAGMS)}
            className="bg-purple-600 text-white px-3 py-2 rounded text-xs"
          >
            + Diaphragm
          </button>
          <button
            onClick={() => addItem(CATEGORIES.FREE_TEXT)}
            className="bg-teal-500 text-white px-3 py-2 rounded text-xs"
          >
            + Free Text
          </button>
        </div>

        {/* Items Table */}
        <div className="p-2 md:p-6 overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse min-w-[800px]">
            <thead className="bg-gray-200 text-black uppercase text-xs">
              <tr>
                <th className="px-2 py-3 w-20">Type</th>
                <th className="px-2 py-3">Description</th>
                <th className="px-2 py-3 w-24 text-center">Size</th>
                <th className="px-2 py-3 w-20 text-center">Qty</th>
                <th className="px-2 py-3 w-28 text-right bg-blue-50">
                  Unit Price
                </th>
                <th className="px-2 py-3 w-20 text-center bg-blue-50">
                  Disc %
                </th>
                <th className="px-2 py-3 w-32 text-right">Total</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const financials = calculateRow(item, idx);
                const isValve = item.category === CATEGORIES.VALVES;
                const isFreeText = item.category === CATEGORIES.FREE_TEXT;
                let opts = isValve
                  ? Object.keys(PRODUCTS_DB)
                  : item.category === CATEGORIES.DIAPHRAGMS
                  ? Object.keys(DIAPHRAGMS_DB)
                  : SORTED_ACCESSORIES_KEYS;
                return (
                  <tr
                    key={item.id}
                    className={`border-b transition-colors ${
                      item.isIncluded
                        ? "bg-blue-50/50 opacity-70 italic"
                        : idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/50"
                    } hover:bg-blue-100/50`}
                  >
                    <td className="px-2 py-3 text-xs font-bold uppercase">
                      {item.category}
                    </td>
                    <td className="px-2 py-3">
                      {isFreeText ? (
                        <div className="flex flex-col gap-1">
                          <input
                            className="border rounded p-1 font-bold"
                            value={item.code}
                            onChange={(e) =>
                              updateItem(item.id, "code", e.target.value)
                            }
                            placeholder="Code"
                          />
                          <input
                            className="border rounded p-1"
                            value={item.description}
                            onChange={(e) =>
                              updateItem(item.id, "description", e.target.value)
                            }
                            placeholder="Description"
                          />
                        </div>
                      ) : (
                        <select
                          className="w-full border rounded p-1 font-bold"
                          value={item.code}
                          onChange={(e) =>
                            updateItem(item.id, "code", e.target.value)
                          }
                        >
                          <option value="">Select...</option>
                          {opts.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      )}
                      <textarea
                        className="w-full text-xs border p-1 mt-1 italic"
                        value={item.customDesc}
                        onChange={(e) =>
                          updateItem(item.id, "customDesc", e.target.value)
                        }
                        placeholder="Notes..."
                        rows="1"
                      />
                      <textarea
                        className="w-full text-xs border p-1 mt-1 bg-red-50 text-red-800 italic"
                        value={item.internalNotes}
                        onChange={(e) =>
                          updateItem(item.id, "internalNotes", e.target.value)
                        }
                        placeholder="INTERNAL NOTES"
                        rows="1"
                      />
                      {isValve && (
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <select
                            className="text-xs border rounded"
                            value={item.bodyMat}
                            onChange={(e) =>
                              updateItem(item.id, "bodyMat", e.target.value)
                            }
                          >
                            <option value="">Body...</option>
                            {OPTIONS.bodyMaterials.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                          <select
                            className="text-xs border rounded"
                            value={item.trimMat}
                            onChange={(e) =>
                              updateItem(item.id, "trimMat", e.target.value)
                            }
                          >
                            <option value="">Trim...</option>
                            {OPTIONS.trimMaterials.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center">
                      {isValve ? (
                        <select
                          className="border rounded p-1"
                          value={item.size}
                          onChange={(e) =>
                            updateItem(item.id, "size", e.target.value)
                          }
                        >
                          <option value="">DN...</option>
                          {OPTIONS.sizes.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <input
                        type="number"
                        className="w-full border rounded p-1 text-center font-bold"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "qty",
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-3 text-right bg-blue-50">
                      <input
                        type="number"
                        className="w-full border rounded p-1 text-right font-mono"
                        value={
                          isFreeText ? item.price || "" : item.manualPrice || ""
                        }
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            isFreeText ? "price" : "manualPrice",
                            e.target.value
                          )
                        }
                        placeholder={financials.unitPrice.toFixed(2)}
                      />
                    </td>
                    <td className="px-2 py-3 bg-blue-50">
                      <input
                        type="number"
                        className="w-full border rounded p-1 text-center text-red-600 font-bold"
                        value={item.discount}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "discount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={isFreeText}
                      />
                    </td>
                    <td className="px-2 py-3 text-right font-bold text-gray-700 border border-gray-300">
                      {formatCurrency(financials.total, currencySymbol)}
                    </td>
                    <td className="px-2 py-3 text-center border border-gray-300">
                      <div className="flex flex-col gap-2 items-center justify-center">
                        {!isValve && !isFreeText && (
                          <button
                            onClick={() => toggleMerge(item.id, idx)}
                            className={`p-1 rounded-full border ${
                              item.isIncluded
                                ? "bg-blue-600 text-white"
                                : "bg-white text-gray-400 border-gray-200"
                            }`}
                            type="button"
                          >
                            🔗
                          </button>
                        )}
                        <button
                          onClick={() => duplicateRow(idx)}
                          className="text-blue-500 hover:scale-125 transition-transform"
                          title="Duplicate Row"
                          type="button"
                        >
                          👯
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-red-300 hover:text-red-600 font-bold text-xl"
                          title="Remove Item"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Terms */}
        <div className="bg-gray-100 p-4 md:p-6 border-t">
          <h4 className="text-sm font-bold uppercase mb-2">Commercial Terms</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              className="p-2 border rounded"
              value={terms.payment}
              onChange={(e) => setTerms({ ...terms, payment: e.target.value })}
              placeholder="Payment"
            />
            <input
              className="p-2 border rounded"
              value={terms.delivery}
              onChange={(e) => setTerms({ ...terms, delivery: e.target.value })}
              placeholder="Delivery"
            />
            <input
              className="p-2 border rounded"
              value={terms.leadTime}
              onChange={(e) => setTerms({ ...terms, leadTime: e.target.value })}
              placeholder="Lead Time"
            />
            <input
              className="p-2 border rounded"
              value={terms.validity}
              onChange={(e) => setTerms({ ...terms, validity: e.target.value })}
              placeholder="Validity"
            />
          </div>
        </div>

        {/* Footer Actions & Totals */}
        <div className="bg-gray-200 p-4 md:p-6 border-t flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap gap-2 items-center flex-grow">
            <button
              onClick={handleExportPDF}
              className="bg-slate-500 text-white font-bold py-2 px-6 rounded shadow-md text-sm"
            >
              Export PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-green-600 text-white font-bold py-2 px-6 rounded shadow-md text-sm"
            >
              Export Excel
            </button>
            <button
              onClick={handleSmartSave}
              className="bg-yellow-400 text-blue-900 font-bold py-2 px-6 rounded shadow-md text-sm"
            >
              📂 SMART SAVE
            </button>
            <div className="flex-grow"></div>
            <button
              onClick={handleCleanAll}
              className="bg-red-600 text-white font-bold py-2 px-6 rounded shadow-md text-sm"
            >
              CLEAN ALL
            </button>
          </div>
          <div className="flex flex-col items-end w-full md:w-72">
            <div className="flex justify-between w-full text-sm">
              <span>Subtotal:</span>
              <span className="font-bold">
                {formatCurrency(subTotal, currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between w-full text-sm border-b border-gray-400 pb-2 mb-2 italic">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includePacking}
                  onChange={(e) => setIncludePacking(e.target.checked)}
                />
                Packing (3.5%):
              </label>
              <span
                className={
                  !includePacking ? "text-gray-400 line-through" : "font-bold"
                }
              >
                {formatCurrency(packingCost, currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between w-full items-center">
              <span className="text-xl font-black text-blue-900 uppercase">
                Grand Total:
              </span>
              <span className="text-2xl font-black text-blue-900 font-mono">
                {formatCurrency(grandTotal, currencySymbol)}
              </span>
            </div>
          </div>
        </div>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-blue-900 mb-2">
                Raphael Valves Quotation
              </h3>
              <p className="text-base font-bold text-gray-800 mb-6">
                The change will affect all prices in the quotation.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelGlobalDiscount}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGlobalDiscount}
                  className="px-4 py-2 bg-blue-900 text-white rounded font-bold text-sm"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
