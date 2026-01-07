// =========================================================
// 1. CONFIGURACIÓN Y VARIABLES GLOBALES
// =========================================================
const API_URL = 'http://localhost:8081/api';
const usuarioGuardado = sessionStorage.getItem('usuario');
let usuario = null;

// Variables para los Modales (Popups)
let modalInfo, modalConfirm, modalEmpresa, modalPrint;
let itemABorrar = { tipo: '', id: 0 };

// =========================================================
// 2. INICIALIZACIÓN
// =========================================================
if (!usuarioGuardado) {
    window.location.href = 'index.html';
} else {
    usuario = JSON.parse(usuarioGuardado);
    document.addEventListener('DOMContentLoaded', () => {
        // Poner nombre en el menú lateral
        const nombreDisplay = document.getElementById('nombreUsuarioDisplay');
        if(nombreDisplay) nombreDisplay.textContent = usuario.nombreCompleto;
        
        // Inicializar Modales de Bootstrap
        modalInfo = new bootstrap.Modal(document.getElementById('infoModal'));
        modalConfirm = new bootstrap.Modal(document.getElementById('confirmModal'));
        modalEmpresa = new bootstrap.Modal(document.getElementById('empresaModal'));
        modalPrint = new bootstrap.Modal(document.getElementById('printModal'));

        // Listener del botón rojo "Sí, Eliminar" del popup
        const btnBorrar = document.getElementById('btnConfirmarBorrado');
        if(btnBorrar) {
            btnBorrar.addEventListener('click', ejecutarBorrado);
        }
        
        // Cargar la primera sección por defecto
        cargarSeccion('mis-seguros');
    });
}

// =========================================================
// 3. NAVEGACIÓN CENTRAL (ROUTER)
// =========================================================
async function cargarSeccion(seccion) {
    const contenedor = document.getElementById('contenido-dinamico');
    // Quitar clase 'active' de todos los links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    // --- MIS SEGUROS ---
    if (seccion === 'mis-seguros') {
        renderizarCargando(contenedor, 'Cargando tus pólizas...');
        try {
            const res = await fetch(`${API_URL}/seguros/usuario/${usuario.idUsuario}`);
            const seguros = await res.json();
            renderizarSeguros(seguros, contenedor);
        } catch (e) { mostrarError(contenedor); }

    // --- FACTURAS ---
    } else if (seccion === 'facturas') {
        renderizarCargando(contenedor, 'Cargando facturas...');
        try {
            const res = await fetch(`${API_URL}/facturas/usuario/${usuario.idUsuario}`);
            const facturas = await res.json();
            renderizarFacturas(facturas, contenedor);
        } catch (e) { mostrarError(contenedor); }

    // --- SINIESTROS ---
    } else if (seccion === 'siniestros') {
        renderizarCargando(contenedor, 'Cargando gestión de siniestros...');
        try {
            const resSin = await fetch(`${API_URL}/siniestros/usuario/${usuario.idUsuario}`);
            const listaSiniestros = await resSin.json();
            
            const resSeg = await fetch(`${API_URL}/seguros/usuario/${usuario.idUsuario}`);
            const listaSeguros = await resSeg.json();

            renderizarSiniestros(listaSiniestros, listaSeguros, contenedor);
        } catch (e) { mostrarError(contenedor); }

    // --- AÑADIR SEGURO ---
    } else if (seccion === 'anadir-seguro') {
        renderizarCargando(contenedor, 'Cargando tipos...');
        try {
            const res = await fetch(`${API_URL}/tipos-seguro`);
            const tipos = await res.json();
            renderizarFormularioAlta(tipos, contenedor);
        } catch (e) { mostrarError(contenedor); }
    
    // --- PERFIL ---
    } else if (seccion === 'perfil') {
        renderizarPerfil(contenedor);
    
    // --- AYUDA ---
    } else if (seccion === 'ayuda') {
        renderizarAyuda(contenedor);
    
    // --- CONFIGURACIÓN ---
    } else if (seccion === 'config') {
        renderizarConfiguracion(contenedor);

    // --- PRIVACIDAD ---
    } else if (seccion === 'privacidad') {
        renderizarPrivacidad(contenedor);
    }
}

