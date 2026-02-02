// =========================================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// =========================================================
const API_URL = 'http://localhost:8081/api';
const usuarioGuardado = localStorage.getItem('usuario');
let usuario = null;

// Variables globales de datos (PARA EVITAR ERRORES DE COMILLAS)
let listaFacturasGlobal = [];
let listaSiniestrosGlobal = [];
let listaUsuariosGlobal = [];

// Variables para los Modales
let modalInfo, modalConfirm, modalEmpresa, modalPrint, modalCrearUser;
let modalBorrado, modal2FA;
let modalEditarUser, modalEditarSin; 

// Variables globales para el borrado
var borrado_V2_Tipo = "";
var borrado_V2_Id = 0;

// =========================================================
// FUNCIÓN AUXILIAR DE SEGURIDAD (TOKEN)
// =========================================================
async function authFetch(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.warn("No hay token, redirigiendo...");
        window.location.href = 'index.html'; 
        return null;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        ...options.headers
    };

    try {
        const url = endpoint.startsWith('http') ? endpoint : (API_URL + endpoint);
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            alert("Tu sesión ha expirado. Por favor, entra de nuevo.");
            localStorage.clear();
            window.location.href = 'index.html';
            return null;
        }
        if (response.status === 403) {
            console.warn("Acceso 403: Permisos insuficientes.");
            return response;
        }

        return response;
    } catch (error) {
        console.error("Error AuthFetch:", error);
        return null;
    }
}

// =========================================================
// 2. INICIALIZACIÓN
// =========================================================
if (!usuarioGuardado) {
    window.location.href = 'index.html';
} else {
    usuario = JSON.parse(usuarioGuardado);
    document.addEventListener('DOMContentLoaded', () => {
        const nombreDisplay = document.getElementById('nombreUsuarioDisplay');
        if(nombreDisplay) nombreDisplay.textContent = usuario.nombreCompleto;
        
        // Ocultar cosas de admin si no lo es
        if (usuario.rol !== 'ADMIN') {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'none'; 
                el.innerHTML = ''; 
            });
        }

        // Inicializar Modales (Bootstrap 5)
        const initModal = (id) => document.getElementById(id) ? new bootstrap.Modal(document.getElementById(id)) : null;

        modalInfo = initModal('infoModal');
        modalPrint = initModal('printModal');
        modalCrearUser = initModal('modalCrearUsuario');
        modalBorrado = initModal('modalBorrado');
        modal2FA = initModal('modal2FA');
        modalEmpresa = initModal('empresaModal');
        modalConfirm = initModal('confirmModal');
        modalEditarUser = initModal('modalEditarUsuario');
        modalEditarSin = initModal('modalEditarSiniestro');

        // Listeners Formularios
        const asignarSubmit = (id, funcion) => {
            const f = document.getElementById(id);
            if(f) f.addEventListener('submit', funcion);
        };

        asignarSubmit('formCrearUsuario', crearUsuarioNuevo);
        asignarSubmit('formEditarUsuario', guardarEdicionUsuario);
        asignarSubmit('formEditarSiniestro', guardarEdicionSiniestro);

        cargarSeccion('mis-seguros');
    });
}

