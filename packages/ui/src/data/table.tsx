import type { CSSProperties, ReactNode } from 'react';

import { Blueprint } from '../primitives/blueprint';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  width?: number | string;
  render: (row: Row, index: number) => ReactNode;
  /** Renders under the row as an indented detail line. */
  mono?: boolean;
}

export interface DataTableProps<Row> {
  columns: Array<Column<Row>>;
  rows: Row[];
  rowKey: (row: Row, index: number) => string;
  /** An expandable detail line rendered under each row. */
  detail?: (row: Row, index: number) => ReactNode;
  onRowClick?: (row: Row, index: number) => void;
  /** Section label rendered inside the frame, above the header row. */
  caption?: ReactNode;
  /** Summary strip rendered inside the frame, below the last row. */
  footer?: ReactNode;
  empty?: ReactNode;
  style?: CSSProperties;
}

/**
 * The framed data table.
 *
 * Wraps `.table` in a Blueprint and a horizontal scroll container, so a wide
 * table scrolls inside its own box and the page never scrolls sideways
 * (screens.md §13.3). Every table in the product goes through this.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  detail,
  onRowClick,
  caption,
  footer,
  empty = 'Nothing to show.',
  style,
}: DataTableProps<Row>) {
  return (
    <Blueprint style={style}>
      {caption ? (
        <div className="kicker" style={{ padding: '14px 20px 0' }}>
          {caption}
        </div>
      ) : null}

      <div className="riv-scroll-x">
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={{ textAlign: c.align ?? 'left', width: c.width }}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ color: 'var(--color-neutral-600)', padding: '18px 14px' }}
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.flatMap((row, i) => {
                const detailNode = detail?.(row, i);
                const cells = (
                  <tr
                    key={rowKey(row, i)}
                    onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                    style={onRowClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={c.mono ? 'mono' : undefined}
                        style={{ textAlign: c.align ?? 'left' }}
                      >
                        {c.render(row, i)}
                      </td>
                    ))}
                  </tr>
                );

                if (!detailNode) return [cells];

                return [
                  cells,
                  <tr key={`${rowKey(row, i)}-detail`}>
                    <td
                      colSpan={columns.length}
                      style={{
                        fontSize: 12,
                        color: 'var(--color-neutral-600)',
                        paddingTop: 0,
                      }}
                    >
                      ▸ {detailNode}
                    </td>
                  </tr>,
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {footer ? (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--color-neutral-300)',
            fontSize: 12.5,
            color: 'var(--color-neutral-700)',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          {footer}
        </div>
      ) : null}
    </Blueprint>
  );
}
