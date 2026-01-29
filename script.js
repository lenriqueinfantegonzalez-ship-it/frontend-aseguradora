// =========================================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// =========================================================
const API_URL = 'http://localhost:8081/api';
const usuarioGuardado = sessionStorage.getItem('usuario');
let usuario = null;

// Variables para los Modales
let modalInfo, modalConfirm, modalEmpresa, modalPrint, modalCrearUser;
let modalBorrado, modal2FA;
let modalEditarUser, modalEditarSin; // Modales de edición

// Variables globales para el borrado V2
var borrado_V2_Tipo = "";
var borrado_V2_Id = 0;

// =========================================================
// 2. INICIALIZACIÓN
// =========================================================
if (!usuarioGuardado) {
    window.location.href = 'index.html';
} else {
    usuario = JSON.parse(usuarioGuardado);
    document.addEventListener('DOMContentLoaded', () => {
        // Poner nombre en el menú superior
        const nombreDisplay = document.getElementById('nombreUsuarioDisplay');
        if(nombreDisplay) nombreDisplay.textContent = usuario.nombreCompleto;
        
        // --- GESTIÓN DE ROLES: OCULTAR ELEMENTOS SOLO-ADMIN ---
        if (usuario.rol !== 'ADMIN') {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'none'; 
                el.innerHTML = ''; 
            });
        }

        // Inicializar Modales de Bootstrap
        if(document.getElementById('infoModal')) modalInfo = new bootstrap.Modal(document.getElementById('infoModal'));
        if(document.getElementById('printModal')) modalPrint = new bootstrap.Modal(document.getElementById('printModal'));
        if(document.getElementById('modalCrearUsuario')) modalCrearUser = new bootstrap.Modal(document.getElementById('modalCrearUsuario'));
        if(document.getElementById('modalBorrado')) modalBorrado = new bootstrap.Modal(document.getElementById('modalBorrado'));
        if(document.getElementById('modal2FA')) modal2FA = new bootstrap.Modal(document.getElementById('modal2FA'));
        if(document.getElementById('empresaModal')) modalEmpresa = new bootstrap.Modal(document.getElementById('empresaModal'));
        if(document.getElementById('confirmModal')) modalConfirm = new bootstrap.Modal(document.getElementById('confirmModal'));
        // Modales de Edición
        if(document.getElementById('modalEditarUsuario')) modalEditarUser = new bootstrap.Modal(document.getElementById('modalEditarUsuario'));
        if(document.getElementById('modalEditarSiniestro')) modalEditarSin = new bootstrap.Modal(document.getElementById('modalEditarSiniestro'));

        // Listeners Formularios
        const formUser = document.getElementById('formCrearUsuario');
        if(formUser) formUser.addEventListener('submit', crearUsuarioNuevo);
        
        const formEditUser = document.getElementById('formEditarUsuario');
        if(formEditUser) formEditUser.addEventListener('submit', guardarEdicionUsuario);
        
        const formEditSin = document.getElementById('formEditarSiniestro');
        if(formEditSin) formEditSin.addEventListener('submit', guardarEdicionSiniestro);

        // Cargar la primera sección por defecto
        cargarSeccion('mis-seguros');
    });
}

// =========================================================
// 3. NAVEGACIÓN CENTRAL (ROUTER)
// =========================================================
async function cargarSeccion(seccion) {
    const contenedor = document.getElementById('contenido-dinamico');
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    // --- SECCIÓN: MIS SEGUROS ---
    if (seccion === 'mis-seguros') {
        const titulo = usuario.rol === 'ADMIN' ? 'Gestión Global de Pólizas' : 'Mis Pólizas Contratadas';
        renderizarCargando(contenedor, 'Cargando pólizas...');
        try {
            let endpoint = usuario.rol === 'ADMIN' ? `${API_URL}/seguros` : `${API_URL}/seguros/usuario/${usuario.idUsuario}`;
            const res = await fetch(endpoint, { credentials: 'include' });
            
            // Fallback para admin si falla la carga global
            if (!res.ok && usuario.rol === 'ADMIN') {
                 const resB = await fetch(`${API_URL}/seguros/usuario/${usuario.idUsuario}`, { credentials: 'include' });
                 if(resB.ok) renderizarSeguros(await resB.json(), contenedor, titulo);
                 else throw new Error("Error cargando seguros");
            } else if (res.ok) {
                renderizarSeguros(await res.json(), contenedor, titulo);
            } else { throw new Error("Error al cargar seguros"); }
        } catch (e) { mostrarError(contenedor); }

    // --- SECCIÓN: FACTURAS ---
    } else if (seccion === 'facturas') {
        const titulo = usuario.rol === 'ADMIN' ? 'Control de Facturación Global' : 'Mis Facturas';
        renderizarCargando(contenedor, 'Cargando facturas...');
        try {
            const endpoint = usuario.rol === 'ADMIN' ? `${API_URL}/facturas` : `${API_URL}/facturas/usuario/${usuario.idUsuario}`;
            const res = await fetch(endpoint, { credentials: 'include' });
            if (res.ok) renderizarFacturas(await res.json(), contenedor, titulo);
            else mostrarError(contenedor);
        } catch (e) { mostrarError(contenedor); }

    // --- SECCIÓN: SINIESTROS ---
    } else if (seccion === 'siniestros') {
        const titulo = usuario.rol === 'ADMIN' ? 'Gestión de Siniestros (Todos)' : 'Mis Siniestros';
        renderizarCargando(contenedor, 'Cargando siniestros...');
        try {
            const endpointSin = usuario.rol === 'ADMIN' ? `${API_URL}/siniestros` : `${API_URL}/siniestros/usuario/${usuario.idUsuario}`;
            const resSin = await fetch(endpointSin, { credentials: 'include' });
            const listaSiniestros = await resSin.json();

            const endpointSeg = usuario.rol === 'ADMIN' ? `${API_URL}/seguros` : `${API_URL}/seguros/usuario/${usuario.idUsuario}`;
            const resSeg = await fetch(endpointSeg, { credentials: 'include' });
            const listaSeguros = await resSeg.json();

            renderizarSiniestros(listaSiniestros, listaSeguros, contenedor, titulo);
        } catch (e) { mostrarError(contenedor); }

    // --- SECCIÓN: USUARIOS (SOLO ADMIN) ---
    } else if (seccion === 'usuarios') {
        if (usuario.rol !== 'ADMIN') { contenedor.innerHTML = '<div class="alert alert-danger">Acceso Denegado</div>'; return; }
        renderizarCargando(contenedor, 'Cargando directorio de usuarios...');
        try {
            const res = await fetch(`${API_URL}/usuarios`, { credentials: 'include' });
            if(res.ok) renderizarUsuarios(await res.json(), contenedor);
            else contenedor.innerHTML = '<div class="alert alert-warning">No se pudo cargar la lista.</div>';
        } catch (e) { mostrarError(contenedor); }

    // --- SECCIÓN: AÑADIR SEGURO ---
    } else if (seccion === 'anadir-seguro') {
        renderizarCargando(contenedor, 'Cargando datos del formulario...');
        try {
            const resTipos = await fetch(`${API_URL}/tipos-seguro`, { credentials: 'include' });
            const tipos = await resTipos.json();
            const resUsers = await fetch(`${API_URL}/usuarios`, { credentials: 'include' });
            const usuariosLista = await resUsers.json();
            renderizarFormularioAlta(tipos, usuariosLista, contenedor);
        } catch (e) { mostrarError(contenedor); }
    
    // --- OTRAS SECCIONES ---
    } else if (seccion === 'perfil') { renderizarPerfil(contenedor);
    } else if (seccion === 'ayuda') { renderizarAyuda(contenedor);
    } else if (seccion === 'config') { renderizarConfiguracion(contenedor);
    } else if (seccion === 'privacidad') { renderizarPrivacidad(contenedor); }
}