// =========================================================
// 4. RENDERIZADORES (VISTAS)
// =========================================================

// --- VISTA SEGUROS ---
function renderizarSeguros(lista, contenedor) {
    if (lista.length === 0) { contenedor.innerHTML = '<div class="alert alert-info shadow-sm">No tienes seguros contratados.</div>'; return; }
    
    let html = '<h3 class="mb-4">Mis Pólizas Activas</h3><div class="row">';
    lista.forEach(seguro => {
        let icono = '🛡️';
        const n = seguro.tipoSeguro.nombre.toLowerCase();
        if(n.includes('coche')) icono = '🚗';
        else if(n.includes('moto')) icono = '🏍️';
        else if(n.includes('hogar')) icono = '🏠';
        else if(n.includes('vida') || n.includes('salud')) icono = '❤️';

        html += `
        <div class="col-md-6 mb-4">
            <div class="card h-100 shadow-sm border-0">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="fw-bold mb-0 text-primary">${icono} ${seguro.tipoSeguro.nombre}</h5>
                        <span class="badge bg-success">ACTIVO</span>
                    </div>
                    <p class="text-muted small"><strong>PÓLIZA:</strong> ${seguro.numPoliza}</p>
                    <p class="bg-light p-2 rounded small border">${seguro.datosEspecificos}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <span class="fw-bold fs-5">${seguro.primaAnual} €/año</span>
                        <button class="btn btn-outline-danger btn-sm" onclick="solicitarBorrado('seguros', ${seguro.idSeguro})">
                            <i class="fa-solid fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    contenedor.innerHTML = html;
}

// --- VISTA FACTURAS ---
function renderizarFacturas(lista, contenedor) {
    if (lista.length === 0) { contenedor.innerHTML = '<div class="alert alert-info shadow-sm">No tienes facturas.</div>'; return; }
    
    let html = `
    <h3 class="mb-4">Mis Facturas</h3>
    <div class="card border-0 shadow-sm"><div class="table-responsive"><table class="table table-hover align-middle mb-0">
    <thead class="table-light"><tr><th class="ps-4">Concepto</th><th>Fecha</th><th>Importe</th><th class="text-end pe-4">Acciones</th></tr></thead><tbody>`;
    lista.forEach(f => {
        const jsonF = JSON.stringify(f).replace(/"/g, '&quot;');
        html += `
        <tr>
            <td class="ps-4 fw-bold">${f.concepto}</td>
            <td>${f.fechaEmision}</td>
            <td class="fw-bold">${f.importe} €</td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-primary me-1" onclick="prepararFactura(${jsonF})"><i class="fa-solid fa-print"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="solicitarBorrado('facturas', ${f.idFactura})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    });
    html += '</tbody></table></div></div>';
    contenedor.innerHTML = html;
}

