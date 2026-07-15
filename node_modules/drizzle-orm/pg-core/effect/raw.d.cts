import { PgRaw } from "../query-builders/raw.cjs";
import { entityKind } from "../../entity.cjs";
import { Query, SQL, SQLWrapper } from "../../sql/sql.cjs";
import { PreparedQuery } from "../../session.cjs";
import { RunnableQuery } from "../../runnable-query.cjs";
import * as Effect from "effect/Effect";
import { QueryEffectHKTBase } from "../../effect-core/query-effect.cjs";

//#region src/pg-core/effect/raw.d.ts
interface PgEffectRaw<TResult, TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase> extends Effect.Effect<TResult, TEffectHKT['error'], TEffectHKT['context']>, RunnableQuery<TResult, 'pg'>, SQLWrapper {}
declare class PgEffectRaw<TResult, TEffectHKT extends QueryEffectHKTBase = QueryEffectHKTBase> extends PgRaw<TResult> implements RunnableQuery<TResult, 'pg'> {
  execute: () => Effect.Effect<TResult, TEffectHKT['error'], TEffectHKT['context']>;
  static readonly [entityKind]: string;
  readonly _: {
    readonly dialect: 'pg';
    readonly result: TResult;
  };
  constructor(execute: () => Effect.Effect<TResult, TEffectHKT['error'], TEffectHKT['context']>, sql: SQL, query: Query, mapBatchResult: (result: unknown) => unknown);
  _prepare(): PreparedQuery;
}
//#endregion
export { PgEffectRaw };
//# sourceMappingURL=raw.d.cts.map