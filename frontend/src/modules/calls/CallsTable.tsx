import { format } from "date-fns";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Call, CallStatus, SortableColumn, SortDir } from "@/types/calls";

interface StatusBadgeProps {
  status: CallStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "in_progress") {
    return (
      <Badge variant="in_progress">
        <Loader2 className="h-3 w-3 animate-spin" />
        In Progress
      </Badge>
    );
  }
  if (status === "success") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" />
        Success
      </Badge>
    );
  }
  return (
    <Badge variant="failed">
      <XCircle className="h-3 w-3" />
      Failed
    </Badge>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface CallsTableProps {
  calls: Call[];
  onRowClick: (call: Call) => void;
  sortBy?: SortableColumn;
  sortDir: SortDir;
  onSort: (column: SortableColumn) => void;
}

const COLUMNS: { key: SortableColumn; label: string }[] = [
  { key: "phone_number", label: "Phone" },
  { key: "caller_name", label: "Caller" },
  { key: "status", label: "Status" },
  { key: "label", label: "Label" },
  { key: "duration_seconds", label: "Duration" },
  { key: "started_at", label: "Started At" },
];

function SortableHeader({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
}: {
  column: SortableColumn;
  label: string;
  sortBy?: SortableColumn;
  sortDir: SortDir;
  onSort: (column: SortableColumn) => void;
}) {
  const active = sortBy === column;
  return (
    <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
      <button
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

export function CallsTable({ calls, onRowClick, sortBy, sortDir, onSort }: CallsTableProps) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Phone className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">No calls found</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          No calls match your current filters. Try adjusting them or run the seed script to
          generate test data.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => (
              <SortableHeader
                key={col.key}
                column={col.key}
                label={col.label}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
              />
            ))}
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {calls.map((call) => (
            <tr
              key={call.id}
              onClick={() => onRowClick(call)}
              className="group hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <td className="py-3 px-4 font-mono text-xs text-foreground">{call.phone_number}</td>
              <td className="py-3 px-4 text-foreground">{call.caller_name ?? "—"}</td>
              <td className="py-3 px-4">
                <StatusBadge status={call.status} />
              </td>
              <td className="py-3 px-4">
                {call.label ? (
                  <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border border-border bg-muted text-foreground">
                    {call.label}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
              <td className="py-3 px-4 tabular-nums text-muted-foreground">
                {formatDuration(call.duration_seconds)}
              </td>
              <td className="py-3 px-4 tabular-nums text-muted-foreground">
                {format(new Date(call.started_at), "MMM d, HH:mm:ss")}
              </td>
              <td className="py-3 px-4">
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
