import { readMigrationFiles } from "../migrator.js";

//#region src/bun-sqlite/migrator.ts
function migrate(db, config) {
	if (Array.isArray(config) || "migrationsJournal" in config) {
		const journal = Array.isArray(config) ? config : config.migrationsJournal;
		const migrationsTable = Array.isArray(config) ? void 0 : config.migrationsTable;
		const migrations = journal.map((d) => ({
			sql: d.sql.split("--> statement-breakpoint"),
			folderMillis: d.timestamp,
			hash: "",
			bps: true,
			name: d.name
		}));
		return db.dialect.migrate(migrations, db.session, { migrationsTable });
	}
	const migrations = readMigrationFiles(config);
	return db.dialect.migrate(migrations, db.session, config);
}

//#endregion
export { migrate };
//# sourceMappingURL=migrator.js.map