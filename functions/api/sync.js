async function asegurarTablas(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS pos_estado (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY, nombre TEXT, user TEXT, pass TEXT, rol TEXT, sueldo_base REAL, dias_lab INTEGER, anticipos REAL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS cierres_caja (id INTEGER PRIMARY KEY, fecha_hora TEXT, cajero_id INTEGER, cajero_nombre TEXT, saldo_teorico REAL, monto_contado REAL, diferencia REAL, aprobado INTEGER, observacion TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS transferencias_bancos (id INTEGER PRIMARY KEY, fecha_hora TEXT, usuario TEXT, banco TEXT, tipo TEXT, comprobante TEXT, concepto TEXT, monto REAL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS movimientos (id INTEGER PRIMARY KEY, fecha_hora TEXT, usuario TEXT, origen TEXT, categoria TEXT, concepto TEXT, monto REAL, tipo TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS inventario (id INTEGER PRIMARY KEY, codigo TEXT, nombre TEXT, precio REAL, stock INTEGER)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS cxp (id INTEGER PRIMARY KEY, acreedor TEXT, doc TEXT, total REAL, saldo REAL, vence TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS cierres_mensuales (id INTEGER PRIMARY KEY, periodo TEXT, fecha_archivo TEXT, usuario TEXT, total_ingresos REAL, total_egresos REAL, resultado_neto REAL, saldo_caja_general REAL, saldo_banco_loja REAL, saldo_banco_pichincha REAL, total_pasivos REAL)`)
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

    if (Array.isArray(state.usuarios)) {
      statements.push(env.DB.prepare("DELETE FROM usuarios"));
      for (const u of state.usuarios) {
        statements.push(
          env.DB.prepare("INSERT INTO usuarios (id, nombre, user, pass, rol, sueldo_base, dias_lab, anticipos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(u.id, u.nombre || "", u.user || "", u.pass || "", u.rol || "cajero", u.sueldoBase || 0, u.diasLab ?? 0, u.anticipos || 0)
        );
      }
    }

    if (Array.isArray(state.historialCierres)) {
      statements.push(env.DB.prepare("DELETE FROM cierres_caja"));
      for (const c of state.historialCierres) {
        statements.push(
          env.DB.prepare("INSERT INTO cierres_caja (id, fecha_hora, cajero_id, cajero_nombre, saldo_teorico, monto_contado, diferencia, aprobado, observacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(c.id, c.fechaHora || "", c.cajeroId || 0, c.cajeroNombre || "", c.saldoTeorico || 0, c.montoContado || 0, c.diferencia || 0, c.aprobadoCajaGeneral ? 1 : 0, c.observacionAdmin || "")
        );
      }
    }

    if (Array.isArray(state.transferenciasBancos)) {
      statements.push(env.DB.prepare("DELETE FROM transferencias_bancos"));
      for (const t of state.transferenciasBancos) {
        statements.push(
          env.DB.prepare("INSERT INTO transferencias_bancos (id, fecha_hora, usuario, banco, tipo, comprobante, concepto, monto) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(t.id, t.fechaHora || "", t.usuario || "", t.banco || "", t.tipo || "ingreso", t.comprobante || "", t.concepto || "", t.monto || 0)
        );
      }
    }

    if (Array.isArray(state.movimientosGenerales)) {
      statements.push(env.DB.prepare("DELETE FROM movimientos"));
      for (const m of state.movimientosGenerales) {
        statements.push(
          env.DB.prepare("INSERT INTO movimientos (id, fecha_hora, usuario, origen, categoria, concepto, monto, tipo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(m.id, m.fechaHora || "", m.usuario || "", m.origen || "", m.categoria || "", m.concepto || "", m.monto || 0, m.tipo || "egreso")
        );
      }
    }

    if (Array.isArray(state.inventarioProductos)) {
      statements.push(env.DB.prepare("DELETE FROM inventario"));
      for (const p of state.inventarioProductos) {
        statements.push(
          env.DB.prepare("INSERT INTO inventario (id, codigo, nombre, precio, stock) VALUES (?, ?, ?, ?, ?)")
            .bind(p.id, p.codigo || "", p.nombre || "", p.precio || 0, 0)
        );
      }
    }

    if (Array.isArray(state.cxp)) {
      statements.push(env.DB.prepare("DELETE FROM cxp"));
      for (const f of state.cxp) {
        statements.push(
          env.DB.prepare("INSERT INTO cxp (id, acreedor, doc, total, saldo, vence) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(f.id, f.acreedor || "", f.doc || "", f.total || 0, f.saldo || 0, f.vence || "")
        );
      }
    }

    if (Array.isArray(state.cierresMensuales)) {
      statements.push(env.DB.prepare("DELETE FROM cierres_mensuales"));
      for (const cm of state.cierresMensuales) {
        statements.push(
          env.DB.prepare("INSERT INTO cierres_mensuales (id, periodo, fecha_archivo, usuario, total_ingresos, total_egresos, resultado_neto, saldo_caja_general, saldo_banco_loja, saldo_banco_pichincha, total_pasivos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(cm.id, cm.periodo || "", cm.fechaArchivo || "", cm.usuario || "", cm.totalIngresos || 0, cm.totalEgresos || 0, cm.resultadoNeto || 0, cm.saldoCajaGeneral || 0, cm.saldoBancoLoja || 0, cm.saldoBancoPichincha || 0, cm.totalPasivos || 0)
        );
      }
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