"use client";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  computed?: boolean;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T extends object> {
  title?: string;
  columns: Column<T>[];
  data: T[];
  toolbar?: React.ReactNode;
  emptyMessage?: string;
  getRowKey?: (row: T, index: number) => string;
}

export default function DataTable<T extends object>({
  title,
  columns,
  data,
  toolbar,
  emptyMessage = "No records found.",
  getRowKey,
}: DataTableProps<T>) {
  return (
    <div className="table-wrapper">
      {(title || toolbar) && (
        <div className="table-toolbar">
          {title && <span className="table-title">{title}</span>}
          {toolbar && <div className="flex gap-2">{toolbar}</div>}
        </div>
      )}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  style={{ textAlign: col.align ?? "left" }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", padding: "28px", color: "#6b7a92", fontSize: "13px" }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={getRowKey ? getRowKey(row, i) : i}>
                  {columns.map((col) => {
                    const val = (row as Record<string, unknown>)[String(col.key)];
                    return (
                      <td
                        key={String(col.key)}
                        className={col.computed ? "col-computed" : ""}
                        style={{ textAlign: col.align ?? "left" }}
                      >
                        {col.render ? col.render(row) : String(val ?? "")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
