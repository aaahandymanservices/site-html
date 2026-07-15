import { MySqlTable } from "../table.cjs";
import { MySqlView } from "../view.cjs";
import { MySqlDialect } from "../dialect.cjs";
import { MySqlPreparedQueryConfig, MySqlSession, PreparedQueryHKTBase, PreparedQueryKind } from "../session.cjs";
import { entityKind } from "../../entity.cjs";
import { Query, SqlCommenterInput } from "../../sql/sql.cjs";
import { KnownKeysOnly } from "../../utils.cjs";
import { QueryPromise } from "../../query-promise.cjs";
import { BuildQueryResult, DBQueryConfigWithComment, TableRelationalConfig, TablesRelationalConfig } from "../../relations.cjs";

//#region src/mysql-core/query-builders/query.d.ts
declare class RelationalQueryBuilder<TPreparedQueryHKT extends PreparedQueryHKTBase, TSchema extends TablesRelationalConfig, TFields extends TableRelationalConfig> {
  private schema;
  private table;
  private tableConfig;
  private dialect;
  private session;
  static readonly [entityKind]: string;
  constructor(schema: TSchema, table: MySqlTable | MySqlView, tableConfig: TableRelationalConfig, dialect: MySqlDialect, session: MySqlSession);
  findMany<TConfig extends DBQueryConfigWithComment<'many', TSchema, TFields>>(config?: KnownKeysOnly<TConfig, DBQueryConfigWithComment<'many', TSchema, TFields>> & {
    comment?: SqlCommenterInput;
  }): MySqlRelationalQuery<TPreparedQueryHKT, BuildQueryResult<TSchema, TFields, TConfig>[]>;
  findFirst<TSelection extends DBQueryConfigWithComment<'one', TSchema, TFields>>(config?: KnownKeysOnly<TSelection, DBQueryConfigWithComment<'one', TSchema, TFields>> & {
    comment?: SqlCommenterInput;
  }): MySqlRelationalQuery<TPreparedQueryHKT, BuildQueryResult<TSchema, TFields, TSelection> | undefined>;
}
declare class MySqlRelationalQuery<TPreparedQueryHKT extends PreparedQueryHKTBase, TResult> extends QueryPromise<TResult> {
  private schema;
  private table;
  private tableConfig;
  private dialect;
  private session;
  private config;
  private mode;
  static readonly [entityKind]: string;
  protected $brand: 'MySqlRelationalQuery';
  constructor(schema: TablesRelationalConfig, table: MySqlTable | MySqlView, tableConfig: TableRelationalConfig, dialect: MySqlDialect, session: MySqlSession, config: DBQueryConfigWithComment<'many' | 'one'> | true, mode: 'many' | 'first');
  prepare(): PreparedQueryKind<TPreparedQueryHKT, MySqlPreparedQueryConfig & {
    execute: TResult;
  }, true>;
  private _getQuery;
  private _toSQL;
  toSQL(): Query;
  execute(): Promise<TResult>;
}
//#endregion
export { MySqlRelationalQuery, RelationalQueryBuilder };
//# sourceMappingURL=query.d.cts.map