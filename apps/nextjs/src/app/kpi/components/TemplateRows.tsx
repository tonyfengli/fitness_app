"use client";

// Single value row
export function TemplateRow({
  label,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  bold = false,
  highlight = false,
  prefix = "",
  isCurrency = true,
  exportMode = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  bold?: boolean;
  highlight?: boolean;
  prefix?: string;
  isCurrency?: boolean;
  exportMode?: boolean;
}) {
  // In export mode, highlighted fields render as static text
  const showAsStatic = readOnly || (exportMode && highlight);

  return (
    <div className={`flex items-center justify-between px-4 py-2 ${disabled ? "bg-gray-50" : ""}`}>
      <span className={`text-sm ${disabled ? "text-gray-400" : "text-gray-700"} ${bold ? "font-semibold" : ""}`}>
        {label}
      </span>
      <div className="flex items-center">
        {prefix && <span className="text-sm text-gray-500 mr-1">{prefix}</span>}
        {showAsStatic ? (
          <span className={`text-sm ${bold ? "font-semibold" : ""} text-gray-900 min-w-24 text-right`}>
            {value ? (prefix ? value : isCurrency ? `$${value}` : value) : "—"}
          </span>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            className={`w-28 px-2 py-1 text-sm text-right border rounded
              ${
                disabled
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : highlight
                    ? "bg-green-50 border-green-300 text-gray-900"
                    : "bg-white border-gray-300 text-gray-900"
              }
              focus:outline-none focus:ring-1 focus:ring-blue-500`}
            placeholder={disabled ? "—" : ""}
          />
        )}
      </div>
    </div>
  );
}

// Double value row (for retention section)
export function TemplateRowDouble({
  label,
  value1,
  value2,
  onChange1,
  onChange2,
  header1,
  header2,
  readOnly = false,
  bold = false,
  highlight = false,
  exportMode = false,
}: {
  label: string;
  value1: string;
  value2: string;
  onChange1?: (value: string) => void;
  onChange2?: (value: string) => void;
  header1?: string;
  header2?: string;
  readOnly?: boolean;
  bold?: boolean;
  highlight?: boolean;
  exportMode?: boolean;
}) {
  // In export mode, highlighted fields render as static text
  const showAsStatic = readOnly || (exportMode && highlight);

  return (
    <div className="px-4 py-2">
      {header1 && header2 && (
        <div className="flex justify-end gap-2 mb-1">
          <span className="w-20 text-xs text-gray-500 text-center">{header1}</span>
          <span className="w-20 text-xs text-gray-500 text-center">{header2}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-sm text-gray-700 ${bold ? "font-semibold" : ""}`}>{label}</span>
        <div className="flex gap-2">
          {showAsStatic ? (
            <>
              <span className={`w-20 text-sm text-center ${bold ? "font-semibold" : ""}`}>{value1 || "—"}</span>
              <span className={`w-20 text-sm text-center ${bold ? "font-semibold" : ""}`}>
                {value2 ? `$${value2}` : "—"}
              </span>
            </>
          ) : (
            <>
              <input
                type="text"
                value={value1}
                onChange={(e) => onChange1?.(e.target.value)}
                className={`w-20 px-2 py-1 text-sm text-center border rounded
                  ${highlight ? "bg-green-50 border-green-300" : "bg-white border-gray-300"}
                  focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
              <input
                type="text"
                value={value2}
                onChange={(e) => onChange2?.(e.target.value)}
                className={`w-20 px-2 py-1 text-sm text-center border rounded
                  ${highlight ? "bg-green-50 border-green-300" : "bg-white border-gray-300"}
                  focus:outline-none focus:ring-1 focus:ring-blue-500`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