// =========================================================
// 4. RENDERIZADORES (VISTAS)
// =========================================================

// --- VISTA SEGUROS ---
function renderizarSeguros(lista, contenedor, titulo) {
    if (!lista || lista.length === 0) { 
        contenedor.innerHTML = `<h3 class="mb-4">${titulo}</h3><div class="alert alert-info shadow-sm">No hay pólizas registradas.</div>`;
        return; 
    }
    
    const htmlBuscador = `
    <div class="row mb-4">
        <div class="col-md-8"><h3 class="mb-0">${titulo}</h3></div>
        <div class="col-md-4"><div class="input-group shadow-sm"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorSeguros" class="form-control border-start-0" placeholder="Buscar póliza, tipo..."></div></div>
    </div>`;
    
    let htmlLista = '<div class="row" id="listaSeguros">';
    lista.forEach(seguro => {
        let icono = '🛡️';
        const nombreTipo = seguro.tipoSeguro ? seguro.tipoSeguro.nombre : 'Póliza Genérica';
        if(nombreTipo.toLowerCase().includes('coche')) icono = '🚗';
        else if(nombreTipo.toLowerCase().includes('hogar')) icono = '🏠';
        
        let extraInfo = '';
        let botonBorrar = '';
        const id = seguro.idSeguro || seguro.id;

        if (usuario.rol === 'ADMIN') {
            const clienteNombre = seguro.usuario ? seguro.usuario.nombreCompleto : 'Sin Asignar';
            extraInfo = `<div class="mt-2 pt-2 border-top small text-muted bg-light p-2 rounded"><i class="fa-solid fa-user me-1"></i> <strong>Cliente:</strong> ${clienteNombre}</div>`;
            botonBorrar = `<button class="btn btn-outline-danger btn-sm w-100 mt-2" onclick="solicitarBorrado_V2('seguros', ${id})"><i class="fa-solid fa-trash me-1"></i> Dar de Baja</button>`;
        }

        htmlLista += `
        <div class="col-md-6 mb-4 item-seguro">
            <div class="card h-100 shadow-sm border-0 border-top border-4 border-primary">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold mb-0 text-primary">${icono} ${nombreTipo}</h5>
                        <span class="badge bg-success">ACTIVO</span>
                    </div>
                    <p class="text-muted small"><strong>PÓLIZA:</strong> ${seguro.numPoliza}</p>
                    <p class="bg-light p-2 rounded small border">${seguro.datosEspecificos || 'Sin detalles'}</p>
                    <div class="d-flex justify-content-between small text-muted border-top pt-2 mb-2"><span>Inicio: ${seguro.fechaInicio}</span><span>Renueva: ${seguro.fechaRenovacion}</span></div>
                    ${extraInfo} 
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <span class="fw-bold fs-5">${seguro.primaAnual} €/año</span>
                    </div>
                    ${botonBorrar}
                </div>
            </div>
        </div>`;
    });
    htmlLista += '</div>';
    contenedor.innerHTML = htmlBuscador + htmlLista;

    if(document.getElementById('buscadorSeguros')){
        document.getElementById('buscadorSeguros').addEventListener('keyup', (e) => {
            const texto = e.target.value.toLowerCase();
            document.querySelectorAll('.item-seguro').forEach(item => { item.style.display = item.textContent.toLowerCase().includes(texto) ? '' : 'none'; });
        });
    }
}

