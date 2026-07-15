import { entityKind } from "../entity.cjs";
import { DrizzleConfig } from "../utils.cjs";
import { AnyRelations, EmptyRelations } from "../relations.cjs";
import { BaseSQLiteDatabase } from "../sqlite-core/db.cjs";
import { DatabaseSync, DatabaseSyncOptions, StatementResultingChanges } from "node:sqlite";

//#region src/node-sqlite/driver.d.ts
declare class NodeSQLiteDatabase<TSchema extends Record<string, unknown> = Record<string, never>, TRelations extends AnyRelations = EmptyRelations> extends BaseSQLiteDatabase<'sync', StatementResultingChanges, TSchema, TRelations> {
  static readonly [entityKind]: string;
}
type DrizzleNodeSQLiteDatabaseConfig = ({
  path?: string;
} & DatabaseSyncOptions) | string | undefined;
declare function drizzle<TSchema extends Record<string, unknown> = Record<string, never>, TRelations extends AnyRelations = EmptyRelations, TClient extends DatabaseSync = DatabaseSync>(...params: [] | [string] | [string, DrizzleConfig<TSchema, TRelations>] | [(DrizzleConfig<TSchema, TRelations> & ({
  connection?: DrizzleNodeSQLiteDatabaseConfig | string;
} | {
  client: TClient;
}))]): NodeSQLiteDatabase<TSchema, TRelations> & {
  $client: TClient;
};
declare namespace drizzle {
  function mock<TSchema extends Record<string, unknown> = Record<string, never>, TRelations extends AnyRelations = EmptyRelations>(config?: DrizzleConfig<TSchema, TRelations>): NodeSQLiteDatabase<TSchema, TRelations> & {
    $client: '$client is not available on drizzle.mock()';
  };
}
//#endregion
export { DrizzleNodeSQLiteDatabaseConfig, NodeSQLiteDatabase, drizzle };
//# sourceMappingURL=driver.d.cts.map