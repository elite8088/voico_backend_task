import { useState } from "react";
import { Plus, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CALL_LABELS, type CallLabel } from "@/types/calls";

export interface CallsFilters {
  caller_name?: string;
  phone_number?: string;
  label?: CallLabel;
  min_duration?: number;
  max_duration?: number;
}

type FilterField = keyof CallsFilters;

const FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: "caller_name", label: "Caller name" },
  { value: "phone_number", label: "Phone number" },
  { value: "label", label: "Label" },
  { value: "min_duration", label: "Min duration (s)" },
  { value: "max_duration", label: "Max duration (s)" },
];

function fieldLabel(field: FilterField): string {
  return FIELD_OPTIONS.find((o) => o.value === field)?.label ?? field;
}

const inputClass =
  "h-8 rounded-md border border-border bg-white px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface CallsFilterBarProps {
  filters: CallsFilters;
  onChange: (filters: CallsFilters) => void;
}

export function CallsFilterBar({ filters, onChange }: CallsFilterBarProps) {
  const [field, setField] = useState<FilterField>("caller_name");
  const [textValue, setTextValue] = useState("");

  const activeEntries = (Object.entries(filters) as [FilterField, string | number][]).filter(
    ([, v]) => v !== undefined && v !== "",
  );

  function applyFilter(value: string | number) {
    onChange({ ...filters, [field]: value });
    setTextValue("");
  }

  function handleAdd() {
    if (field === "min_duration" || field === "max_duration") {
      const n = Number(textValue);
      if (textValue.trim() === "" || Number.isNaN(n)) return;
      applyFilter(n);
    } else if (field === "label") {
      return;
    } else {
      if (textValue.trim() === "") return;
      applyFilter(textValue.trim());
    }
  }

  function removeFilter(key: FilterField) {
    const next = { ...filters };
    delete next[key];
    onChange(next);
  }

  function clearAll() {
    onChange({});
  }

  const isNumberField = field === "min_duration" || field === "max_duration";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>

        <select
          value={field}
          onChange={(e) => {
            setField(e.target.value as FilterField);
            setTextValue("");
          }}
          className={inputClass}
        >
          {FIELD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {field === "label" ? (
          <select
            value={(filters.label as string) ?? ""}
            onChange={(e) =>
              onChange({
                ...filters,
                label: e.target.value ? (e.target.value as CallLabel) : undefined,
              })
            }
            className={inputClass}
          >
            <option value="">Select label...</option>
            {CALL_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              type={isNumberField ? "number" : "text"}
              value={textValue}
              min={isNumberField ? 0 : undefined}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              placeholder={isNumberField ? "seconds" : `Filter by ${fieldLabel(field).toLowerCase()}`}
              className={`${inputClass} w-48`}
            />
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </>
        )}
      </div>

      {activeEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeEntries.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              <span className="text-muted-foreground">{fieldLabel(key)}:</span>
              {String(value)}
              <button
                onClick={() => removeFilter(key)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${fieldLabel(key)} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