// --- VISTA USUARIOS ---
function renderizarUsuarios(lista, contenedor) {
    let botonCrear = '';
    let headerAcciones = '';
    if (usuario.rol === 'ADMIN') {
        botonCrear = `<button class="btn btn-success shadow-sm ms-3" onclick="modalCrearUser.show()"><i class="fa-solid fa-user-plus me-2"></i> Nuevo</button>`;
        headerAcciones = '<th class="text-end pe-4">Acciones</th>';
    }

    const htmlBuscador = `
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h3 class="mb-0">Directorio de Usuarios</h3>
        <div class="d-flex"><div class="input-group shadow-sm" style="width: 250px;"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorUsuarios" class="form-control border-start-0" placeholder="Buscar usuario..."></div>${botonCrear}</div>
    </div>`;

    let htmlLista = `<div class="card border-0 shadow-sm"><div class="table-responsive">
    <table class="table table-hover align-middle mb-0"><thead class="table-light"><tr>
        <th class="ps-4">Nombre Completo</th><th>Correo</th><th>Rol</th><th>Estado</th>${headerAcciones}
    </tr></thead><tbody id="tablaUsuarios">`;
    
    lista.forEach(u => {
        const userJson = JSON.stringify(u).replace(/'/g, "\\'"); 
        let colAcciones = '';
        let badgeRol = u.rol === 'ADMIN' ? 'bg-dark' : 'bg-primary';
        let badgeEstado = u.activo ? '<span class="badge bg-success rounded-pill px-3">Activo</span>' : '<span class="badge bg-danger rounded-pill px-3">Inactivo</span>';

        if (usuario.rol === 'ADMIN') {
            if (u.idUsuario !== usuario.idUsuario) {
                // BOTONES: EDITAR Y BORRAR
                colAcciones = `
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick='cargarDatosUsuario(${userJson})' title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="solicitarBorrado_V2('usuarios', ${u.idUsuario})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            } else { colAcciones = '<td class="text-end pe-4"><span class="text-muted small fst-italic">Tu cuenta</span></td>'; }
        }
        
        let iconUser = u.rol === 'ADMIN' ? '<i class="fa-solid fa-user-tie me-2 text-dark"></i>' : '<i class="fa-solid fa-user me-2 text-secondary"></i>';
        htmlLista += `<tr><td class="ps-4 fw-bold text-dark">${iconUser}${u.nombreCompleto}</td><td>${u.correo}</td><td><span class="badge ${badgeRol}">${u.rol}</span></td><td>${badgeEstado}</td>${colAcciones}</tr>`;
    });
    htmlLista += '</tbody></table></div></div>';
    contenedor.innerHTML = htmlBuscador + htmlLista;

    if(document.getElementById('buscadorUsuarios')){
        document.getElementById('buscadorUsuarios').addEventListener('keyup', (e) => {
            const texto = e.target.value.toLowerCase();
            const filas = document.getElementById('tablaUsuarios').getElementsByTagName('tr');
            for (let fila of filas) fila.style.display = fila.textContent.toLowerCase().includes(texto) ? '' : 'none';
        });
    }
}

// --- VISTA FACTURAS ---
function renderizarFacturas(lista, contenedor, titulo) {
    const tituloMostrar = titulo || 'Mis Facturas';
    if (!lista || lista.length === 0) { 
        contenedor.innerHTML = `<h3 class="mb-4">${tituloMostrar}</h3><div class="alert alert-info shadow-sm">No hay facturas disponibles.</div>`;
        return; 
    }
    const htmlBuscador = `
    <div class="row mb-4">
        <div class="col-md-8"><h3 class="mb-0">${tituloMostrar}</h3></div>
        <div class="col-md-4"><div class="input-group shadow-sm"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorFacturas" class="form-control border-start-0" placeholder="Buscar concepto, importe..."></div></div>
    </div>`;
    const thCliente = usuario.rol === 'ADMIN' ? '<th class="ps-3">Cliente</th>' : '';
    let htmlLista = `<div class="card border-0 shadow-sm"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th class="ps-4">Concepto</th>${thCliente}<th>Fecha</th><th>Importe</th><th class="text-end pe-4">Acciones</th></tr></thead><tbody id="tablaFacturas">`;
    
    lista.forEach(f => {
        const elId = f.idFactura || f.id; 
        const jsonF = JSON.stringify(f).replace(/"/g, '&quot;');
        let tdCliente = '';
        if (usuario.rol === 'ADMIN') {
            const nombre = (f.usuario) ? f.usuario.nombreCompleto : 'Desconocido';
            tdCliente = `<td class="ps-3"><small class="fw-bold">${nombre}</small></td>`;
        }
        let btnBorrar = '';
        if (usuario.rol === 'ADMIN') {
             btnBorrar = `<button class="btn btn-sm btn-outline-danger ms-1" onclick="solicitarBorrado_V2('facturas', ${elId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`;
        }
        htmlLista += `<tr><td class="ps-4 fw-bold">${f.concepto || 'Sin concepto'}</td>${tdCliente}<td>${f.fechaEmision}</td><td class="fw-bold text-primary">${f.importe} €</td><td class="text-end pe-4"><button class="btn btn-sm btn-primary" onclick="prepararFactura(${jsonF})" title="Imprimir/PDF"><i class="fa-solid fa-print"></i></button>${btnBorrar}</td></tr>`;
    });
    htmlLista += '</tbody></table></div></div>';
    contenedor.innerHTML = htmlBuscador + htmlLista;
    
    if(document.getElementById('buscadorFacturas')){
        document.getElementById('buscadorFacturas').addEventListener('keyup', (e) => {
            const texto = e.target.value.toLowerCase();
            const filas = document.getElementById('tablaFacturas').getElementsByTagName('tr');
            for (let fila of filas) fila.style.display = fila.textContent.toLowerCase().includes(texto) ? '' : 'none';
        });
    }
}

// --- VISTA SINIESTROS ---
function renderizarSiniestros(siniestros, seguros, contenedor, titulo) {
    const tituloMostrar = titulo || 'Gestión de Siniestros';
    let opcionesSeguro = '<option value="" disabled selected>-- Seleccione Seguro --</option>';
    if (seguros.length > 0) {
        seguros.forEach(s => { 
            const extra = (usuario.rol === 'ADMIN' && s.usuario) ? ` (${s.usuario.nombreCompleto})` : '';
            opcionesSeguro += `<option value="${s.idSeguro}">${s.tipoSeguro.nombre} - ${s.numPoliza}${extra}</option>`; 
        });
    } else { opcionesSeguro = '<option disabled>No hay seguros disponibles</option>'; }

    const htmlBuscador = `<div class="mb-3"><div class="input-group shadow-sm"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorSiniestros" class="form-control border-start-0" placeholder="Buscar siniestro..."></div></div>`;

    let listaHTML = '';
    if (siniestros.length === 0) { listaHTML = '<div class="alert alert-success">No hay siniestros registrados.</div>'; } 
    else {
        listaHTML += '<div id="listaSiniestros">'; 
        siniestros.forEach(s => {
            const elId = s.idSiniestro || s.id;
            let color = s.estado === 'ABIERTO' ? 'warning' : (s.estado === 'RECHAZADO' ? 'danger' : 'success');
            const sinJson = JSON.stringify(s).replace(/'/g, "\\'");
            
            let acciones = '';
            let infoCliente = '';
            
            if (usuario.rol === 'ADMIN') {
               const cliente = s.seguro && s.seguro.usuario ? s.seguro.usuario : null;
               if(cliente) infoCliente = `<div class="mb-2 small text-muted border-bottom pb-2"><i class="fa-solid fa-user me-1"></i> <strong>Cliente:</strong> ${cliente.nombreCompleto}</div>`;
               
               // BOTONES EDITAR Y BORRAR
               acciones = `
               <div>
                   <button class="btn btn-sm btn-outline-primary me-1" onclick='cargarDatosSiniestro(${sinJson})' title="Gestionar"><i class="fa-solid fa-pen-to-square"></i></button>
                   <button class="btn btn-sm btn-outline-secondary" onclick="solicitarBorrado_V2('siniestros', ${elId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
               </div>`;
            }

            listaHTML += `
            <div class="card mb-3 border-${color} border-start border-3 shadow-sm item-siniestro">
                <div class="card-body">
                    ${infoCliente}
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-0">Póliza: ${s.seguro ? s.seguro.numPoliza : '???'}</h6>
                            <span class="badge bg-${color} mt-1">${s.estado}</span>
                        </div>
                        ${acciones}
                    </div>
                    <hr class="my-2">
                    <p class="mb-1 small text-muted"><i class="fa-solid fa-calendar-day me-1"></i> ${s.fechaSuceso}</p>
                    <p class="mb-2 text-dark">${s.descripcion}</p>
                    <div class="bg-light p-2 rounded small fst-italic border"><i class="fa-solid fa-user-shield me-1"></i> Resolución: ${s.resolucion || 'Pendiente de resolución'}</div>
                </div>
            </div>`;
        });
        listaHTML += '</div>';
    }

    contenedor.innerHTML = `
    <h3 class="mb-4">${tituloMostrar}</h3>
    <div class="row">
        <div class="col-md-5 mb-4"><div class="card shadow border-0"><div class="card-header bg-danger text-white fw-bold"><i class="fa-solid fa-triangle-exclamation me-2"></i> Reportar Nuevo Siniestro</div><div class="card-body">
            <form id="formSiniestro">
                <div class="mb-3"><label class="fw-bold">Póliza Afectada</label><select id="sinSeguro" class="form-select" required>${opcionesSeguro}</select></div>
                <div class="mb-3"><label class="fw-bold">Descripción del incidente</label><textarea id="sinDesc" class="form-control" rows="4" required placeholder="Detalles del incidente..."></textarea></div>
                <div class="d-grid"><button type="submit" class="btn btn-danger">Enviar Parte</button></div>
            </form></div></div></div>
        <div class="col-md-7"><h5 class="text-muted mb-3">Historial</h5>${htmlBuscador}<div style="max-height: 600px; overflow-y: auto;">${listaHTML}</div></div>
    </div>`;

    if(document.getElementById('buscadorSiniestros')) {
        document.getElementById('buscadorSiniestros').addEventListener('keyup', (e) => {
            const texto = e.target.value.toLowerCase();
            document.querySelectorAll('.item-siniestro').forEach(item => { item.style.display = item.textContent.toLowerCase().includes(texto) ? '' : 'none'; });
        });
    }
    const formSin = document.getElementById('formSiniestro');
    if(formSin) {
        formSin.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await fetch(`${API_URL}/siniestros`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                    body: JSON.stringify({ descripcion: document.getElementById('sinDesc').value, seguro: { idSeguro: document.getElementById('sinSeguro').value } })
                });
                if (res.ok) { mostrarPopup("Siniestro reportado correctamente."); cargarSeccion('siniestros'); }
                else mostrarPopup("Error al reportar.");
            } catch (error) { mostrarPopup("Error conexión."); }
        });
    }
}