// --- VISTA SINIESTROS ---
function renderizarSiniestros(siniestros, seguros, contenedor) {
    let opcionesSeguro = '<option value="" disabled selected>-- Seleccione Seguro --</option>';
    if (seguros.length > 0) {
        seguros.forEach(s => opcionesSeguro += `<option value="${s.idSeguro}">${s.tipoSeguro.nombre} - ${s.numPoliza}</option>`);
    } else {
        opcionesSeguro = '<option disabled>No tienes seguros contratados</option>';
    }

    let listaHTML = '';
    if (siniestros.length === 0) {
        listaHTML = '<div class="alert alert-success">No tienes siniestros reportados.</div>';
    } else {
        siniestros.forEach(s => {
            let color = s.estado === 'ABIERTO' ? 'warning' : 'success';
            listaHTML += `
            <div class="card mb-3 border-${color} border-start border-3 shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-0">Póliza: ${s.seguro ? s.seguro.numPoliza : '???'}</h6>
                            <span class="badge bg-${color} mt-1">${s.estado}</span>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" onclick="solicitarBorrado('siniestros', ${s.idSiniestro})" title="Eliminar Siniestro">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <hr class="my-2">
                    <p class="mb-1 small text-muted"><i class="fa-solid fa-calendar-day me-1"></i> ${s.fechaSuceso}</p>
                    <p class="mb-2 text-dark">${s.descripcion}</p>
                    <div class="bg-light p-2 rounded small fst-italic border"><i class="fa-solid fa-user-shield me-1"></i> Resolución: ${s.resolucion}</div>
                </div>
            </div>`;
        });
    }

    contenedor.innerHTML = `
    <h3 class="mb-4">Gestión de Siniestros</h3>
    <div class="row">
        <div class="col-md-5 mb-4">
            <div class="card shadow border-0">
                <div class="card-header bg-danger text-white fw-bold"><i class="fa-solid fa-triangle-exclamation me-2"></i> Reportar Incidencia</div>
                <div class="card-body">
                    <form id="formSiniestro">
                        <div class="mb-3"><label class="fw-bold">Seguro</label><select id="sinSeguro" class="form-select" required>${opcionesSeguro}</select></div>
                        <div class="mb-3"><label class="fw-bold">Descripción</label><textarea id="sinDesc" class="form-control" rows="4" required placeholder="Describe lo ocurrido..."></textarea></div>
                        <div class="d-grid"><button type="submit" class="btn btn-danger">Enviar Parte</button></div>
                    </form>
                </div>
            </div>
        </div>
        <div class="col-md-7"><h5 class="text-muted">Historial</h5><div style="max-height: 500px; overflow-y: auto;">${listaHTML}</div></div>
    </div>`;

    document.getElementById('formSiniestro').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/siniestros`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descripcion: document.getElementById('sinDesc').value, seguro: { idSeguro: document.getElementById('sinSeguro').value } })
            });
            if (res.ok) { mostrarPopup("Siniestro reportado."); cargarSeccion('siniestros'); }
            else mostrarPopup("Error al reportar.");
        } catch (error) { mostrarPopup("Error conexión."); }
    });
}

// --- VISTA FORMULARIO ALTA SEGURO ---
function renderizarFormularioAlta(tipos, contenedor) {
    let opts = `<option value="" disabled selected>-- Seleccione Tipo --</option>`;
    tipos.forEach(t => opts += `<option value="${t.idTipo}">${t.nombre} (${t.precioBase}€)</option>`);
    const poliza = 'POL-' + Math.floor(Math.random()*99999);
    contenedor.innerHTML = `
    <h3 class="mb-4">Contratar Nuevo Seguro</h3>
    <div class="card shadow-sm border-0" style="max-width: 700px;"><div class="card-body p-4">
    <form id="formAlta">
        <div class="row mb-3"><div class="col"><label class="fw-bold">Tipo</label><select id="idTipo" class="form-select" required>${opts}</select></div>
        <div class="col"><label class="fw-bold">Póliza</label><input id="numPoliza" class="form-control bg-light" value="${poliza}" readonly></div></div>
        <div class="row mb-3"><div class="col"><label>Inicio</label><input type="date" id="fInicio" class="form-control" required></div>
        <div class="col"><label>Renovación</label><input type="date" id="fRenov" class="form-control" required></div></div>
        <div class="mb-3"><label class="fw-bold">Detalles</label><textarea id="detalles" class="form-control" required></textarea></div>
        <div class="mb-3"><label class="fw-bold">Precio (€)</label><input type="number" id="precio" class="form-control" required></div>
        <button type="submit" class="btn btn-primary w-100">Contratar</button>
    </form></div></div>`;
    
    const iIni = document.getElementById('fInicio');
    const iRen = document.getElementById('fRenov');
    if(iIni && iRen) {
        iIni.addEventListener('change', () => {
            if (iIni.value) {
                const d = new Date(iIni.value); d.setFullYear(d.getFullYear() + 1);
                iRen.value = d.toISOString().split('T')[0];
            }
        });
    }

    document.getElementById('formAlta').addEventListener('submit', async (e) => {
        e.preventDefault();
        const d = { numPoliza: document.getElementById('numPoliza').value, fechaInicio: document.getElementById('fInicio').value, fechaRenovacion: document.getElementById('fRenov').value, primaAnual: parseFloat(document.getElementById('precio').value), datosEspecificos: document.getElementById('detalles').value, estado: "ACTIVO", usuario: { idUsuario: usuario.idUsuario }, tipoSeguro: { idTipo: document.getElementById('idTipo').value } };
        try { const r = await fetch(`${API_URL}/seguros`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d)}); if(r.ok){ mostrarPopup("¡Contratado! Factura generada."); cargarSeccion('mis-seguros'); } else mostrarPopup("Error al guardar."); } catch(e){ mostrarPopup("Error conexión."); }
    });
}

// --- VISTA CONFIGURACIÓN ---
function renderizarConfiguracion(contenedor) {
    contenedor.innerHTML = `
    <h3 class="mb-4">Configuración</h3>
    <div class="row"><div class="col-md-6 mb-4"><div class="card shadow-sm border-0 h-100"><div class="card-header bg-white fw-bold"><i class="fa-solid fa-lock text-warning me-2"></i>Seguridad</div><div class="card-body">
    <form id="formCambiarPass">
        <div class="mb-3"><label class="text-muted small">Contraseña Actual</label><input type="password" id="oldPass" class="form-control" required></div>
        <div class="mb-3"><label class="text-muted small">Nueva Contraseña</label><input type="password" id="newPass" class="form-control" required></div>
        <button type="submit" class="btn btn-warning w-100 fw-bold">Actualizar</button>
    </form></div></div></div>
    <div class="col-md-6 mb-4"><div class="card shadow-sm border-0 h-100"><div class="card-header bg-white fw-bold"><i class="fa-solid fa-sliders text-primary me-2"></i>Preferencias</div><div class="card-body">
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox" checked><label>Notificaciones Email</label></div>
        <div class="form-check form-switch mb-3"><input class="form-check-input" type="checkbox"><label>Notificaciones SMS</label></div>
        <hr><button class="btn btn-primary w-100" onclick="mostrarPopup('Preferencias guardadas.')">Guardar</button>
    </div></div></div></div>`;

    document.getElementById('formCambiarPass').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/usuarios/${usuario.idUsuario}/cambiar-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword: document.getElementById('oldPass').value, newPassword: document.getElementById('newPass').value }) });
            if (res.ok) { mostrarPopup("Contraseña actualizada."); e.target.reset(); }
            else { const t = await res.text(); mostrarPopup("Error: " + t); }
        } catch (error) { mostrarPopup("Error conexión."); }
    });
}

// --- VISTA PERFIL ---
function renderizarPerfil(c) {
    c.innerHTML = `<h3 class="mb-4">Mi Perfil</h3><div class="card shadow-sm border-0" style="max-width:600px;"><div class="card-body p-4"><form id="formPerfil">
    <div class="mb-3"><label class="fw-bold">Nombre</label><input type="text" id="pN" class="form-control" value="${usuario.nombreCompleto}"></div>
    <div class="mb-3"><label class="fw-bold">Email</label><input type="text" class="form-control bg-light" value="${usuario.correo}" disabled></div>
    <div class="mb-3"><label class="fw-bold">Móvil</label><input type="text" id="pM" class="form-control" value="${usuario.movil||''}"></div>
    <button type="submit" class="btn btn-primary w-100">Guardar Cambios</button>
    </form></div></div>`;
    document.getElementById('formPerfil').addEventListener('submit', async(e)=>{
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/usuarios/${usuario.idUsuario}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...usuario, nombreCompleto:document.getElementById('pN').value, movil:document.getElementById('pM').value})});
            if(res.ok){ usuario=await res.json(); sessionStorage.setItem('usuario',JSON.stringify(usuario)); document.getElementById('nombreUsuarioDisplay').textContent=usuario.nombreCompleto; mostrarPopup("Perfil actualizado."); }
        } catch(e){mostrarPopup("Error.");}
    });
}

// --- VISTA AYUDA ---
function renderizarAyuda(contenedor) {
    contenedor.innerHTML = `
    <h3 class="mb-4">Centro de Ayuda y Soporte</h3>
    <div class="row">
        <div class="col-md-6 mb-4">
            <div class="card shadow-sm border-0 h-100">
                <div class="card-body">
                    <h5 class="fw-bold text-primary mb-3">Envíanos tu consulta</h5>
                    <form id="formAyuda">
                        <div class="mb-3">
                            <label class="form-label">Asunto</label>
                            <select class="form-select" required><option>Duda Póliza</option><option>Problema Factura</option><option>Otro</option></select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Mensaje</label>
                            <textarea class="form-control" rows="4" required placeholder="Describe tu consulta..."></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary w-100">Enviar</button>
                    </form>
                </div>
            </div>
        </div>
        <div class="col-md-6 mb-4">
            <div class="card bg-light border-0 h-100">
                <div class="card-body">
                    <h5><i class="fa-solid fa-circle-question me-2"></i>Preguntas Frecuentes</h5>
                    <div class="accordion mt-3" id="faqAcc">
                        <div class="accordion-item mb-2 border-0 shadow-sm">
                            <h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q1">No puedo borrar un seguro</button></h2>
                            <div id="q1" class="accordion-collapse collapse" data-bs-parent="#faqAcc">
                                <div class="accordion-body text-muted small">Debes cancelar primero la factura asociada antes de eliminar el seguro, por motivos de seguridad fiscal.</div>
                            </div>
                        </div>
                        <div class="accordion-item mb-2 border-0 shadow-sm">
                            <h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q2">¿Cómo descargar facturas?</button></h2>
                            <div id="q2" class="accordion-collapse collapse" data-bs-parent="#faqAcc">
                                <div class="accordion-body text-muted small">Ve a la sección Facturas y pulsa el botón azul.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.getElementById('formAyuda').addEventListener('submit', (e) => {
        e.preventDefault();
        mostrarPopup("Mensaje enviado. Contactaremos contigo pronto.");
        e.target.reset();
    });
}

