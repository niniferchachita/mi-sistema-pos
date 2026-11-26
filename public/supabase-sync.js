(function () {
  const SUPABASE_URL = 'https://ctlsbqfouloxlaqgertg.supabase.co/rest/v1/pos_estado';
  const SUPABASE_KEY = 'sb_publishable_7gWi3OVesqwC3Kzm7ubILw__Sc3hOsb';
  const SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  function limpiarTurnosYaCerrados() {
    if (typeof appData === 'undefined' || !Array.isArray(appData.turnosActivos)) return false;
    const cierres = Array.isArray(appData.historialCierres) ? appData.historialCierres : [];
    const ahora = Date.now();
    const doceHorasMs = 12 * 60 * 60 * 1000;
    const antes = appData.turnosActivos.length;

    appData.turnosActivos = appData.turnosActivos.filter(t => {
      const tId = String(t.id || '');
      const tNombre = (t.nombre || '').trim().toUpperCase();
      const tieneCierreReciente = cierres.some(c => {
        const cId = String(c.cajeroId || c.usuarioId || '');
        const cNombre = (c.cajero || c.cajeroNombre || c.usuario || '').trim().toUpperCase();
        const mismoCajero = (tId && cId && tId === cId) || (tNombre && cNombre && tNombre === cNombre);
        if (!mismoCajero) return false;
        const ts = typeof c.id === 'number' && c.id > 1000000000000 ? c.id : 0;
        if (ts > 0) {
          const abiertoEn = typeof t.abiertoEn === 'number' ? t.abiertoEn : (typeof t.inicioTs === 'number' ? t.inicioTs : 0);
          if (abiertoEn > 0) return ts >= abiertoEn;
          return (ahora - ts) < doceHorasMs;
        }
        return false;
      });
      return !tieneCierreReciente;
    });

    if (appData.turnosActivos.length !== antes) {
      if (typeof sincronizarLegacyCajaDesdeTurnos === 'function') sincronizarLegacyCajaDesdeTurnos();
      return true;
    }
    return false;
  }

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
        const seLimpioTurno = limpiarTurnosYaCerrados();
        if (seLimpioTurno) huboNuevosLocales = true;
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

    limpiarTurnosYaCerrados();

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
      setStatus('error', 'Error: ' + (err.message || 'Local').slice(0, 28));
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
        const seLimpioTurno = limpiarTurnosYaCerrados();
        if (seLimpioTurno) huboNuevosLocales = true;

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

  // Inyectar columna CONTRASEÑA dentro de la tabla "Colaboradores Registrados" en Gestion de Personal
  function inyectarColumnaContrasenas() {
    if (typeof appData === 'undefined' || !Array.isArray(appData.usuarios)) return;

    const tablas = document.querySelectorAll('table');
    tablas.forEach(tabla => {
      const theadRow = tabla.querySelector('thead tr');
      if (!theadRow) return;
      const textoHeader = theadRow.textContent || '';
      if (!textoHeader.includes('ROL ASIGNADO') || !textoHeader.includes('ACCIONES')) return;

      // Agregar encabezado CONTRASEÑA antes de ACCIONES si no existe
      if (!theadRow.querySelector('.th-clave-personal')) {
        const thAcciones = Array.from(theadRow.children).find(th => (th.textContent || '').includes('ACCIONES'));
        if (thAcciones) {
          const thClave = document.createElement('th');
          thClave.className = thAcciones.className + ' th-clave-personal';
          thClave.textContent = 'CONTRASEÑA';
          theadRow.insertBefore(thClave, thAcciones);
        }
      }

      // Agregar celda con la clave y boton de ojito en cada fila de colaborador
      const filas = tabla.querySelectorAll('tbody tr');
      filas.forEach(tr => {
        if (tr.querySelector('.td-clave-personal')) return;
        const celdas = tr.children;
        if (celdas.length < 4) return;

        const nombreFila = (celdas[0].textContent || '').trim().toUpperCase();
        const usuarioFila = (celdas[1].textContent || '').trim().toUpperCase();
        const userObj = appData.usuarios.find(u =>
          (u.usuario && u.usuario.trim().toUpperCase() === usuarioFila) ||
          (u.nombre && u.nombre.trim().toUpperCase() === nombreFila)
        );

        const claveReal = userObj
          ? (userObj.password || userObj.clave || userObj.pin || userObj.contrasena || 'Sin clave')
          : '---';

        const tdAcciones = celdas[celdas.length - 1];
        const tdClave = document.createElement('td');
        tdClave.className = 'py-3 px-4 text-sm td-clave-personal';

        const wrap = document.createElement('div');
        wrap.className = 'inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1';

        const span = document.createElement('span');
        span.className = 'font-mono font-semibold text-slate-700 text-xs select-all';
        span.dataset.visible = '0';
        span.dataset.clave = claveReal;
        span.textContent = '••••••';

        const btnEye = document.createElement('button');
        btnEye.type = 'button';
        btnEye.title = 'Mostrar u ocultar contraseña';
        btnEye.className = 'text-slate-500 hover:text-blue-600 transition text-xs focus:outline-none';
        btnEye.innerHTML = '<i class="fa-solid fa-eye"></i>';
        btnEye.onclick = function (e) {
          e.stopPropagation();
          const visible = span.dataset.visible === '1';
          if (visible) {
            span.textContent = '••••••';
            span.dataset.visible = '0';
            btnEye.innerHTML = '<i class="fa-solid fa-eye"></i>';
          } else {
            span.textContent = span.dataset.clave;
            span.dataset.visible = '1';
            btnEye.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
          }
        };

        wrap.appendChild(span);
        wrap.appendChild(btnEye);
        tdClave.appendChild(wrap);
        tr.insertBefore(tdClave, tdAcciones);
      });
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.cargarDatosDesdeNube(false);
    inyectarColumnaContrasenas();
  });

  if (document.readyState !== 'loading') {
    window.cargarDatosDesdeNube(false);
    inyectarColumnaContrasenas();
  }

  setInterval(inyectarColumnaContrasenas, 600);

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      window.cargarDatosDesdeNube(false);
    }
  }, 15000);
})();