// =========================================================
// 5. LÓGICA DE EDICIÓN (PUT)
// =========================================================

// --- A. EDICIÓN DE USUARIOS ---
function cargarDatosUsuario(user) {
    document.getElementById('editUserId').value = user.idUsuario;
    document.getElementById('editUserNombre').value = user.nombreCompleto;
    document.getElementById('editUserEmail').value = user.correo;
    document.getElementById('editUserRol').value = user.rol;
    document.getElementById('editUserActivo').value = user.activo.toString(); 
    modalEditarUser.show();
}

async function guardarEdicionUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const datosEditados = {
        idUsuario: id,
        nombreCompleto: document.getElementById('editUserNombre').value,
        rol: document.getElementById('editUserRol').value,
        activo: document.getElementById('editUserActivo').value === 'true',
        correo: document.getElementById('editUserEmail').value
    };

    try {
        const resGet = await fetch(`${API_URL}/usuarios/${id}`, { credentials: 'include' });
        const userActual = await resGet.json();
        
        // Mantener password original y actualizar resto
        const datosFinales = { ...userActual, ...datosEditados };

        const res = await fetch(`${API_URL}/usuarios/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(datosFinales)
        });

        if (res.ok) {
            mostrarPopup("Usuario actualizado correctamente.");
            modalEditarUser.hide();
            cargarSeccion('usuarios');
        } else { mostrarPopup("Error al actualizar usuario."); }
    } catch (error) { mostrarPopup("Error de conexión: " + error.message); }
}

// --- B. EDICIÓN DE SINIESTROS ---
function cargarDatosSiniestro(sin) {
    document.getElementById('editSinId').value = sin.idSiniestro || sin.id;
    document.getElementById('editSinDesc').value = sin.descripcion;
    document.getElementById('editSinEstado').value = sin.estado;
    document.getElementById('editSinResolucion').value = sin.resolucion || '';
    modalEditarSin.show();
}

async function guardarEdicionSiniestro(e) {
    e.preventDefault();
    const id = document.getElementById('editSinId').value;
    try {
        const resGet = await fetch(`${API_URL}/siniestros/${id}`, { credentials: 'include' });
        const sinActual = await resGet.json();

        const datosEditados = {
            ...sinActual,
            estado: document.getElementById('editSinEstado').value,
            resolucion: document.getElementById('editSinResolucion').value
        };

        const res = await fetch(`${API_URL}/siniestros/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(datosEditados)
        });

        if (res.ok) {
            mostrarPopup("Siniestro actualizado.");
            modalEditarSin.hide();
            cargarSeccion('siniestros');
        } else { mostrarPopup("Error al actualizar siniestro."); }

    } catch (error) { mostrarPopup("Error de conexión."); }
}