// --- VISTA PRIVACIDAD ---
function renderizarPrivacidad(contenedor) {
    const year = new Date().getFullYear();
    contenedor.innerHTML = `
    <h3 class="mb-4">Política de Privacidad y Aviso Legal</h3>
    <div class="card shadow-sm border-0">
        <div class="card-body p-5">
            <div class="text-center mb-5">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style="width: 60px; height: 60px; font-weight: bold; font-size: 24px;">A</div>
                <h2 class="fw-bold text-dark">Aseguradora App</h2>
                <p class="text-muted">Comprometidos con la transparencia y tu seguridad.</p>
            </div>

            <h5 class="fw-bold mt-4"><i class="fa-solid fa-building-shield me-2 text-primary"></i>1. Responsable del Tratamiento</h5>
            <p class="text-justify text-muted">
                <strong>Aseguradora App S.L.</strong>, con domicilio en Calle Mayor 123, Madrid, España, es la responsable del tratamiento de sus datos personales. Puede contactar con nuestro Delegado de Protección de Datos (DPO) en <strong>dpo@aseguradora.com</strong>.
            </p>

            <h5 class="fw-bold mt-4"><i class="fa-solid fa-file-contract me-2 text-primary"></i>2. Finalidad del Tratamiento</h5>
            <p class="text-justify text-muted">
                Sus datos personales serán utilizados exclusivamente para las siguientes finalidades:
                <ul class="text-muted">
                    <li>Gestión y administración de las pólizas de seguro contratadas.</li>
                    <li>Emisión de facturas y gestión de cobros.</li>
                    <li>Gestión de siniestros y asistencia técnica.</li>
                    <li>Envío de comunicaciones relacionadas con el servicio (renovaciones, avisos importantes).</li>
                </ul>
            </p>

            <h5 class="fw-bold mt-4"><i class="fa-solid fa-scale-balanced me-2 text-primary"></i>3. Legitimación</h5>
            <p class="text-justify text-muted">
                La base legal para el tratamiento de sus datos es la <strong>ejecución del contrato</strong> de seguro del que usted es parte.
            </p>

            <h5 class="fw-bold mt-4"><i class="fa-solid fa-user-lock me-2 text-primary"></i>4. Destinatarios</h5>
            <p class="text-justify text-muted">
                Sus datos no serán cedidos a terceros, salvo obligación legal (Agencia Tributaria, Jueces y Tribunales) o proveedores de servicios necesarios para la prestación del servicio (servicios de hosting, pasarelas de pago), siempre bajo estrictos contratos de confidencialidad.
            </p>

            <h5 class="fw-bold mt-4"><i class="fa-solid fa-hand-holding-heart me-2 text-primary"></i>5. Derechos del Usuario (ARCO)</h5>
            <p class="text-justify text-muted">
                Como titular de los datos, usted tiene derecho a:
                <ul class="text-muted">
                    <li><strong>Acceder</strong> a sus datos personales.</li>
                    <li>Solicitar la <strong>rectificación</strong> de los datos inexactos.</li>
                    <li>Solicitar su <strong>supresión</strong> cuando, entre otros motivos, los datos ya no sean necesarios para los fines que fueron recogidos.</li>
                    <li>Oponerse al tratamiento de sus datos.</li>
                </ul>
                Puede ejercer estos derechos enviando una solicitud por escrito a nuestra dirección de contacto.
            </p>

            <hr class="my-5">

            <div class="text-center text-muted small">
                <p class="mb-1"><strong>&copy; ${year} Aseguradora App S.L.</strong> Todos los derechos reservados.</p>
                <p>Inscrita en el Registro Mercantil de Madrid, Tomo 1234, Folio 56, Hoja M-12345.</p>
                <div class="mt-3">
                    <a href="#" class="text-decoration-none me-3">Términos de Uso</a> |
                    <a href="#" class="text-decoration-none mx-3">Política de Cookies</a> | 
                    <a href="#" class="text-decoration-none ms-3">Aviso Legal</a>
                </div>
            </div>
        </div>
    </div>`;
}

