async function asegurarTablas(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS pos_estado (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`)
  ]);
}

export async function onRequestGet(context) {
  const { env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: "Falta enlazar la base de datos D1 con el nombre DB" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    await asegurarTablas(env.DB);
    const { results } = await env.DB.prepare("SELECT clave, valor FROM pos_estado").all();

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ ok: true, initialized: false, state: null }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const state = {};
    for (const row of results) {
      try {
        state[row.clave] = JSON.parse(row.valor);
      } catch {
        state[row.clave] = row.valor;
      }
    }

    return new Response(JSON.stringify({ ok: true, initialized: true, state }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) {
    return new Response(JSON.stringify({ ok: false, error: "Falta enlazar la base de datos D1 con el nombre DB" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    await asegurarTablas(env.DB);
    const body = await request.json();
    const state = body.state || {};
    const now = new Date().toISOString();

    const statements = [];
    for (const [clave, valor] of Object.entries(state)) {
      statements.push(
        env.DB.prepare(
          "INSERT INTO pos_estado (clave, valor, updated_at) VALUES (?, ?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at"
        ).bind(clave, JSON.stringify(valor), now)
      );
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return new Response(JSON.stringify({ ok: true, savedAt: now }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}