// =========================================================
// 6. LÓGICA DE BORRADO Y UTILIDADES
// =========================================================
function solicitarBorrado_V2(tipoTexto, idNumero) {
    if (!tipoTexto || !idNumero || idNumero === 0) { alert("Error ID"); return; }
    borrado_V2_Tipo = tipoTexto; borrado_V2_Id = idNumero;
    if (!modalBorrado) modalBorrado = new bootstrap.Modal(document.getElementById('modalBorrado'));
    const input = document.getElementById('inputBorradoConfirm'); const btn = document.getElementById('btnBorrarFinal');
    if(input) { input.value = ""; setTimeout(() => input.focus(), 500); }
    if(btn) btn.disabled = true;
    modalBorrado.show();
}
function verificarTextoBorrado_V2() {
    const texto = document.getElementById('inputBorradoConfirm').value;
    const btn = document.getElementById('btnBorrarFinal');
    if(btn) btn.disabled = (texto !== "ELIMINAR");
}
async function ejecutarBorrado_V2() {
    const tipo = borrado_V2_Tipo; const id = borrado_V2_Id;
    if (!tipo || id === 0) { alert("Error variables"); if(modalBorrado) modalBorrado.hide(); return; }
    const btn = document.getElementById('btnBorrarFinal'); if(btn) btn.innerHTML = 'Borrando...';
    try {
        const res = await fetch(`${API_URL}/${tipo}/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) {
            if(modalBorrado) modalBorrado.hide(); mostrarPopup("Registro eliminado."); cargarSeccion(tipo);
        } else {
            const texto = await res.text();
            if (res.status === 409 || res.status === 500) {
                if (texto.includes("constraint") || texto.includes("foreign key")) mostrarPopup("💡 No se puede eliminar la póliza todavía.\n\nPrimero debes eliminar las FACTURAS o SINIESTROS asociados a ella.");
                else mostrarPopup("El servidor no pudo borrar el elemento. Inténtalo más tarde.");
            } else mostrarPopup("No se pudo completar la acción.");
        }
    } catch (error) { alert("Error conexión."); } finally { if(btn) btn.innerHTML = 'Confirmar Eliminación'; }
}

// RESTO DE RENDERIZADORES AUXILIARES
function renderizarFormularioAlta(tipos, listaUsuarios, contenedor) {
    let optsTipos = `<option value="" disabled selected>-- Seleccione Tipo --</option>`;
    tipos.forEach(t => optsTipos += `<option value="${t.idTipo}">${t.nombre} (${t.precioBase}€)</option>`);
    let optsUsuarios = `<option value="" disabled selected>-- Seleccione Cliente --</option>`;
    listaUsuarios.forEach(u => { optsUsuarios += `<option value="${u.idUsuario}">${u.nombreCompleto} (${u.rol})</option>`; });
    const poliza = 'POL-' + Math.floor(Math.random()*99999);
    
    contenedor.innerHTML = `
    <h3 class="mb-4">Contratar Nuevo Seguro</h3>
    <div class="card shadow-sm border-0" style="max-width: 700px;"><div class="card-body p-4"><form id="formAlta">
        <div class="mb-3"><label class="fw-bold">Cliente</label><select id="idClienteAsignado" class="form-select" required>${optsUsuarios}</select></div>
        <div class="row mb-3"><div class="col"><label class="fw-bold">Tipo</label><select id="idTipo" class="form-select" required>${optsTipos}</select></div>
        <div class="col"><label class="fw-bold">Póliza</label><input id="numPoliza" class="form-control bg-light" value="${poliza}" readonly></div></div>
        <div class="row mb-3"><div class="col"><label>Inicio</label><input type="date" id="fInicio" class="form-control" required></div>
        <div class="col"><label>Renovación</label><input type="date" id="fRenov" class="form-control" required></div></div>
        <div class="mb-3"><label class="fw-bold">Detalles</label><textarea id="detalles" class="form-control" required></textarea></div>
        <div class="mb-3"><label class="fw-bold">Precio (€)</label><input type="number" id="precio" class="form-control" required></div>
        <button type="submit" class="btn btn-primary w-100">Crear Póliza</button>
    </form></div></div>`;
    
    const iIni = document.getElementById('fInicio'); const iRen = document.getElementById('fRenov');
    if(iIni && iRen) iIni.addEventListener('change', () => { if (iIni.value) { const d = new Date(iIni.value); d.setFullYear(d.getFullYear() + 1); iRen.value = d.toISOString().split('T')[0]; }});
    
    document.getElementById('formAlta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = { numPoliza: document.getElementById('numPoliza').value, fechaInicio: document.getElementById('fInicio').value, fechaRenovacion: document.getElementById('fRenov').value, primaAnual: parseFloat(document.getElementById('precio').value), datosEspecificos: document.getElementById('detalles').value, estado: "ACTIVO", usuario: { idUsuario: document.getElementById('idClienteAsignado').value }, tipoSeguro: { idTipo: document.getElementById('idTipo').value } };
        try { const r = await fetch(`${API_URL}/seguros`, { method:'POST', headers:{'Content-Type':'application/json'}, credentials: 'include', body:JSON.stringify(d) }); if(r.ok){ mostrarPopup("¡Póliza creada!"); cargarSeccion('mis-seguros'); } else mostrarPopup("Error al guardar."); } catch(e){ mostrarPopup("Error conexión."); }
    });
}

function renderizarConfiguracion(c) {
    let botonHtml = usuario.twoFactorEnabled ?
        // AQUÍ ESTÁ EL CAMBIO: onclick="solicitarDesactivar2FA()"
        `<div class="alert alert-success mb-3 shadow-sm"><i class="fa-solid fa-shield-check me-2"></i>2FA Activado</div>
         <button class="btn btn-outline-danger w-100" onclick="solicitarDesactivar2FA()">Desactivar 2FA</button>` 
        : 
        `<button class="btn btn-primary w-100" onclick="iniciarSetup2FA()">Activar 2FA</button>`;
        
    c.innerHTML = `<h3 class="mb-4">Configuración</h3><div class="row justify-content-center"><div class="col-md-8"><div class="card shadow border-0"><div class="card-body p-5 text-center"><i class="fa-solid fa-mobile-screen-button text-primary fa-4x mb-4"></i><h4>Seguridad 2FA</h4><div class="mt-2">${botonHtml}</div></div></div></div></div>`;
}

function renderizarPerfil(c) {
    c.innerHTML = `<h3 class="mb-4">Perfil</h3><div class="card p-4 border-0 shadow-sm" style="max-width: 500px"><form id="formPerfil"><div class="mb-3"><label>Nombre</label><input id="pN" class="form-control" value="${usuario.nombreCompleto}"></div><div class="mb-3"><label>Email</label><input class="form-control bg-light" value="${usuario.correo}" disabled></div><div class="mb-3"><label>Móvil</label><input id="pM" class="form-control" value="${usuario.movil||''}"></div><button type="submit" class="btn btn-primary w-100">Guardar</button></form></div>`;
    document.getElementById('formPerfil').addEventListener('submit', async(e)=>{ e.preventDefault(); try { const res = await fetch(`${API_URL}/usuarios/${usuario.idUsuario}`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials: 'include', body:JSON.stringify({...usuario, nombreCompleto:document.getElementById('pN').value, movil:document.getElementById('pM').value})}); if(res.ok){ usuario=await res.json(); sessionStorage.setItem('usuario',JSON.stringify(usuario)); document.getElementById('nombreUsuarioDisplay').textContent=usuario.nombreCompleto; mostrarPopup("Actualizado."); } } catch(e){mostrarPopup("Error.");} });
}

function renderizarAyuda(contenedor) {
    contenedor.innerHTML = `
    <h3 class="mb-4">Centro de Ayuda y Soporte</h3>
    <div class="row">
        <div class="col-md-6 mb-4"><div class="card shadow-sm border-0 h-100"><div class="card-body">
            <h5 class="fw-bold text-primary mb-3">Envíanos tu consulta</h5>
            <form id="formAyuda">
                <div class="mb-3"><label class="form-label">Asunto</label><select class="form-select" required><option>Duda Póliza</option><option>Problema Factura</option><option>Otro</option></select></div>
                <div class="mb-3"><label class="form-label">Mensaje</label><textarea class="form-control" rows="4" required placeholder="Describe tu consulta..."></textarea></div>
                <button type="submit" class="btn btn-primary w-100">Enviar</button>
            </form>
        </div></div></div>
        <div class="col-md-6 mb-4"><div class="card bg-light border-0 h-100"><div class="card-body">
            <h5><i class="fa-solid fa-circle-question me-2"></i>Preguntas Frecuentes</h5>
            <div class="accordion mt-3" id="faqAcc">
                <div class="accordion-item mb-2 border-0 shadow-sm"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q1">No puedo borrar un seguro</button></h2>
                <div id="q1" class="accordion-collapse collapse" data-bs-parent="#faqAcc"><div class="accordion-body text-muted small">Debes cancelar primero la factura asociada.</div></div></div>
                <div class="accordion-item mb-2 border-0 shadow-sm"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q2">¿Cómo descargar facturas?</button></h2>
                <div id="q2" class="accordion-collapse collapse" data-bs-parent="#faqAcc"><div class="accordion-body text-muted small">Ve a la sección Facturas y pulsa el botón azul.</div></div></div>
                 <div class="accordion-item mb-2 border-0 shadow-sm"><h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q3">¿Dónde veo la información de la empresa?</button></h2>
                <div id="q3" class="accordion-collapse collapse" data-bs-parent="#faqAcc"><div class="accordion-body text-muted small">Haz clic en el botón 'Info Empresa' en el menú lateral.</div></div></div>
            </div>
        </div></div></div>
    </div>`;
    document.getElementById('formAyuda').addEventListener('submit', (e) => { e.preventDefault(); mostrarPopup("Mensaje enviado. Contactaremos contigo pronto."); e.target.reset(); });
}

function renderizarPrivacidad(contenedor) {
    const year = new Date().getFullYear();
    contenedor.innerHTML = `
    <h3 class="mb-4">Política de Privacidad y Aviso Legal</h3>
    <div class="card shadow-sm border-0"><div class="card-body p-5">
        <div class="text-center mb-5"><div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 60px; height: 60px; font-weight: bold; font-size: 24px;">A</div>
        <h2 class="fw-bold text-dark">LEIGSeguros</h2><p class="text-muted">Comprometidos con la transparencia y tu seguridad.</p></div>

        <h5 class="fw-bold mt-4"><i class="fa-solid fa-building-shield me-2 text-primary"></i>1. Responsable del Tratamiento</h5>
        <p class="text-justify text-muted"><strong>LEIGSeguros S.L.</strong>, con domicilio en Calle Mayor 123, Madrid, España, es la responsable del tratamiento de sus datos personales. Puede contactar con nuestro Delegado de Protección de Datos (DPO) en <strong>aseguradoraleig@gmail.com</strong>.</p>

        <h5 class="fw-bold mt-4"><i class="fa-solid fa-file-contract me-2 text-primary"></i>2. Finalidad del Tratamiento</h5>
        <p class="text-justify text-muted">Sus datos personales serán utilizados exclusivamente para las siguientes finalidades:
            <ul class="text-muted">
                <li>Gestión y administración de las pólizas de seguro contratadas.</li>
                <li>Emisión de facturas y gestión de cobros.</li>
                <li>Gestión de siniestros y asistencia técnica.</li>
                <li>Envío de comunicaciones relacionadas con el servicio (renovaciones, avisos importantes).</li>
            </ul>
        </p>

        <h5 class="fw-bold mt-4"><i class="fa-solid fa-scale-balanced me-2 text-primary"></i>3. Legitimación</h5>
        <p class="text-justify text-muted">La base legal para el tratamiento de sus datos es la <strong>ejecución del contrato</strong> de seguro del que usted es parte.</p>

        <h5 class="fw-bold mt-4"><i class="fa-solid fa-user-lock me-2 text-primary"></i>4. Destinatarios</h5>
        <p class="text-justify text-muted">Sus datos no serán cedidos a terceros, salvo obligación legal (Agencia Tributaria, Jueces y Tribunales) o proveedores de servicios necesarios para la prestación del servicio (servicios de hosting, pasarelas de pago), siempre bajo estrictos contratos de confidencialidad.</p>

        <h5 class="fw-bold mt-4"><i class="fa-solid fa-hand-holding-heart me-2 text-primary"></i>5. Derechos del Usuario (ARCO)</h5>
        <p class="text-justify text-muted">Como titular de los datos, usted tiene derecho a:
            <ul class="text-muted">
                <li><strong>Acceder</strong> a sus datos personales.</li>
                <li>Solicitar la <strong>rectificación</strong> de los datos inexactos.</li>
                <li>Solicitar su <strong>supresión</strong> cuando, entre otros motivos, los datos ya no sean necesarios para los fines que fueron recogidos.</li>
                <li>Oponerse al tratamiento de sus datos.</li>
            </ul>
            Puede ejercer estos derechos enviando una solicitud por escrito a nuestra dirección de contacto.
        </p>
        <hr class="my-5">
        <div class="text-center text-muted small"><p class="mb-1"><strong>&copy; ${year} LEIGSeguros S.L.</strong> Todos los derechos reservados.</p>
        <p>Inscrita en el Registro Mercantil de Madrid, Tomo 1234, Folio 56, Hoja M-12345.</p></div>
    </div></div>`;
}

// UTILIDADES FINALES
async function crearUsuarioNuevo(e) { e.preventDefault(); const d = { nombreCompleto: document.getElementById('newUserName').value, correo: document.getElementById('newUserEmail').value, password: document.getElementById('newUserPass').value, rol: document.getElementById('newUserRol').value, activo: true }; try { const res = await fetch(`${API_URL}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(d) }); if(res.ok) { modalCrearUser.hide(); mostrarPopup("Creado."); cargarSeccion('usuarios'); } } catch(err) {} }
function prepararFactura(f) { 
    const contenido = `
    <div id="facturaImprimible" class="p-5 bg-white border">
        <div class="d-flex justify-content-between mb-4">
            <div><h2 class="fw-bold text-primary">FACTURA</h2><p class="text-muted mb-0"> LEIGSeguros S.L.</p></div>
            <div class="text-end"><h5 class="text-dark">Ref: INV-${f.idFactura}</h5><p class="text-muted">${f.fechaEmision}</p></div>
        </div>
        <hr>
        <div class="row mb-5"><div class="col-6"><h6 class="fw-bold">Cliente:</h6><p class="mb-0">${usuario.nombreCompleto}</p><p class="mb-0">${usuario.correo}</p></div></div>
        <table class="table table-bordered"><thead class="table-light"><tr><th>Concepto</th><th class="text-end">Importe</th></tr></thead>
        <tbody><tr><td class="p-3">${f.concepto}</td><td class="text-end p-3 fw-bold">${f.importe} €</td></tr></tbody>
        <tfoot><tr class="table-secondary"><th class="text-end">TOTAL</th><th class="text-end fs-4">${f.importe} €</th></tr></tfoot></table>
    </div>`;
    document.getElementById('areaImpresion').innerHTML = contenido;
    // Configurar botones del modal
    const footer = document.getElementById('printModal').querySelector('.modal-footer');
    footer.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
        <button type="button" class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir</button>
        <button type="button" class="btn btn-success" onclick="descargarPDF(${f.idFactura})"><i class="fa-solid fa-file-pdf"></i> Descargar PDF</button>
    `;
    modalPrint.show(); 
}
function descargarPDF(id) { 
    const element = document.getElementById('facturaImprimible');
    if(!element || typeof html2pdf === 'undefined') { alert("Error PDF"); return; }
    html2pdf().set({ margin: 10, filename: `Factura_${id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
}
// Función 1: Abre el modal y prepara el botón
function solicitarDesactivar2FA() {
    const modalEl = document.getElementById('confirmModal');
    const btnConfirmar = document.getElementById('btnConfirmarBorrado');
    
    // 1. Cambiamos los textos del Modal para que no parezca de borrar
    modalEl.querySelector('.modal-header').classList.replace('bg-danger', 'bg-warning'); // Color amarillo advertencia
    modalEl.querySelector('.modal-title').textContent = "Desactivar Seguridad";
    modalEl.querySelector('.modal-body i').className = "fa-solid fa-shield-slash text-warning fa-3x mb-3"; // Icono escudo roto
    modalEl.querySelector('.modal-body p.fw-bold').textContent = "¿Seguro que quieres quitar el 2FA?";
    modalEl.querySelector('.modal-body p.small').textContent = "Tu cuenta será menos segura sin la verificación en dos pasos.";
    
    // 2. Configuramos el botón "Sí"
    btnConfirmar.className = "btn btn-warning fw-bold";
    btnConfirmar.textContent = "Sí, Desactivar";
    
    // 3. Le asignamos la acción de borrar al hacer click
    btnConfirmar.onclick = function() {
        modalConfirm.hide();
        ejecutarDesactivacionReal(); // Llamamos a la función real
    };

    // 4. Mostramos el modal
    modalConfirm.show();
}

// Función 2: La que llama a la API (Backend)
async function ejecutarDesactivacionReal() {
    try {
        const res = await fetch(`${API_URL}/auth/disable-2fa`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({correo: usuario.correo})
        });

        if(res.ok){
            usuario.twoFactorEnabled = false;
            sessionStorage.setItem('usuario', JSON.stringify(usuario));
            
            // Recargamos la vista para que salga el botón azul de "Activar"
            renderizarConfiguracion(document.getElementById('contenido-dinamico'));
            
            // Restauramos el estilo del modal (opcional, por limpieza) y avisamos
            mostrarPopup("Autenticación en dos pasos desactivada.");
        } else {
            mostrarPopup("No se pudo desactivar. Inténtalo de nuevo.");
        }
    } catch(e) {
        mostrarPopup("Error de conexión con el servidor.");
    }
}
async function iniciarSetup2FA() { const res = await fetch(`${API_URL}/auth/setup-2fa`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({correo:usuario.correo})}); if(res.ok){ const d=await res.json(); document.getElementById('qrContainer').innerHTML=""; new QRCode(document.getElementById('qrContainer'), d.qrUrl); modal2FA.show(); } }
async function confirmarActivacion2FA() { const c = document.getElementById('inputCodeConfirm').value; const res = await fetch(`${API_URL}/auth/confirm-2fa`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({correo:usuario.correo, codigo:c})}); if(res.ok){ modal2FA.hide(); usuario.twoFactorEnabled=true; sessionStorage.setItem('usuario', JSON.stringify(usuario)); renderizarConfiguracion(document.getElementById('contenido-dinamico')); } }
function renderizarCargando(c, t) { c.innerHTML = `<div class="text-center mt-5"><div class="spinner-border text-primary"></div><p>${t}</p></div>`; }
function mostrarError(c) { c.innerHTML = '<div class="alert alert-danger">Error.</div>'; }
function mostrarPopup(msg) { document.getElementById('modalMensaje').innerText = msg; modalInfo.show(); }
function logout() { sessionStorage.removeItem('usuario'); window.location.href = 'index.html'; }