// =========================================================
// 3. NAVEGACIÓN
// =========================================================
async function cargarSeccion(seccion) {
    const contenedor = document.getElementById('contenido-dinamico');
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    // --- MIS SEGUROS ---
    if (seccion === 'mis-seguros') {
        const titulo = usuario.rol === 'ADMIN' ? 'Gestión Global de Pólizas' : 'Mis Pólizas Contratadas';
        renderizarCargando(contenedor, 'Cargando pólizas...');
        try {
            let endpoint = usuario.rol === 'ADMIN' ? `/seguros` : `/seguros/usuario/${usuario.idUsuario}`;
            const res = await authFetch(endpoint);
            
            if (res && res.ok) {
                renderizarSeguros(await res.json(), contenedor, titulo);
            } else if (usuario.rol === 'ADMIN') {
                 const resB = await authFetch(`/seguros/usuario/${usuario.idUsuario}`);
                 if(resB && resB.ok) renderizarSeguros(await resB.json(), contenedor, titulo);
                 else throw new Error();
            } else { throw new Error(); }
        } catch (e) { mostrarError(contenedor); }

    // --- FACTURAS ---
    } else if (seccion === 'facturas') {
        const titulo = usuario.rol === 'ADMIN' ? 'Control de Facturación' : 'Mis Facturas';
        renderizarCargando(contenedor, 'Cargando facturas...');
        try {
            const endpoint = usuario.rol === 'ADMIN' ? `/facturas` : `/facturas/usuario/${usuario.idUsuario}`;
            const res = await authFetch(endpoint);
            if (res && res.ok) {
                const datos = await res.json();
                listaFacturasGlobal = datos; // GUARDAMOS EN GLOBAL
                renderizarFacturas(datos, contenedor, titulo);
            }
            else mostrarError(contenedor);
        } catch (e) { mostrarError(contenedor); }

    // --- SINIESTROS ---
    } else if (seccion === 'siniestros') {
        renderizarCargando(contenedor, 'Cargando siniestros...');
        try {
            const endpointSin = usuario.rol === 'ADMIN' ? `/siniestros` : `/siniestros/usuario/${usuario.idUsuario}`;
            const resSin = await authFetch(endpointSin);
            if(!resSin) return;
            const listaSiniestros = await resSin.json();
            listaSiniestrosGlobal = listaSiniestros; // GUARDAMOS EN GLOBAL

            const endpointSeg = usuario.rol === 'ADMIN' ? `/seguros` : `/seguros/usuario/${usuario.idUsuario}`;
            const resSeg = await authFetch(endpointSeg);
            const listaSeguros = (resSeg && resSeg.ok) ? await resSeg.json() : [];

            renderizarSiniestros(listaSiniestros, listaSeguros, contenedor);
        } catch (e) { mostrarError(contenedor); }

    // --- USUARIOS (ADMIN) ---
    } else if (seccion === 'usuarios') {
        if (usuario.rol !== 'ADMIN') { contenedor.innerHTML = '<div class="alert alert-danger">Acceso Denegado</div>'; return; }
        renderizarCargando(contenedor, 'Cargando usuarios...');
        try {
            const res = await authFetch(`/usuarios`);
            if(res && res.ok) {
                const datos = await res.json();
                listaUsuariosGlobal = datos; // GUARDAMOS EN GLOBAL
                renderizarUsuarios(datos, contenedor);
            }
            else contenedor.innerHTML = '<div class="alert alert-warning">No se pudo cargar la lista.</div>';
        } catch (e) { mostrarError(contenedor); }

    // --- AÑADIR SEGURO ---
    } else if (seccion === 'anadir-seguro') {
        renderizarCargando(contenedor, 'Cargando formulario...');
        try {
            const resTipos = await authFetch(`/tipos-seguro`);
            const resUsers = await authFetch(`/usuarios`);
            if(resTipos && resTipos.ok && resUsers && resUsers.ok) {
                renderizarFormularioAlta(await resTipos.json(), await resUsers.json(), contenedor);
            }
        } catch (e) { mostrarError(contenedor); }
    
    // --- OTRAS ---
    } else if (seccion === 'perfil') { renderizarPerfil(contenedor);
    } else if (seccion === 'ayuda') { renderizarAyuda(contenedor);
    } else if (seccion === 'config') { renderizarConfiguracion(contenedor);
    } else if (seccion === 'privacidad') { renderizarPrivacidad(contenedor); }
}

// =========================================================
// 4. RENDERIZADORES
// =========================================================

