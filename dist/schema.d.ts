export type ColType = 'text' | 'number' | 'real';
export interface ColDef {
    col: string;
    type: ColType;
}
export interface TableDef {
    table: string;
    path: string;
    columns: Record<string, ColDef>;
}
export type Schema = Record<string, TableDef>;
export declare function defineSchema<T extends Schema>(schema: T): T;
export type ColValue<T extends ColType> = T extends 'text' ? string : number;
export type RowType<T extends Record<string, ColDef>> = {
    [K in keyof T]?: ColValue<T[K]['type']>;
};
