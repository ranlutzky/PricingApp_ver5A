import React, { useState } from "react";

// רשימות דוגמה/Presets שניתן להרחיב בהמשך
const COMPANY_PRESETS = [
  "Raphael Valves",
  "Tallis",
  "Aguas de Valencia",
  "Suez Water",
  "Veolia Environment",
];

const COUNTRY_PRESETS = [
  "Spain",
  "Portugal",
  "France",
  "Italy",
  "Brazil",
  "Colombia",
  "Mexico",
  "Germany",
  "United States",
];

export default function CustomerDetails({
  quoteDetails,
  setQuoteDetails,
  onApplyGlobalDiscount,
}) {
  const [globalDiscount, setGlobalDiscount] = useState(55);

  const handleChange = (field, value) => {
    setQuoteDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    if (onApplyGlobalDiscount) {
      onApplyGlobalDiscount(parseFloat(globalDiscount) || 0);
    }
  };

  return (
    <div className="bg-white p-4 rounded-b-md shadow-sm mb-6 border-x border-b border-gray-200">
      <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
        Customer Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        {/* Company Name עם רשימת בחירה והקלדה חופשית */}
        <div className="flex flex-col">
          <input
            type="text"
            list="company-list"
            placeholder="Company Name"
            value={quoteDetails.companyName || ""}
            onChange={(e) => handleChange("companyName", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <datalist id="company-list">
            {COMPANY_PRESETS.map((company, index) => (
              <option key={index} value={company} />
            ))}
          </datalist>
        </div>

        {/* Contact Person */}
        <div className="flex flex-col">
          <input
            type="text"
            placeholder="Contact Person"
            value={quoteDetails.contactPerson || ""}
            onChange={(e) => handleChange("contactPerson", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Country עם רשימת בחירה והקלדה חופשית */}
        <div className="flex flex-col">
          <input
            type="text"
            list="country-list"
            placeholder="Country"
            value={quoteDetails.country || ""}
            onChange={(e) => handleChange("country", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
          <datalist id="country-list">
            {COUNTRY_PRESETS.map((country, index) => (
              <option key={index} value={country} />
            ))}
          </datalist>
        </div>

        {/* Email */}
        <div className="flex flex-col">
          <input
            type="email"
            placeholder="Email"
            value={quoteDetails.email || ""}
            onChange={(e) => handleChange("email", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Phone */}
        <div className="flex flex-col">
          <input
            type="text"
            placeholder="Phone"
            value={quoteDetails.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* שדה הנחה כוללת והכפתור */}
      <div className="flex items-center gap-2 max-w-xs bg-gray-50 p-2 rounded border border-gray-200">
        <input
          type="number"
          min="0"
          max="100"
          value={globalDiscount}
          onChange={(e) => setGlobalDiscount(e.target.value)}
          className="w-16 p-1 border border-gray-300 rounded text-center text-sm font-bold bg-white"
        />
        <button
          type="button"
          onClick={handleApply}
          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 font-bold text-xs rounded border border-blue-300 cursor-pointer"
        >
          Apply %
        </button>
      </div>
    </div>
  );
}