function renderizarSeguros(lista, contenedor, titulo) {
    if (!lista || lista.length === 0) { 
        contenedor.innerHTML = `<h3 class="mb-4">${titulo}</h3><div class="alert alert-info shadow-sm">No hay pólizas registradas.</div>`;
        return; 
    }
    const htmlBuscador = `<div class="row mb-4"><div class="col-md-8"><h3 class="mb-0">${titulo}</h3></div><div class="col-md-4"><div class="input-group shadow-sm"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorSeguros" class="form-control border-start-0" placeholder="Buscar..."></div></div></div>`;
    let htmlLista = '<div class="row" id="listaSeguros">';
    lista.forEach(seguro => {
        let icono = '🛡️';
        const nombreTipo = seguro.tipoSeguro ? seguro.tipoSeguro.nombre : 'Póliza';
        if(nombreTipo.toLowerCase().includes('coche') || nombreTipo.toLowerCase().includes('moto')) icono = '🚗';
        else if(nombreTipo.toLowerCase().includes('hogar')) icono = '🏠';
        else if(nombreTipo.toLowerCase().includes('vida') || nombreTipo.toLowerCase().includes('salud')) icono = '❤️';
        
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
            const t = e.target.value.toLowerCase();
            document.querySelectorAll('.item-seguro').forEach(item => { item.style.display = item.textContent.toLowerCase().includes(t) ? '' : 'none'; });
        });
    }
}

