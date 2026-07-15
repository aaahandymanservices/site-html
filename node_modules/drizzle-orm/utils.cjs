Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
const require_entity = require('./entity.cjs');
const require_column = require('./column.cjs');
const require_subquery = require('./subquery.cjs');
const require_table = require('./table.cjs');
const require_sql_sql = require('./sql/sql.cjs');
const require_view_common = require('./view-common.cjs');

//#region src/utils.ts
/** @internal */
function mapResultRow(columns, row, joinsNotNullableMap) {
	const nullifyMap = {};
	const result = columns.reduce((result, { path, field }, columnIndex) => {
		let decoder;
		if (require_entity.is(field, require_column.Column)) decoder = field;
		else if (require_entity.is(field, require_sql_sql.SQL)) decoder = field.decoder;
		else if (require_entity.is(field, require_subquery.Subquery)) decoder = field._.sql.decoder;
		else decoder = field.sql.decoder;
		let node = result;
		for (const [pathChunkIndex, pathChunk] of path.entries()) if (pathChunkIndex < path.length - 1) {
			if (!(pathChunk in node)) node[pathChunk] = {};
			node = node[pathChunk];
		} else {
			const rawValue = row[columnIndex];
			const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
			if (joinsNotNullableMap && require_entity.is(field, require_column.Column) && path.length === 2) {
				const objectName = path[0];
				if (!(objectName in nullifyMap)) nullifyMap[objectName] = value === null ? require_table.getTableName(field.table) : false;
				else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== require_table.getTableName(field.table)) nullifyMap[objectName] = false;
			}
		}
		return result;
	}, {});
	if (joinsNotNullableMap && Object.keys(nullifyMap).length > 0) {
		for (const [objectName, tableName] of Object.entries(nullifyMap)) if (typeof tableName === "string" && !joinsNotNullableMap[tableName]) result[objectName] = null;
	}
	return result;
}
/** @internal */
function orderSelectedFields(fields, pathPrefix) {
	return Object.entries(fields).reduce((result, [name, field]) => {
		if (typeof name !== "string") return result;
		const newPath = pathPrefix ? [...pathPrefix, name] : [name];
		if (require_entity.is(field, require_column.Column) || require_entity.is(field, require_sql_sql.SQL) || require_entity.is(field, require_sql_sql.SQL.Aliased) || require_entity.is(field, require_subquery.Subquery)) result.push({
			path: newPath,
			field
		});
		else if (require_entity.is(field, require_table.Table)) result.push(...orderSelectedFields(field[require_table.Table.Symbol.Columns], newPath));
		else result.push(...orderSelectedFields(field, newPath));
		return result;
	}, []);
}
function haveSameKeys(left, right) {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	if (leftKeys.length !== rightKeys.length) return false;
	for (const [index, key] of leftKeys.entries()) if (key !== rightKeys[index]) return false;
	return true;
}
/** @internal */
function mapUpdateSet(table, values) {
	const entries = Object.entries(values).filter(([, value]) => value !== void 0).map(([key, value]) => {
		if (require_entity.is(value, require_sql_sql.SQL) || require_entity.is(value, require_column.Column)) return [key, value];
		else return [key, new require_sql_sql.Param(value, table[require_table.Table.Symbol.Columns][key])];
	});
	if (entries.length === 0) throw new Error("No values to set");
	return Object.fromEntries(entries);
}
/** @internal */
function applyMixins(baseClass, extendedClasses) {
	for (const extendedClass of extendedClasses) for (const name of Object.getOwnPropertyNames(extendedClass.prototype)) {
		if (name === "constructor") continue;
		Object.defineProperty(baseClass.prototype, name, Object.getOwnPropertyDescriptor(extendedClass.prototype, name) || Object.create(null));
	}
}
/**
* @deprecated
* Use `getColumns` instead
*/
function getTableColumns(table) {
	return table[require_table.Table.Symbol.Columns];
}
function getViewSelectedFields(view) {
	return view[require_view_common.ViewBaseConfig].selectedFields;
}
function getColumns(table) {
	return require_entity.is(table, require_table.Table) ? table[require_table.Table.Symbol.Columns] : require_entity.is(table, require_sql_sql.View) ? table[require_view_common.ViewBaseConfig].selectedFields : table._.selectedFields;
}
/** @internal */
function getTableLikeName(table) {
	return require_entity.is(table, require_subquery.Subquery) ? table._.alias : require_entity.is(table, require_sql_sql.View) ? table[require_view_common.ViewBaseConfig].name : require_entity.is(table, require_sql_sql.SQL) ? void 0 : table[require_table.Table.Symbol.IsAlias] ? table[require_table.Table.Symbol.Name] : table[require_table.Table.Symbol.BaseName];
}
/** @internal */
function getColumnNameAndConfig(a, b) {
	return {
		name: typeof a === "string" && a.length > 0 ? a : "",
		config: typeof a === "object" ? a : b
	};
}
function isConfig(data) {
	if (typeof data !== "object" || data === null) return false;
	if (data.constructor.name !== "Object") return false;
	if ("logger" in data) {
		const type = typeof data["logger"];
		if (type !== "boolean" && (type !== "object" || typeof data["logger"]["logQuery"] !== "function") && type !== "undefined") return false;
		return true;
	}
	if ("schema" in data) {
		const type = typeof data["schema"];
		if (type !== "object" && type !== "undefined") return false;
		return true;
	}
	if ("relations" in data) {
		const type = typeof data["relations"];
		if (type !== "object" && type !== "undefined") return false;
		return true;
	}
	if ("casing" in data) {
		const type = typeof data["casing"];
		if (type !== "string" && type !== "undefined") return false;
		return true;
	}
	if ("mode" in data) {
		if (data["mode"] !== "default" || data["mode"] !== "planetscale" || data["mode"] !== void 0) return false;
		return true;
	}
	if ("connection" in data) {
		const type = typeof data["connection"];
		if (type !== "string" && type !== "object" && type !== "undefined") return false;
		return true;
	}
	if ("client" in data) {
		const type = typeof data["client"];
		if (type !== "object" && type !== "function" && type !== "undefined") return false;
		return true;
	}
	if (Object.keys(data).length === 0) return true;
	return false;
}
const textDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder();
function assertUnreachable(_x) {
	throw new Error("Didn't expect to get here");
}
function isWithEnum(value) {
	return (typeof value === "object" && value !== null || typeof value === "function") && "enumValues" in value && Array.isArray(value.enumValues) && value.enumValues.length > 0;
}
const CONSTANTS = {
	INT8_MIN: -128,
	INT8_MAX: 127,
	INT8_UNSIGNED_MAX: 255,
	INT16_MIN: -32768,
	INT16_MAX: 32767,
	INT16_UNSIGNED_MAX: 65535,
	INT24_MIN: -8388608,
	INT24_MAX: 8388607,
	INT24_UNSIGNED_MAX: 16777215,
	INT32_MIN: -2147483648,
	INT32_MAX: 2147483647,
	INT32_UNSIGNED_MAX: 4294967295,
	INT48_MIN: -0x800000000000,
	INT48_MAX: 0x7fffffffffff,
	INT48_UNSIGNED_MAX: 0xffffffffffff,
	INT64_MIN: -9223372036854775808n,
	INT64_MAX: 9223372036854775807n,
	INT64_UNSIGNED_MAX: 18446744073709551615n
};

//#endregion
exports.CONSTANTS = CONSTANTS;
exports.applyMixins = applyMixins;
exports.assertUnreachable = assertUnreachable;
exports.getColumnNameAndConfig = getColumnNameAndConfig;
exports.getColumns = getColumns;
exports.getTableColumns = getTableColumns;
exports.getTableLikeName = getTableLikeName;
exports.getViewSelectedFields = getViewSelectedFields;
exports.haveSameKeys = haveSameKeys;
exports.isConfig = isConfig;
exports.isWithEnum = isWithEnum;
exports.mapResultRow = mapResultRow;
exports.mapUpdateSet = mapUpdateSet;
exports.orderSelectedFields = orderSelectedFields;
exports.textDecoder = textDecoder;
//# sourceMappingURL=utils.cjs.map