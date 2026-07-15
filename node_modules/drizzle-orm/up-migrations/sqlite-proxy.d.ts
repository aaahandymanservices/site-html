import { UpgradeResult } from "./utils.js";
import { MigrationMeta } from "../migrator.js";
import { SqliteRemoteDatabase } from "../sqlite-proxy/index.js";
import { ProxyMigrator } from "../sqlite-proxy/migrator.js";

//#region src/up-migrations/sqlite-proxy.d.ts
/**
 * Detects the current version of the migrations table schema and upgrades it if needed.
 *
 * Version 0: Original schema (id, hash, created_at)
 * Version 1: Extended schema (id, hash, created_at, name, applied_at)
 */
declare function upgradeAsyncIfNeeded(migrationsTable: string, db: SqliteRemoteDatabase<Record<string, unknown>>, callback: ProxyMigrator, localMigrations: MigrationMeta[]): Promise<UpgradeResult>;
//#endregion
export { upgradeAsyncIfNeeded };
//# sourceMappingURL=sqlite-proxy.d.ts.map