// =========================================================
// 5. FUNCIONES DE SISTEMA (BORRAR, IMPRIMIR)
// =========================================================

function solicitarBorrado(tipo, id) {
    itemABorrar = { tipo, id };
    modalConfirm.show();
}

async function ejecutarBorrado() {
    modalConfirm.hide();
    try {
        const res = await fetch(`${API_URL}/${itemABorrar.tipo}/${itemABorrar.id}`, { method: 'DELETE' });
        
        if (res.ok) {
            mostrarPopup("Eliminado correctamente.");
            // Refrescar la lista correcta
            if (itemABorrar.tipo === 'seguros') cargarSeccion('mis-seguros');
            else if (itemABorrar.tipo === 'facturas') cargarSeccion('facturas');
            else if (itemABorrar.tipo === 'siniestros') cargarSeccion('siniestros');
        } else {
            // MENSAJE MEJORADO
            if (itemABorrar.tipo === 'seguros') {
                mostrarPopup("⚠️ No se puede eliminar: Este seguro tiene facturas o siniestros asociados. Elimina primero el historial.");
            } else {
                mostrarPopup("Error al eliminar.");
            }
        }
    } catch (e) { mostrarPopup("Error de conexión."); }
}

// --- FUNCIÓN 1: MODIFICADA PARA MOSTRAR BOTONES DE PDF ---
function prepararFactura(factura) {
    const contenidoFactura = `
        <div id="facturaImprimible" class="p-5 bg-white border">
            <div class="d-flex justify-content-between mb-4">
                <div>
                    <h2 class="fw-bold text-primary">FACTURA</h2>
                    <p class="text-muted mb-0">Aseguradora App S.L.</p>
                </div>
                <div class="text-end">
                    <h5 class="text-dark">Ref: INV-${factura.idFactura}</h5>
                    <p class="text-muted">${factura.fechaEmision}</p>
                </div>
            </div>
            <hr>
            <div class="row mb-5">
                <div class="col-6">
                    <h6 class="fw-bold">Cliente:</h6>
                    <p class="mb-0">${usuario.nombreCompleto}</p>
                    <p class="mb-0">${usuario.correo}</p>
                </div>
            </div>
            <table class="table table-bordered">
                <thead class="table-light">
                    <tr><th>Concepto</th><th class="text-end">Importe</th></tr>
                </thead>
                <tbody>
                    <tr><td class="p-3">${factura.concepto}</td><td class="text-end p-3 fw-bold">${factura.importe} €</td></tr>
                </tbody>
                <tfoot>
                    <tr class="table-secondary"><th class="text-end">TOTAL</th><th class="text-end fs-4">${factura.importe} €</th></tr>
                </tfoot>
            </table>
        </div>`;

    document.getElementById('areaImpresion').innerHTML = contenidoFactura;

    // AQUÍ ESTABA EL FALLO: Ahora el botón llama a 'descargarPDF'
    const footerModal = document.getElementById('printModal').querySelector('.modal-footer');
    footerModal.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
        <button type="button" class="btn btn-primary" onclick="window.print()"><i class="fa-solid fa-print"></i> Imprimir</button>
        <button type="button" class="btn btn-success" onclick="descargarPDF(${factura.idFactura})"><i class="fa-solid fa-file-pdf"></i> Descargar PDF</button>
    `;

    modalPrint.show();
}

// =========================================================
// FUNCIÓN PARA DESCARGAR PDF
// =========================================================
function descargarPDF(id) {
    console.log("Iniciando descarga para factura:", id);

    // 1. Buscamos la factura
    const elemento = document.getElementById('facturaImprimible');
    
    if (!elemento) {
        alert("Error: No se encuentra la factura.");
        return;
    }

    // 2. Comprobamos la librería
    if (typeof html2pdf === 'undefined') {
        alert("Error: Librería html2pdf no cargada en index.html");
        return;
    }

    // 3. Configuración y descarga
    const opciones = {
        margin:       10,
        filename:     `Factura_${id}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opciones).from(elemento).save();
}