function renderizarUsuarios(lista, contenedor) {
    let botonCrear = '';
    let headerAcciones = '';
    if (usuario.rol === 'ADMIN') {
        botonCrear = `<button class="btn btn-success shadow-sm ms-3" onclick="modalCrearUser.show()"><i class="fa-solid fa-user-plus me-2"></i> Nuevo</button>`;
        headerAcciones = '<th class="text-end pe-4">Acciones</th>';
    }

    const htmlBuscador = `<div class="d-flex justify-content-between align-items-center mb-4"><h3 class="mb-0">Usuarios</h3><div class="d-flex"><div class="input-group shadow-sm" style="width: 250px;"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorUsuarios" class="form-control border-start-0" placeholder="Buscar..."></div>${botonCrear}</div></div>`;
    let htmlLista = `<div class="card border-0 shadow-sm"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th class="ps-4">Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>${headerAcciones}</tr></thead><tbody id="tablaUsuarios">`;
    
    lista.forEach(u => {
        // USO DEL ID PARA EVITAR PROBLEMAS DE COMILLAS
        const idRef = u.idUsuario;
        let colAcciones = '';
        let badgeRol = u.rol === 'ADMIN' ? 'bg-dark' : 'bg-primary';
        let badgeEstado = u.activo ? '<span class="badge bg-success rounded-pill px-3">Activo</span>' : '<span class="badge bg-danger rounded-pill px-3">Inactivo</span>';

        if (usuario.rol === 'ADMIN') {
            if (u.idUsuario !== usuario.idUsuario) {
                colAcciones = `
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick='cargarDatosUsuario(${idRef})' title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="solicitarBorrado_V2('usuarios', ${idRef})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
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
            const t = e.target.value.toLowerCase();
            const filas = document.getElementById('tablaUsuarios').getElementsByTagName('tr');
            for (let fila of filas) fila.style.display = fila.textContent.toLowerCase().includes(t) ? '' : 'none';
        });
    }
}

function renderizarFacturas(lista, contenedor, titulo) {
    const tituloMostrar = titulo || 'Mis Facturas';
    if (!lista || lista.length === 0) { 
        contenedor.innerHTML = `<h3 class="mb-4">${tituloMostrar}</h3><div class="alert alert-info shadow-sm">No hay facturas.</div>`;
        return; 
    }
    const htmlBuscador = `<div class="row mb-4"><div class="col-md-8"><h3 class="mb-0">${tituloMostrar}</h3></div><div class="col-md-4"><div class="input-group shadow-sm"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorFacturas" class="form-control border-start-0" placeholder="Buscar..."></div></div></div>`;
    const thCliente = usuario.rol === 'ADMIN' ? '<th class="ps-3">Cliente</th>' : '';
    let htmlLista = `<div class="card border-0 shadow-sm"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead class="table-light"><tr><th class="ps-4">Concepto</th>${thCliente}<th>Fecha</th><th>Importe</th><th class="text-end pe-4">Acciones</th></tr></thead><tbody id="tablaFacturas">`;
    
    lista.forEach(f => {
        const elId = f.idFactura || f.id; 
        
        let tdCliente = '';
        if (usuario.rol === 'ADMIN') {
            const nombre = (f.usuario) ? f.usuario.nombreCompleto : 'Desconocido';
            tdCliente = `<td class="ps-3"><small class="fw-bold">${nombre}</small></td>`;
        }
      
        let btnBorrar = '';
        if (usuario.rol === 'ADMIN') {
             btnBorrar = `<button class="btn btn-sm btn-outline-danger ms-1" onclick="solicitarBorrado_V2('facturas', ${elId})" title="Eliminar"><i class="fa-solid fa-trash"></i></button>`;
        }
        
        // --- AQUÍ ESTÁ EL CAMBIO CLAVE: SOLO PASAMOS EL ID ---
        htmlLista += `<tr><td class="ps-4 fw-bold">${f.concepto || 'Sin concepto'}</td>${tdCliente}<td>${f.fechaEmision}</td><td class="fw-bold text-primary">${f.importe} €</td><td class="text-end pe-4"><button class="btn btn-sm btn-primary" onclick="prepararFactura(${elId})" title="Imprimir/PDF"><i class="fa-solid fa-print"></i></button>${btnBorrar}</td></tr>`;
    });
    htmlLista += '</tbody></table></div></div>';
    contenedor.innerHTML = htmlBuscador + htmlLista;
    
    if(document.getElementById('buscadorFacturas')){
        document.getElementById('buscadorFacturas').addEventListener('keyup', (e) => {
            const t = e.target.value.toLowerCase();
            const filas = document.getElementById('tablaFacturas').getElementsByTagName('tr');
            for (let fila of filas) fila.style.display = fila.textContent.toLowerCase().includes(t) ? '' : 'none';
        });
    }
}

function renderizarSiniestros(siniestros, seguros, contenedor) {
    const tituloMostrar = 'Gestión de Siniestros';
    let opcionesSeguro = '<option value="" disabled selected>-- Seleccione Seguro --</option>';
    if (seguros.length > 0) {
        seguros.forEach(s => { 
            const extra = (usuario.rol === 'ADMIN' && s.usuario) ? ` (${s.usuario.nombreCompleto})` : '';
            opcionesSeguro += `<option value="${s.idSeguro}">${s.tipoSeguro.nombre} - ${s.numPoliza}${extra}</option>`; 
        });
    } else { opcionesSeguro = '<option disabled>No hay seguros disponibles</option>'; }

    const htmlBuscador = `<div class="mb-3"><div class="input-group shadow-sm"><span class="input-group-text bg-white border-end-0"><i class="fa-solid fa-search text-muted"></i></span><input type="text" id="buscadorSiniestros" class="form-control border-start-0" placeholder="Buscar..."></div></div>`;
    let listaHTML = '';
    if (siniestros.length === 0) { listaHTML = '<div class="alert alert-success">No hay siniestros registrados.</div>';
    } else {
        listaHTML += '<div id="listaSiniestros">';
        siniestros.forEach(s => {
            const elId = s.idSiniestro || s.id;
            let color = s.estado === 'ABIERTO' ? 'warning' : (s.estado === 'RECHAZADO' ? 'danger' : 'success');
            
            let acciones = '';
            let infoCliente = '';
            
            if (usuario.rol === 'ADMIN') {
               const cliente = s.seguro && s.seguro.usuario ? s.seguro.usuario : null;
               if(cliente) infoCliente = `<div class="mb-2 small text-muted border-bottom pb-2"><i class="fa-solid fa-user me-1"></i> <strong>Cliente:</strong> ${cliente.nombreCompleto}</div>`;
               
               // USAMOS ID DIRECTAMENTE
               acciones = `
               <div>
                   <button class="btn btn-sm btn-outline-primary me-1" onclick="cargarDatosSiniestro(${elId})" title="Gestionar"><i class="fa-solid fa-pen-to-square"></i></button>
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
            const t = e.target.value.toLowerCase();
            document.querySelectorAll('.item-siniestro').forEach(item => { item.style.display = item.textContent.toLowerCase().includes(t) ? '' : 'none'; });
        });
    }
    const formSin = document.getElementById('formSiniestro');
    if(formSin) {
        formSin.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await authFetch(`/siniestros`, {
                    method: 'POST', body: JSON.stringify({ descripcion: document.getElementById('sinDesc').value, seguro: { idSeguro: document.getElementById('sinSeguro').value } })
                });
                if (res && res.ok) { mostrarPopup("Siniestro reportado correctamente."); cargarSeccion('siniestros'); }
                else mostrarPopup("Error al reportar.");
            } catch (error) { mostrarPopup("Error conexión."); }
        });
    }
}

// =========================================================
// 5. EDICIÓN
// =========================================================

function cargarDatosUsuario(id) {
    // BUSCAMOS EN LA GLOBAL
    const user = listaUsuariosGlobal.find(u => u.idUsuario == id);
    if (!user) return;

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
        const resGet = await authFetch(`/usuarios/${id}`);
        const userActual = await resGet.json();
        
        const datosFinales = { ...userActual, ...datosEditados };
        const res = await authFetch(`/usuarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(datosFinales)
        });
        if (res.ok) {
            mostrarPopup("Usuario actualizado.");
            modalEditarUser.hide();
            cargarSeccion('usuarios');
        } else { mostrarPopup("Error al actualizar."); }
    } catch (error) { mostrarPopup("Error: " + error.message); }
}

function cargarDatosSiniestro(id) {
    // BUSCAMOS EN LA GLOBAL
    const sin = listaSiniestrosGlobal.find(s => (s.idSiniestro || s.id) == id);
    if (!sin) return;

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
        const resGet = await authFetch(`/siniestros/${id}`);
        const sinActual = await resGet.json();

        const datosEditados = {
            ...sinActual,
            estado: document.getElementById('editSinEstado').value,
            resolucion: document.getElementById('editSinResolucion').value
        };
        const res = await authFetch(`/siniestros/${id}`, {
            method: 'PUT',
            body: JSON.stringify(datosEditados)
        });
        if (res.ok) {
            mostrarPopup("Siniestro actualizado.");
            modalEditarSin.hide();
            cargarSeccion('siniestros');
        } else { mostrarPopup("Error al actualizar."); }

    } catch (error) { mostrarPopup("Error de conexión."); }
}

// =========================================================
// 6. UTILIDADES
// =========================================================

function solicitarBorrado_V2(tipo, id) {
    borrado_V2_Tipo = tipo; borrado_V2_Id = id;
    const input = document.getElementById('inputBorradoConfirm');
    if(input) input.value = "";
    if(modalBorrado) modalBorrado.show();
}
function verificarTextoBorrado_V2() {
    const texto = document.getElementById('inputBorradoConfirm').value;
    const btn = document.getElementById('btnBorrarFinal');
    if(btn) btn.disabled = (texto !== "ELIMINAR");
}
async function ejecutarBorrado_V2() {
    const tipo = borrado_V2_Tipo; const id = borrado_V2_Id;
    const btn = document.getElementById('btnBorrarFinal');
    if(btn) btn.innerHTML = 'Borrando...';
    try {
        const res = await authFetch(`/${tipo}/${id}`, { method: 'DELETE' });
        if (res && res.ok) {
            if(modalBorrado) modalBorrado.hide(); mostrarPopup("Registro eliminado."); cargarSeccion(tipo);
        } else {
            const texto = await res.text();
            if (res.status === 409) mostrarPopup("No se puede eliminar: Tiene datos asociados.");
            else mostrarPopup("Error al eliminar.");
        }
    } catch (error) { alert("Error conexión.");
    } finally { if(btn) { btn.innerHTML = 'Confirmar Eliminación'; btn.disabled = true; } }
}

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
        try { const r = await authFetch(`/seguros`, { method:'POST', body:JSON.stringify(d) }); if(r && r.ok){ mostrarPopup("¡Póliza creada!"); cargarSeccion('mis-seguros'); } else mostrarPopup("Error al guardar."); } catch(e){ mostrarPopup("Error conexión."); }
    });
}

function renderizarConfiguracion(c) {
    let botonHtml = usuario.twoFactorEnabled ?
        `<div class="alert alert-success mb-3 shadow-sm"><i class="fa-solid fa-shield-check me-2"></i>2FA Activado</div><button class="btn btn-outline-danger w-100" onclick="solicitarDesactivar2FA()">Desactivar 2FA</button>` 
        : `<button class="btn btn-primary w-100" onclick="iniciarSetup2FA()">Activar 2FA</button>`;
    c.innerHTML = `<h3 class="mb-4">Configuración</h3><div class="row justify-content-center"><div class="col-md-8"><div class="card shadow border-0"><div class="card-body p-5 text-center"><i class="fa-solid fa-mobile-screen-button text-primary fa-4x mb-4"></i><h4>Seguridad 2FA</h4><div class="mt-2">${botonHtml}</div></div></div></div></div>`;
}
function renderizarPerfil(c) {
    c.innerHTML = `<h3 class="mb-4">Perfil</h3><div class="card p-4 border-0 shadow-sm" style="max-width: 500px"><form id="formPerfil"><div class="mb-3"><label>Nombre</label><input id="pN" class="form-control" value="${usuario.nombreCompleto}"></div><div class="mb-3"><label>Email</label><input class="form-control bg-light" value="${usuario.correo}" disabled></div><div class="mb-3"><label>Móvil</label><input id="pM" class="form-control" value="${usuario.movil||''}"></div><button type="submit" class="btn btn-primary w-100">Guardar</button></form></div>`;
    document.getElementById('formPerfil').addEventListener('submit', async(e)=>{ e.preventDefault(); try { const res = await authFetch(`/usuarios/${usuario.idUsuario}`, { method:'PUT', body:JSON.stringify({...usuario, nombreCompleto:document.getElementById('pN').value, movil:document.getElementById('pM').value})}); if(res && res.ok){ usuario=await res.json(); localStorage.setItem('usuario',JSON.stringify(usuario)); document.getElementById('nombreUsuarioDisplay').textContent=usuario.nombreCompleto; mostrarPopup("Actualizado."); } } catch(e){mostrarPopup("Error.");} });
}

function renderizarAyuda(c) { c.innerHTML = `<h3>Ayuda</h3><p>Contacta con soporte: 900 123 456</p>`; }
function renderizarPrivacidad(c) { c.innerHTML = `<h3>Privacidad</h3><p>Tus datos están protegidos por LEIGSeguros S.L.</p>`; }

async function crearUsuarioNuevo(e) { e.preventDefault(); const d = { nombreCompleto: document.getElementById('newUserName').value, correo: document.getElementById('newUserEmail').value, password: document.getElementById('newUserPass').value, rol: document.getElementById('newUserRol').value, activo: false }; try { const res = await authFetch(`/auth/register`, { method: 'POST', body: JSON.stringify(d) }); if(res && res.ok) { modalCrearUser.hide(); mostrarPopup("Creado."); cargarSeccion('usuarios'); } } catch(err) {} }

// FUNCIÓN DE IMPRESIÓN (CORREGIDA CON ID)
function prepararFactura(id) { 
    // BUSCAMOS EN LA GLOBAL
    const f = listaFacturasGlobal.find(item => (item.idFactura || item.id) == id);
    if (!f) return;

    const idRef = f.idFactura || f.id;
    
    // Contenido HTML de la factura
    const contenido = `
    <div id="facturaImprimible" class="p-5 bg-white border">
        <div class="d-flex justify-content-between mb-4">
            <div><h2 class="fw-bold text-primary">FACTURA</h2><p class="text-muted mb-0">LEIGSeguros S.L.</p></div>
            <div class="text-end"><h5 class="text-dark">Ref: INV-${idRef}</h5><p class="text-muted">${f.fechaEmision}</p></div>
        </div>
        <hr>
        <div class="row mb-5"><div class="col-6"><h6 class="fw-bold">Cliente:</h6><p class="mb-0">${usuario.nombreCompleto}</p><p class="mb-0">${usuario.correo}</p></div></div>
        <table class="table table-bordered"><thead class="table-light"><tr><th>Concepto</th><th class="text-end">Importe</th></tr></thead>
        <tbody><tr><td class="p-3">${f.concepto}</td><td class="text-end p-3 fw-bold">${f.importe} €</td></tr></tbody>
        <tfoot><tr class="table-secondary"><th class="text-end">TOTAL</th><th class="text-end fs-4">${f.importe} €</th></tr></tfoot></table>
    </div>`;
    
    // Inyectar en el modal
    const area = document.getElementById('areaImpresion');
    if(area) area.innerHTML = contenido;
    
    // Botones del footer
    const modalElem = document.getElementById('printModal');
    const footer = modalElem.querySelector('.modal-footer');
    if(footer) {
        footer.innerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            <button type="button" class="btn btn-primary" onclick="window.print()">Imprimir</button>
            <button type="button" class="btn btn-success" onclick="descargarPDF(${idRef})">Descargar PDF</button>
        `;
    }
    
    modalPrint.show(); 
}

function descargarPDF(id) { 
    const element = document.getElementById('facturaImprimible');
    if(!element || typeof html2pdf === 'undefined') { alert("Error PDF. Librería no cargada."); return; }
    html2pdf().set({ margin: 10, filename: `Factura_${id}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save();
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


        <h5 class="fw-bold mt-4"><i class="fa-solid fa-building-shield me-2 text-primary"></i>1.
        Responsable del Tratamiento</h5>
        <p class="text-justify text-muted"><strong>LEIGSeguros S.L.</strong>, con domicilio en Calle Mayor 123, Madrid, España, es la responsable del tratamiento de sus datos personales.
        Puede contactar con nuestro Delegado de Protección de Datos (DPO) en <strong>aseguradoraleig@gmail.com</strong>.</p>


        <h5 class="fw-bold mt-4"><i class="fa-solid fa-file-contract me-2 text-primary"></i>2.
        Finalidad del Tratamiento</h5>
        <p class="text-justify text-muted">Sus datos personales serán utilizados exclusivamente para las siguientes finalidades:
            <ul class="text-muted">
                <li>Gestión y administración de las pólizas de seguro contratadas.</li>
                <li>Emisión de facturas y gestión de cobros.</li>
                <li>Gestión de siniestros y
                asistencia técnica.</li>
                <li>Envío de comunicaciones relacionadas con el servicio (renovaciones, avisos importantes).</li>
            </ul>
        </p>


        <h5 class="fw-bold mt-4"><i class="fa-solid fa-scale-balanced me-2 text-primary"></i>3.
        Legitimación</h5>
        <p class="text-justify text-muted">La base legal para el tratamiento de sus datos es la <strong>ejecución del contrato</strong> de seguro del que usted es parte.</p>


        <h5 class="fw-bold mt-4"><i class="fa-solid fa-user-lock me-2 text-primary"></i>4.
        Destinatarios</h5>
        <p class="text-justify text-muted">Sus datos no serán cedidos a terceros, salvo obligación legal (Agencia Tributaria, Jueces y Tribunales) o proveedores de servicios necesarios para la prestación del servicio (servicios de hosting, pasarelas de pago), siempre bajo estrictos contratos de confidencialidad.</p>


        <h5 class="fw-bold mt-4"><i class="fa-solid fa-hand-holding-heart me-2 text-primary"></i>5.
        Derechos del Usuario (ARCO)</h5>
        <p class="text-justify text-muted">Como titular de los datos, usted tiene derecho a:
            <ul class="text-muted">
                <li><strong>Acceder</strong> a sus datos personales.</li>
                <li>Solicitar la <strong>rectificación</strong> de los datos inexactos.</li>
                <li>Solicitar su <strong>supresión</strong> cuando, entre otros motivos, los
                datos ya no sean necesarios para los fines que fueron recogidos.</li>
                <li>Oponerse al tratamiento de sus datos.</li>
            </ul>
            Puede ejercer estos derechos enviando una solicitud por escrito a nuestra dirección de contacto.
        </p>
        <hr class="my-5">
        <div class="text-center text-muted small"><p class="mb-1"><strong>©
        ${year} LEIGSeguros S.L.</strong> Todos los derechos reservados.</p>
        <p>Inscrita en el Registro Mercantil de Madrid, Tomo 1234, Folio 56, Hoja M-12345.</p></div>
    </div></div>`;
}


function solicitarDesactivar2FA() {
    const btn = document.getElementById('btnConfirmarBorrado');
    const modalEl = document.getElementById('confirmModal');
    modalEl.querySelector('.modal-header').className = 'modal-header bg-warning';
    modalEl.querySelector('.modal-title').textContent = "Desactivar 2FA";
    modalEl.querySelector('.modal-body p.fw-bold').textContent = "¿Seguro que quieres quitar la seguridad?";
    btn.className = "btn btn-warning";
    btn.textContent = "Desactivar";
    btn.onclick = async () => {
        modalConfirm.hide();
        await authFetch(`/auth/disable-2fa`, { method: 'POST', body: JSON.stringify({correo: usuario.correo}) });
        usuario.twoFactorEnabled = false; localStorage.setItem('usuario', JSON.stringify(usuario));
        renderizarConfiguracion(document.getElementById('contenido-dinamico'));
    };
    modalConfirm.show();
}
async function iniciarSetup2FA() { const res = await authFetch(`/auth/setup-2fa`, {method:'POST', body:JSON.stringify({correo:usuario.correo})}); if(res && res.ok){ const d=await res.json(); document.getElementById('qrContainer').innerHTML=""; new QRCode(document.getElementById('qrContainer'), d.qrUrl); modal2FA.show(); } }
async function confirmarActivacion2FA() { const c = document.getElementById('inputCodeConfirm').value; const res = await authFetch(`/auth/confirm-2fa`, {method:'POST', body:JSON.stringify({correo:usuario.correo, codigo:c})}); if(res && res.ok){ modal2FA.hide(); usuario.twoFactorEnabled=true; localStorage.setItem('usuario', JSON.stringify(usuario)); renderizarConfiguracion(document.getElementById('contenido-dinamico')); } }

function renderizarCargando(c, t) { c.innerHTML = `<div class="text-center mt-5"><div class="spinner-border text-primary"></div><p>${t}</p></div>`; }
function mostrarError(c) { c.innerHTML = '<div class="alert alert-danger">Error de conexión.</div>'; }
function mostrarPopup(msg) { const m = document.getElementById('modalMensaje'); if(m) m.innerText = msg; if(modalInfo) modalInfo.show(); }
function logout() { localStorage.clear(); window.location.href = 'index.html'; }