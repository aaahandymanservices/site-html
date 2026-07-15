import { is } from "./entity.js";
import { Column } from "./column.js";
import { Subquery } from "./subquery.js";
import { Table, getTableName } from "./table.js";
import { Param, SQL, View } from "./sql/sql.js";
import { ViewBaseConfig } from "./view-common.js";

//#region src/utils.ts
/** @internal */
function mapResultRow(columns, row, joinsNotNullableMap) {
	const nullifyMap = {};
	const result = columns.reduce((result, { path, field }, columnIndex) => {
		let decoder;
		if (is(field, Column)) decoder = field;
		else if (is(field, SQL)) decoder = field.decoder;
		else if (is(field, Subquery)) decoder = field._.sql.decoder;
		else decoder = field.sql.decoder;
		let node = result;
		for (const [pathChunkIndex, pathChunk] of path.entries()) if (pathChunkIndex < path.length - 1) {
			if (!(pathChunk in node)) node[pathChunk] = {};
			node = node[pathChunk];
		} else {
			const rawValue = row[columnIndex];
			const value = node[pathChunk] = rawValue === null ? null : decoder.mapFromDriverValue(rawValue);
			if (joinsNotNullableMap && is(field, Column) && path.length === 2) {
				const objectName = path[0];
				if (!(objectName in nullifyMap)) nullifyMap[objectName] = value === null ? getTableName(field.table) : false;
				else if (typeof nullifyMap[objectName] === "string" && nullifyMap[objectName] !== getTableName(field.table)) nullifyMap[objectName] = false;
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
		if (is(field, Column) || is(field, SQL) || is(field, SQL.Aliased) || is(field, Subquery)) result.push({
			path: newPath,
			field
		});
		else if (is(field, Table)) result.push(...orderSelectedFields(field[Table.Symbol.Columns], newPath));
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
		if (is(value, SQL) || is(value, Column)) return [key, value];
		else return [key, new Param(value, table[Table.Symbol.Columns][key])];
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
	return table[Table.Symbol.Columns];
}
function getViewSelectedFields(view) {
	return view[ViewBaseConfig].selectedFields;
}
function getColumns(table) {
	return is(table, Table) ? table[Table.Symbol.Columns] : is(table, View) ? table[ViewBaseConfig].selectedFields : table._.selectedFields;
}
/** @internal */
function getTableLikeName(table) {
	return is(table, Subquery) ? table._.alias : is(table, View) ? table[ViewBaseConfig].name : is(table, SQL) ? void 0 : table[Table.Symbol.IsAlias] ? table[Table.Symbol.Name] : table[Table.Symbol.BaseName];
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
export { CONSTANTS, applyMixins, assertUnreachable, getColumnNameAndConfig, getColumns, getTableColumns, getTableLikeName, getViewSelectedFields, haveSameKeys, isConfig, isWithEnum, mapResultRow, mapUpdateSet, orderSelectedFields, textDecoder };
//# sourceMappingURL=utils.js.map