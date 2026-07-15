import { Subquery } from "./subquery.cjs";
import { SelectedFieldsFlat } from "./operations.cjs";
import { Cache } from "./cache/core/cache.cjs";
import { Logger } from "./logger.cjs";
import { AnyRelations, EmptyRelations } from "./relations.cjs";
import { Table } from "./table.cjs";
import { Param, SQL, View } from "./sql/sql.cjs";
import { AnyColumn, Column } from "./column.cjs";

//#region src/utils.d.ts
declare function haveSameKeys(left: Record<string, unknown>, right: Record<string, unknown>): boolean;
type UpdateSet = Record<string, SQL | Param | AnyColumn | null | undefined>;
type OneOrMany<T> = T | T[];
type Update<T, TUpdate> = { [K in Exclude<keyof T, keyof TUpdate>]: T[K] } & TUpdate;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type Not<T extends boolean> = T extends true ? false : true;
type IsNever<T> = [T] extends [never] ? true : false;
type IsUnion<T, U extends T = T> = (T extends any ? (U extends T ? false : true) : never) extends false ? false : true;
type SingleKeyObject<T, TError extends string, K = keyof T> = IsNever<K> extends true ? never : IsUnion<K> extends true ? DrizzleTypeError<TError> : T;
type FromSingleKeyObject<T, Result, TError extends string, K = keyof T> = IsNever<K> extends true ? never : IsUnion<K> extends true ? DrizzleTypeError<TError> : Result;
type SimplifyMappedType<T> = [T] extends [unknown] ? T : never;
type ShallowRecord<K extends keyof any, T> = SimplifyMappedType<{ [P in K]: T }>;
type Assume<T, U> = T extends U ? T : U;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
interface DrizzleTypeError<T extends string> {
  $drizzleTypeError: T;
}
type ValueOrArray<T> = T | T[];
type Or<T1, T2> = T1 extends true ? true : T2 extends true ? true : false;
type IfThenElse<If, Then, Else> = If extends true ? Then : Else;
type PromiseOf<T> = T extends Promise<infer U> ? U : T;
type Writable<T> = { -readonly [P in keyof T]: T[P] };
type NonArray<T> = T extends any[] ? never : T;
/**
 * @deprecated
 * Use `getColumns` instead
 */
declare function getTableColumns<T extends Table>(table: T): T['_']['columns'];
declare function getViewSelectedFields<T extends View>(view: T): T['_']['selectedFields'];
declare function getColumns<T extends Table | View | Subquery>(table: T): T extends Table ? T['_']['columns'] : T extends View ? T['_']['selectedFields'] : T extends Subquery ? T['_']['selectedFields'] : never;
type ColumnsWithTable<TTableName extends string, TForeignTableName extends string, TColumns extends AnyColumn<{
  tableName: TTableName;
}>[]> = { [Key in keyof TColumns]: AnyColumn<{
  tableName: TForeignTableName;
}> };
type Casing = 'snake_case' | 'camelCase';
interface DrizzleConfig<TSchema extends Record<string, unknown> = Record<string, never>, TRelationConfigs extends AnyRelations = EmptyRelations> {
  logger?: boolean | Logger | undefined;
  schema?: TSchema | undefined;
  casing?: Casing | undefined;
  relations?: TRelationConfigs | undefined;
  cache?: Cache | undefined;
}
type ValidateShape<T, ValidShape, TResult = T> = T extends ValidShape ? Exclude<keyof T, keyof ValidShape> extends never ? TResult : DrizzleTypeError<`Invalid key(s): ${Exclude<(keyof T) & (string | number | bigint | boolean | null | undefined), keyof ValidShape>}`> : never;
type KnownKeysOnly<T, U> = { [K in keyof T]: K extends keyof U ? T[K] : never };
type IsAny<T> = 0 extends (1 & T) ? true : false;
type IfNotImported<T, Y, N> = unknown extends T ? Y : N;
type ImportTypeError<TPackageName extends string> = `Please install \`${TPackageName}\` to allow Drizzle ORM to connect to the database`;
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Keys extends any ? Required<Pick<T, Keys>> & Partial<Omit<T, Keys>> : never;
declare function isConfig(data: any): boolean;
type NeonAuthToken = string | (() => string | Promise<string>);
declare const textDecoder: TextDecoder | null;
declare function assertUnreachable(_x: never | undefined): never;
declare function isWithEnum(column: Column<any>): column is typeof column & {
  enumValues: [string, ...string[]];
};
declare function isWithEnum(value: unknown): value is {
  enumValues: [string, ...string[]];
};
type Literal = string | number | boolean | null;
type Json = Literal | {
  [key: string]: any;
} | any[];
type ColumnIsGeneratedAlwaysAs<TColumn> = TColumn extends Column<any> ? TColumn['_']['identity'] extends 'always' ? true : TColumn['_'] extends {
  generated: undefined;
} ? false : TColumn['_']['generated'] extends {
  type: 'byDefault';
} ? false : true : false;
type GetSelection<T extends SelectedFieldsFlat<Column<any>> | Table<any> | View> = T extends Table<any> ? T['_']['columns'] : T extends View ? T['_']['selectedFields'] : T;
type RemoveNeverElements<T extends any[]> = T extends [infer First, ...infer Rest] ? IsNever<First> extends true ? RemoveNeverElements<Rest> : [First, ...RemoveNeverElements<Rest>] : [];
type HasBaseColumn<TColumn> = TColumn extends {
  _: {
    baseColumn: Column | undefined;
  };
} ? IsNever<TColumn['_']['baseColumn']> extends false ? true : false : false;
type EnumValuesToEnum<TEnumValues extends [string, ...string[]]> = { [K in TEnumValues[number]]: K };
type EnumValuesToReadonlyEnum<TEnumValues extends [string, ...string[]]> = { readonly [K in TEnumValues[number]]: K };
declare const CONSTANTS: {
  INT8_MIN: number;
  INT8_MAX: number;
  INT8_UNSIGNED_MAX: number;
  INT16_MIN: number;
  INT16_MAX: number;
  INT16_UNSIGNED_MAX: number;
  INT24_MIN: number;
  INT24_MAX: number;
  INT24_UNSIGNED_MAX: number;
  INT32_MIN: number;
  INT32_MAX: number;
  INT32_UNSIGNED_MAX: number;
  INT48_MIN: number;
  INT48_MAX: number;
  INT48_UNSIGNED_MAX: number;
  INT64_MIN: bigint;
  INT64_MAX: bigint;
  INT64_UNSIGNED_MAX: bigint;
};
//#endregion
export { Assume, CONSTANTS, Casing, ColumnIsGeneratedAlwaysAs, ColumnsWithTable, DrizzleConfig, DrizzleTypeError, EnumValuesToEnum, EnumValuesToReadonlyEnum, Equal, FromSingleKeyObject, GetSelection, HasBaseColumn, IfNotImported, IfThenElse, ImportTypeError, IsAny, IsNever, IsUnion, Json, KnownKeysOnly, Literal, NeonAuthToken, NonArray, Not, OneOrMany, Or, PromiseOf, RemoveNeverElements, RequireAtLeastOne, ShallowRecord, Simplify, SimplifyMappedType, SingleKeyObject, Update, UpdateSet, ValidateShape, ValueOrArray, Writable, assertUnreachable, getColumns, getTableColumns, getViewSelectedFields, haveSameKeys, isConfig, isWithEnum, textDecoder };
//# sourceMappingURL=utils.d.cts.map