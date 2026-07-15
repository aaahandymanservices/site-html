Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_runtime = require('../_virtual/_rolldown/runtime.cjs');
let __migrator_ts = require("../migrator.cjs");

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
	const migrations = (0, __migrator_ts.readMigrationFiles)(config);
	return db.dialect.migrate(migrations, db.session, config);
}

//#endregion
exports.migrate = migrate;
//# sourceMappingURL=migrator.cjs.map