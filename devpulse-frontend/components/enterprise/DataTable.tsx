"use client";
import { useState, useMemo } from "react";
import { LoadingSkeleton, EmptyState } from "./States";

interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: string;
  onRowClick?: (item: T) => void;
  pageSize?: number;
  maxHeight?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading,
  searchable,
  searchPlaceholder = "Search...",
  searchKeys,
  emptyTitle = "No data",
  emptyDescription = "No matching records found.",
  emptyIcon = "inventory_2",
  onRowClick,
  pageSize = 50,
  maxHeight,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    if (!search || !searchKeys) return data;
    const q = search.toLowerCase();
    return data.filter((item) =>
      searchKeys.some((k) => {
        const v = item[k];
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    return [...filtered].sort((a, b) => {
      const va = col?.sortValue ? col.sortValue(a) : String(a[sortKey as keyof T] ?? "");
      const vb = col?.sortValue ? col.sortValue(b) : String(b[sortKey as keyof T] ?? "");
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (isLoading) return <LoadingSkeleton rows={6} />;
  if (sorted.length === 0)
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;

  return (
    <div>
      {searchable && (
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-[#1a1f2e] border border-[#14b8a6]/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]/30 outline-none transition-all"
          />
        </div>
      )}
      <div
        className="overflow-x-auto"
        style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#14b8a6]/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  className={`text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.sortable ? "cursor-pointer hover:text-white select-none" : ""} ${col.className ?? ""}`}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="material-symbols-outlined text-sm">
                        {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, pageSize).map((item, idx) => (
              <tr
                key={item.id ?? idx}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={`border-b border-white/5 transition-colors ${onRowClick ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-3 ${col.className ?? ""}`}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length > pageSize && (
          <p className="text-center text-gray-500 text-xs py-3">
            Showing {pageSize} of {sorted.length} records
          </p>
        )}
      </div>
    </div>
  );
}