// --- FUNCIÓN 3: IMPRIMIR (Nueva) ---
function accionImprimir() {
    const contenido = document.getElementById('areaImpresion').innerHTML;
    const ventana = window.open('', '', 'height=600,width=800');
    ventana.document.write('<html><head><title>Imprimir</title>');
    // Cargamos bootstrap también en la impresión para que no salga feo
    ventana.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">');
    ventana.document.write('</head><body>');
    ventana.document.write(contenido);
    ventana.document.write('</body></html>');
    ventana.document.close();
    setTimeout(() => { ventana.print(); ventana.close(); }, 500);
}

// --- EXTRAS: RECUPERAR CONTRASEÑA ---
async function recuperarContrasena() {
    const correoInput = prompt("Introduce tu correo para restablecer la contraseña:");
    if (correoInput) {
        document.body.style.cursor = 'wait';
        await new Promise(r => setTimeout(r, 1000)); // Simula espera
        document.body.style.cursor = 'default';
        alert(`✅ Enlace enviado a: ${correoInput}\nRevisa tu correo.`);
    }
}

function renderizarCargando(c, t) { c.innerHTML = `<div class="text-center mt-5"><div class="spinner-border text-primary"></div><p>${t}</p></div>`; }
function mostrarError(c) { c.innerHTML = '<div class="alert alert-danger">Error de conexión con el servidor.</div>'; }
function mostrarPopup(msg) { document.getElementById('modalMensaje').textContent = msg; modalInfo.show(); }
function abrirModalEmpresa() { modalEmpresa.show(); }
function logout() { sessionStorage.removeItem('usuario'); window.location.href = 'index.html'; }