import { NodeSQLiteDatabase } from "./driver.js";
import * as __migrator_ts0 from "../migrator.js";
import { MigrationConfig } from "../migrator.js";
import { AnyRelations, EmptyRelations } from "../relations.js";

//#region src/node-sqlite/migrator.d.ts
declare function migrate<TSchema extends Record<string, unknown>, TRelations extends AnyRelations = EmptyRelations>(db: NodeSQLiteDatabase<TSchema, TRelations>, config: MigrationConfig): void | __migrator_ts0.MigratorInitFailResponse;
//#endregion
export { migrate };
//# sourceMappingURL=migrator.d.ts.map