export type ColType = 'text' | 'number' | 'real';

export interface ColDef {
  col: string;   // SQL column name (snake_case)
  type: ColType;
}

export interface TableDef {
  table: string; // SQL table name
  path: string;  // URL path segment e.g. 'trend/pagespeed'
  columns: Record<string, ColDef>;
}

export type Schema = Record<string, TableDef>;

export function defineSchema<T extends Schema>(schema: T): T {
  return schema;
}

// Derive TypeScript row type from column definitions
export type ColValue<T extends ColType> =
  T extends 'text' ? string : number;

export type RowType<T extends Record<string, ColDef>> = {
  [K in keyof T]?: ColValue<T[K]['type']>;
};
