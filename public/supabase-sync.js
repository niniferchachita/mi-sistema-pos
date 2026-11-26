(function () {
  const SUPABASE_URL = 'https://ctlsbqfouloxlaqgertg.supabase.co/rest/v1/pos_estado';
  const SUPABASE_KEY = 'sb_publishable_7gWi3OVesqwC3Kzm7ubILw__Sc3hOsb';
  const SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  function setStatus(estado, texto) {
    if (typeof actualizarIndicadorNube === 'function') {
      actualizarIndicadorNube(estado, texto);
    }
  }

  window.importarRespaldoJSON = async function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const parsed = JSON.parse(texto);
      const s = parsed.state ? parsed.state : parsed;
      if (!s || typeof s !== 'object') {
        return alert('El archivo JSON no contiene un respaldo válido del POS.');
      }
      if (!confirm('¿Restaurar todos los datos desde este respaldo y guardarlos en Supabase?')) {
        event.target.value = '';
        return;
      }
      if (Array.isArray(s.usuarios)) appData.usuarios = s.usuarios;
      if (s.saldoCajaGeneral !== undefined) appData.saldoCajaGeneral = parseFloat(s.saldoCajaGeneral) || 0;
      if (Array.isArray(s.turnosActivos)) appData.turnosActivos = s.turnosActivos;
      if (s.cajaChicaAbierta !== undefined) appData.cajaChicaAbierta = Boolean(s.cajaChicaAbierta);
      if (typeof sincronizarLegacyCajaDesdeTurnos === 'function') sincronizarLegacyCajaDesdeTurnos();
      if (s.cajeroActivoId !== undefined) appData.cajeroActivoId = s.cajeroActivoId;
      if (s.cajeroActivoNombre !== undefined) appData.cajeroActivoNombre = s.cajeroActivoNombre;
      if (Array.isArray(s.movimientosCajaChica)) appData.movimientosCajaChica = s.movimientosCajaChica;
      if (Array.isArray(s.movimientosGenerales)) appData.movimientosGenerales = s.movimientosGenerales;
      if (Array.isArray(s.transferenciasBancos)) appData.transferenciasBancos = s.transferenciasBancos;
      if (Array.isArray(s.inventarioProductos)) appData.inventarioProductos = s.inventarioProductos;
      if (Array.isArray(s.ventasContingencia)) appData.ventasContingencia = s.ventasContingencia;
      if (Array.isArray(s.historialCierres)) appData.historialCierres = s.historialCierres;
      if (Array.isArray(s.cierresMensuales)) appData.cierresMensuales = s.cierresMensuales;
      if (Array.isArray(s.cierresMensualesEmpleados)) appData.cierresMensualesEmpleados = s.cierresMensualesEmpleados;
      if (s.saldoBancoLoja !== undefined) appData.saldoBancoLoja = parseFloat(s.saldoBancoLoja) || 0;
      if (s.saldoBancoPichincha !== undefined) appData.saldoBancoPichincha = parseFloat(s.saldoBancoPichincha) || 0;
      if (Array.isArray(s.cxp)) appData.cxp = s.cxp;

      if (typeof renderTodo === 'function') renderTodo();
      await window.guardarEnNube();
      alert('Respaldo restaurado y sincronizado en Supabase correctamente.');
    } catch (err) {
      console.error('Error importando respaldo:', err);
      alert('Error al leer el archivo JSON: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };

  window.guardarEnNube = async function () {
    if (typeof guardarDatosLocales === 'function') guardarDatosLocales();
    setStatus('syncing', 'Guardando en Supabase...');

    try {
      const resGet = await fetch(SUPABASE_URL + '?clave=eq.estado_principal&select=valor', {
        headers: SUPABASE_HEADERS,
        cache: 'no-store'
      });
      if (resGet.ok) {
        const rows = await resGet.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].valor) {
          const s = rows[0].valor;
          if (Array.isArray(s.historialCierres)) {
            const mapaCierres = new Map();
            s.historialCierres.forEach(c => mapaCierres.set(String(c.id), c));
            (appData.historialCierres || []).forEach(c => mapaCierres.set(String(c.id), c));
            appData.historialCierres = Array.from(mapaCierres.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
          }
          if (Array.isArray(s.turnosActivos) && appData.currentUser) {
            const miId = String(appData.currentUser.id);
            const miNombre = appData.currentUser.nombre;
            const otrosTurnos = s.turnosActivos.filter(t => String(t.id) !== miId && t.nombre !== miNombre);
            const miTurnoActual = (appData.turnosActivos || []).filter(t => String(t.id) === miId || t.nombre === miNombre);
            appData.turnosActivos = [...otrosTurnos, ...miTurnoActual];
            if (typeof sincronizarLegacyCajaDesdeTurnos === 'function') sincronizarLegacyCajaDesdeTurnos();
          }
          if (Array.isArray(s.movimientosCajaChica) && appData.currentUser && typeof esMovimientoDelUsuario === 'function') {
            const otrosMovs = s.movimientosCajaChica.filter(m => !esMovimientoDelUsuario(m, appData.currentUser));
            const misMovs = (appData.movimientosCajaChica || []).filter(m => esMovimientoDelUsuario(m, appData.currentUser));
            appData.movimientosCajaChica = [...otrosMovs, ...misMovs];
          }
          if (typeof guardarDatosLocales === 'function') guardarDatosLocales();
        }
      }
    } catch (e) {
      console.warn('Pre-combinacion Supabase omitida:', e);
    }

    const estadoActual = {
      usuarios: appData.usuarios,
      saldoCajaGeneral: appData.saldoCajaGeneral,
      cajaChicaAbierta: appData.cajaChicaAbierta,
      turnosActivos: typeof obtenerTurnosActivos === 'function' ? obtenerTurnosActivos() : (appData.turnosActivos || []),
      cajeroActivoId: appData.cajeroActivoId,
      cajeroActivoNombre: appData.cajeroActivoNombre,
      movimientosCajaChica: appData.movimientosCajaChica,
      movimientosGenerales: appData.movimientosGenerales,
      transferenciasBancos: appData.transferenciasBancos,
      inventarioProductos: appData.inventarioProductos,
      ventasContingencia: appData.ventasContingencia,
      historialCierres: appData.historialCierres,
      cierresMensuales: appData.cierresMensuales,
      cierresMensualesEmpleados: appData.cierresMensualesEmpleados,
      saldoBancoLoja: appData.saldoBancoLoja,
      saldoBancoPichincha: appData.saldoBancoPichincha,
      cxp: appData.cxp
    };

    try {
      const res = await fetch(SUPABASE_URL, {
        method: 'POST',
        headers: {
          ...SUPABASE_HEADERS,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          clave: 'estado_principal',
          valor: estadoActual,
          updated_at: new Date().toISOString()
        })
      });
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(errTxt || ('HTTP ' + res.status));
      }
      setStatus('ok', 'Supabase Conectado');
    } catch (err) {
      console.error('Error guardando en Supabase:', err);
      setStatus('error', 'Error Supabase: ' + (err.message || 'Local').slice(0, 28));
    }
  };

  window.cargarDatosDesdeNube = async function (mostrarAviso = false) {
    setStatus('syncing', 'Cargando Supabase...');
    try {
      const res = await fetch(SUPABASE_URL + '?clave=eq.estado_principal&select=valor', {
        headers: SUPABASE_HEADERS,
        cache: 'no-store'
      });
      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(errTxt || ('HTTP ' + res.status));
      }
      const rows = await res.json();
      const cierresLocalesAntes = JSON.parse(localStorage.getItem('pos_cierres') || '[]');

      if (Array.isArray(rows) && rows.length > 0 && rows[0].valor) {
        const s = rows[0].valor;
        if (Array.isArray(s.usuarios)) appData.usuarios = s.usuarios;
        if (s.saldoCajaGeneral !== undefined) appData.saldoCajaGeneral = parseFloat(s.saldoCajaGeneral) || 0;
        if (Array.isArray(s.turnosActivos)) appData.turnosActivos = s.turnosActivos;
        if (s.cajaChicaAbierta !== undefined) appData.cajaChicaAbierta = Boolean(s.cajaChicaAbierta);
        if (typeof sincronizarLegacyCajaDesdeTurnos === 'function') sincronizarLegacyCajaDesdeTurnos();
        if (s.cajeroActivoId !== undefined) appData.cajeroActivoId = s.cajeroActivoId;
        if (s.cajeroActivoNombre !== undefined) appData.cajeroActivoNombre = s.cajeroActivoNombre;
        if (Array.isArray(s.movimientosCajaChica)) appData.movimientosCajaChica = s.movimientosCajaChica;
        if (Array.isArray(s.movimientosGenerales)) appData.movimientosGenerales = s.movimientosGenerales;
        if (Array.isArray(s.transferenciasBancos)) appData.transferenciasBancos = s.transferenciasBancos;
        if (Array.isArray(s.inventarioProductos)) appData.inventarioProductos = s.inventarioProductos;
        if (Array.isArray(s.ventasContingencia)) appData.ventasContingencia = s.ventasContingencia;
        if (Array.isArray(s.cierresMensuales)) appData.cierresMensuales = s.cierresMensuales;
        if (Array.isArray(s.cierresMensualesEmpleados)) appData.cierresMensualesEmpleados = s.cierresMensualesEmpleados;
        if (s.saldoBancoLoja !== undefined) appData.saldoBancoLoja = parseFloat(s.saldoBancoLoja) || 0;
        if (s.saldoBancoPichincha !== undefined) appData.saldoBancoPichincha = parseFloat(s.saldoBancoPichincha) || 0;
        if (Array.isArray(s.cxp)) appData.cxp = s.cxp;

        const nubeCierres = Array.isArray(s.historialCierres) ? s.historialCierres : [];
        const mapaCierres = new Map();
        nubeCierres.forEach(c => mapaCierres.set(String(c.id), c));
        let huboNuevosLocales = false;
        cierresLocalesAntes.forEach(c => {
          if (c && c.id && !mapaCierres.has(String(c.id))) {
            mapaCierres.set(String(c.id), c);
            huboNuevosLocales = true;
          }
        });
        appData.historialCierres = Array.from(mapaCierres.values()).sort((a, b) => (b.id || 0) - (a.id || 0));

        if (typeof guardarDatosLocales === 'function') guardarDatosLocales();
        if (typeof renderTodo === 'function') renderTodo();
        else if (typeof renderCaja === 'function') renderCaja();

        if (huboNuevosLocales) {
          await window.guardarEnNube();
          return;
        }
      }
      setStatus('ok', 'Supabase Conectado');
      if (mostrarAviso) alert('Datos sincronizados correctamente desde Supabase.');
    } catch (err) {
      console.error('Error cargando desde Supabase:', err);
      setStatus('error', 'Error: ' + (err.message || 'Local').slice(0, 32));
    }
  };

  function inyectarBotonRespaldo() {
    if (document.getElementById('btnRestaurarRespaldoJSON')) return;
    const badge = document.getElementById('cloudSyncBadge');
    const contenedor = badge ? badge.parentElement : null;
    if (!contenedor) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'inputRespaldoJSON';
    input.accept = '.json';
    input.className = 'hidden';
    input.onchange = window.importarRespaldoJSON;

    const btn = document.createElement('button');
    btn.id = 'btnRestaurarRespaldoJSON';
    btn.type = 'button';
    btn.className = 'w-full mt-2 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition';
    btn.innerHTML = '<i class="fa-solid fa-file-import"></i> Restaurar Respaldo JSON';
    btn.onclick = () => input.click();

    contenedor.appendChild(input);
    contenedor.appendChild(btn);
  }

  window.addEventListener('DOMContentLoaded', () => {
    inyectarBotonRespaldo();
    window.cargarDatosDesdeNube(false);
  });

  if (document.readyState !== 'loading') {
    inyectarBotonRespaldo();
    window.cargarDatosDesdeNube(false);
  }

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      window.cargarDatosDesdeNube(false);
    }
  }, 15000);

  window.mostrarPanelClavesAdmin = function () {
    if (!appData || !Array.isArray(appData.usuarios)) {
      return alert('No hay usuarios cargados todavía.');
    }
    const existente = document.getElementById('modalClavesAdmin');
    if (existente) existente.remove();

    const filas = appData.usuarios.map(u => {
      const clave = u.password || u.clave || u.pin || u.contrasena || '(Sin clave)';
      const userLogin = u.usuario || u.nombre || '-';
      return `
        <tr class="border-b border-slate-700/60 hover:bg-slate-800/50">
          <td class="py-2.5 px-3 font-medium text-white">${u.nombre || '-'}</td>
          <td class="py-2.5 px-3 text-slate-300">${userLogin}</td>
          <td class="py-2.5 px-3 text-xs uppercase text-blue-300">${u.rol || '-'}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-amber-300 select-all">${clave}</td>
        </tr>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'modalClavesAdmin';
    modal.className = 'fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i class="fa-solid fa-key text-amber-400"></i> Contraseñas Asignadas
          </h3>
          <button onclick="document.getElementById('modalClavesAdmin').remove()" class="text-slate-400 hover:text-white text-lg px-2">&times;</button>
        </div>
        <div class="overflow-x-auto max-h-80 overflow-y-auto rounded-lg border border-slate-800">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-800 text-slate-300 text-xs uppercase">
              <tr>
                <th class="py-2 px-3">Nombre</th>
                <th class="py-2 px-3">Usuario</th>
                <th class="py-2 px-3">Rol</th>
                <th class="py-2 px-3">Contraseña</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
        <div class="mt-4 flex justify-end">
          <button onclick="document.getElementById('modalClavesAdmin').remove()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold">Cerrar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  };

  function inyectarBotonClaves() {
    if (document.getElementById('btnVerClavesAdmin')) return;
    const btnRespaldo = document.getElementById('btnRestaurarRespaldoJSON');
    if (!btnRespaldo || !btnRespaldo.parentElement) return;

    const btn = document.createElement('button');
    btn.id = 'btnVerClavesAdmin';
    btn.type = 'button';
    btn.className = 'w-full mt-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition';
    btn.innerHTML = '<i class="fa-solid fa-key"></i> Ver Contraseñas';
    btn.onclick = window.mostrarPanelClavesAdmin;
    btnRespaldo.parentElement.appendChild(btn);
  }

  setInterval(inyectarBotonClaves, 2000);
})();