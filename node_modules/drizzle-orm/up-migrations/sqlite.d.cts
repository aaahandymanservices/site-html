import { UpgradeResult } from "./utils.cjs";
import { TablesRelationalConfig } from "../_relations.cjs";
import { MigrationMeta } from "../migrator.cjs";
import { AnyRelations } from "../relations.cjs";
import { SQLiteSession } from "../sqlite-core/session.cjs";
import { BaseSQLiteDatabase } from "../sqlite-core/index.cjs";

//#region src/up-migrations/sqlite.d.ts
/**
 * Detects the current version of the migrations table schema and upgrades it if needed.
 *
 * Version 0: Original schema (id, hash, created_at)
 * Version 1: Extended schema (id, hash, created_at, name, applied_at)
 */
declare function upgradeSyncIfNeeded(migrationsTable: string, session: SQLiteSession<'sync', unknown, Record<string, unknown>, AnyRelations, TablesRelationalConfig>, localMigrations: MigrationMeta[]): UpgradeResult;
/**
 * Detects the current version of the migrations table schema and upgrades it if needed.
 *
 * Version 0: Original schema (id, hash, created_at)
 * Version 1: Extended schema (id, hash, created_at, name, applied_at)
 */
declare function upgradeAsyncIfNeeded(migrationsTable: string, db: BaseSQLiteDatabase<'async', unknown, Record<string, unknown>>, localMigrations: MigrationMeta[]): Promise<UpgradeResult>;
//#endregion
export { upgradeAsyncIfNeeded, upgradeSyncIfNeeded };
//# sourceMappingURL=sqlite.d.cts.map