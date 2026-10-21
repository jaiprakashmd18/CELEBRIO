import type { Client } from "pg";

/**
 * A tiny stand-in for the parts of the supabase-js client used by the
 * webhook processor (rpc, select/delete with eq filters), executing real SQL
 * as the service role. It lets integration tests run the production webhook
 * code against the real database functions without a PostgREST server.
 */
export function pgSupabase(client: Client) {
  const call = async (sql: string, params: unknown[]) => {
    await client.query("set role service_role");
    try {
      return await client.query(sql, params);
    } finally {
      await client.query("reset role");
    }
  };
  return {
    async rpc(fn: string, args: Record<string, unknown>) {
      const keys = Object.keys(args);
      const sql = `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
      try {
        const res = await call(sql, keys.map((k) => args[k]));
        const row = res.rows[0];
        const data = res.fields.length === 1 && res.rows.length === 1 && Object.keys(row).length === 1 ? Object.values(row)[0] : res.rows;
        return { data, error: null };
      } catch (err) {
        return { data: null, error: { message: (err as Error).message } };
      }
    },
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      let mode: "select" | "delete" = "select";
      let columns = "*";
      const where = () => (filters.length ? ` where ${filters.map(([c], i) => `${c} = $${i + 1}`).join(" and ")}` : "");
      const builder = {
        select(cols: string) {
          columns = cols;
          return builder;
        },
        delete() {
          mode = "delete";
          return builder;
        },
        eq(col: string, value: unknown) {
          filters.push([col, value]);
          return builder;
        },
        async maybeSingle() {
          const res = await call(`select ${columns} from public.${table}${where()} limit 1`, filters.map(([, v]) => v));
          return { data: res.rows[0] ?? null, error: null };
        },
        then(resolve: (v: { data: unknown; error: null }) => void, reject: (e: unknown) => void) {
          const sql = mode === "delete" ? `delete from public.${table}${where()}` : `select ${columns} from public.${table}${where()}`;
          call(sql, filters.map(([, v]) => v)).then((res) => resolve({ data: res.rows, error: null }), reject);
        },
      };
      return builder;
    },
  };
}
