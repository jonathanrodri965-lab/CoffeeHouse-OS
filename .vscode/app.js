// ---- 1. BASE DE DATOS LOCAL PROVISIONAL ----
// Cuando integremos el Backend, estos datos se traerán usando fetch()
const CATALOG = [
    { id: 'prod_cafe', name: 'Capuchino Mediano', price: 4500, recipe: { cafe: 18, leche: 200, azucar: 10 }, category: 'Calientes' },
    { id: 'prod_maca', name: 'Macchiato Premium', price: 5200, recipe: { cafe: 22, leche: 150, azucar: 5 }, category: 'Calientes' },
    { id: 'prod_tinto', name: 'Café Tinto Negro', price: 2200, recipe: { cafe: 15, leche: 0, azucar: 15 }, category: 'Calientes' },
    { id: 'prod_frap', name: 'Frapuccino de Caramelo', price: 7500, recipe: { cafe: 18, leche: 250, azucar: 30 }, category: 'Fríos' },
    { id: 'prod_croi', name: 'Muffin de Chocolate', price: 3800, recipe: { cafe: 0, leche: 0, azucar: 25 }, category: 'Pastelería' },
    { id: 'prod_tort', name: 'Tarta de Queso y Frutos', price: 6000, recipe: { cafe: 0, leche: 50, azucar: 40 }, category: 'Pastelería' }
];

let state = {
    inventory: { cafe: 300, leche: 2500, azucar: 500 },
    inventoryLimits: { cafe: 100, leche: 800, azucar: 150 },
    cart: [],
    orders: [], 
    mermas: [], 
    sales: [],  
    financials: { totalSales: 0, totalCount: 0 },
    currentUser: null
};

// NUEVA FUNCIÓN: Trae los datos reales del backend
async function cargarEstadoDesdeServidor() {
    try {
        const respuesta = await fetch('/api/estado', { credentials: 'include' });
        const datos = await respuesta.json();
        
        // Sincronizamos el estado local con lo que tiene el servidor
        state.inventory = datos.inventory;
        state.inventoryLimits = datos.inventoryLimits;
        state.orders = datos.orders;
        state.mermas = datos.mermas;
        state.financials = datos.financials;
        
        // Actualizamos lo que ve el usuario en pantalla
        updateAllViews();
    } catch (error) {
        console.error("Error conectando con el backend:", error);
        showToast("⚠️ Error: No se pudo conectar con el servidor Backend");
    }
}

function ensureServerOrigin() {
    if (window.location.protocol === 'file:') {
        const redirectUrl = 'http://localhost:5000/';
        showToast('⚠️ Redirigiendo al servidor local...');
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// Al cargar la ventana, inicializar componentes y cargar datos desde backend
window.onload = function() {
    renderCatalog();
    if (ensureServerOrigin()) {
        cargarEstadoDesdeServidor();
    }
}

// ---- 2. NAVEGACIÓN ENTRE PANTALLAS ----
function switchScreen(screenId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('screen-' + screenId).classList.add('active');

    document.querySelectorAll('#simulator-controls button').forEach(btn => {
        if(btn.getAttribute('data-screen') === screenId) {
            btn.classList.remove('bg-coffee-800', 'text-white');
            btn.classList.add('bg-amber-500', 'text-coffee-900');
        } else {
            btn.classList.remove('bg-amber-500', 'text-coffee-900');
            btn.classList.add('bg-coffee-800', 'text-white');
        }
    });
}

// ---- 3. LOGICA DE SEGURIDAD MEDIANTE ROLES Y CREDENCIALES (HU-01) ----
        
        // Base de datos quemada del personal para la sustentación
        const USERS_DATABASE = [
            { email: "gerente@coffeehouse.co", password: "admin2026", role: "gerente", name: "Gerente General" },
            { email: "cajero@coffeehouse.co", password: "caja123", role: "cajero", name: "Cajero de Turno" },
            { email: "barista@coffeehouse.co", password: "cafe123", role: "barista", name: "Barista Profesional" }
        ];

        async function processLogin() {
            const emailInput = document.getElementById('login-email').value.trim().toLowerCase();
            const passwordInput = document.getElementById('login-password').value;
            const feedback = document.getElementById('login-feedback');
            
            feedback.classList.add('hidden');

            if (!ensureServerOrigin()) {
                feedback.innerText = "⚠️ Abre la aplicación desde http://localhost:5000/ o desde el túnel HTTPS en lugar de un archivo local.";
                feedback.classList.remove('hidden');
                return;
            }

            if (!emailInput || !passwordInput) {
                feedback.innerText = "❌ Error: Por favor diligencie todos los campos requeridos.";
                feedback.classList.remove('hidden');
                return;
            }

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailInput, password: passwordInput })
                });

                const data = await response.json();

                if (!response.ok) {
                    feedback.innerText = data.message || 'Credenciales incorrectas';
                    feedback.classList.remove('hidden');
                    return;
                }

                const user = data.user;
                state.currentUser = user.role;
                showToast(`¡Sesión correcta! Bienvenido: ${user.name}`);

                document.getElementById('nav-logout').classList.remove('hidden');
                document.getElementById('nav-pos').classList.add('hidden');
                document.getElementById('nav-barista').classList.add('hidden');
                document.getElementById('nav-admin').classList.add('hidden');

                if (user.role === 'cajero') {
                    document.getElementById('nav-pos').classList.remove('hidden');
                    switchScreen('pos');
                } else if (user.role === 'barista') {
                    document.getElementById('nav-barista').classList.remove('hidden');
                    switchScreen('barista');
                } else if (user.role === 'gerente') {
                    document.getElementById('nav-pos').classList.remove('hidden');
                    document.getElementById('nav-barista').classList.remove('hidden');
                    document.getElementById('nav-admin').classList.remove('hidden');
                    switchScreen('admin');
                }

                document.getElementById('login-email').value = "";
                document.getElementById('login-password').value = "";
                await cargarEstadoDesdeServidor();
            } catch (error) {
                console.error('Error al iniciar sesión:', error);
                feedback.innerText = '⚠️ Error de conexión al servidor de autenticación';
                feedback.classList.remove('hidden');
            }
        }

        // Función para cerrar sesión de manera segura y restaurar el estado oculto del sistema
        async function logout() {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (err) {
                console.error('Error durante logout:', err);
            }

            state.currentUser = null;
            document.getElementById('nav-pos').classList.add('hidden');
            document.getElementById('nav-barista').classList.add('hidden');
            document.getElementById('nav-admin').classList.add('hidden');
            document.getElementById('nav-logout').classList.add('hidden');
            
            showToast("Sesión finalizada. Volviendo al Login.");
            switchScreen('login');
        }

// ---- 4. CAJA POS (HU-02) ----
function renderCatalog() {
    const container = document.getElementById('products-catalog');
    container.innerHTML = '';
    
    CATALOG.forEach(p => {
        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between";
        card.onclick = () => addToCart(p.id);
        card.innerHTML = `
            <div>
                <span class="text-[10px] uppercase font-bold text-coffee-600 bg-coffee-50 px-2 py-0.5 rounded-full">${p.category}</span>
                <h4 class="font-bold text-stone-800 mt-1">${p.name}</h4>
            </div>
            <div class="flex justify-between items-center mt-4 pt-2 border-t border-stone-100">
                <span class="font-black text-coffee-800">$${p.price.toLocaleString()}</span>
                <span class="bg-coffee-700 hover:bg-coffee-800 text-white rounded-lg p-1.5 text-xs transition">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                </span>
            </div>
        `;
        container.appendChild(card);
    });
}

function addToCart(prodId) {
    const product = CATALOG.find(p => p.id === prodId);
    const cartItem = state.cart.find(item => item.product.id === prodId);
    if (cartItem) { cartItem.quantity++; } else { state.cart.push({ product, quantity: 1 }); }
    showToast(`Agregado: ${product.name}`);
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const emptyMsg = document.getElementById('cart-empty-msg');
    container.querySelectorAll('.cart-item-row').forEach(el => el.remove());
    
    if (state.cart.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        state.cart.forEach(item => {
            const row = document.createElement('div');
            row.className = "cart-item-row flex justify-between items-center bg-stone-50 p-2.5 rounded-lg border border-stone-150 text-sm";
            row.innerHTML = `
                <div class="flex-grow">
                    <h5 class="font-semibold text-stone-800">${item.product.name}</h5>
                    <span class="text-xs text-stone-500">$${item.product.price} c/u</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changeQuantity('${item.product.id}', -1, event)" class="bg-stone-200 text-stone-800 px-2 py-0.5 rounded text-xs font-bold">-</button>
                    <span class="font-bold">${item.quantity}</span>
                    <button onclick="changeQuantity('${item.product.id}', 1, event)" class="bg-stone-200 text-stone-800 px-2 py-0.5 rounded text-xs font-bold">+</button>
                </div>
            `;
            container.appendChild(row);
        });
    }

    let subtotal = 0;
    state.cart.forEach(item => subtotal += (item.product.price * item.quantity));
    const tax = subtotal * 0.19;
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').innerText = `$${subtotal.toLocaleString()}`;
    document.getElementById('cart-tax').innerText = `$${tax.toLocaleString()}`;
    document.getElementById('cart-total').innerText = `$${total.toLocaleString()}`;
}

function changeQuantity(prodId, delta, event) {
    event.stopPropagation();
    const item = state.cart.find(i => i.product.id === prodId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart = state.cart.filter(i => i.product.id !== prodId);
    updateCartUI();
}

function clearCart() {
    state.cart = [];
    updateCartUI();
    showToast("Carrito vaciado");
}

async function checkoutOrder() {
    if (state.cart.length === 0) {
        showToast("Error: No hay productos en la orden");
        return;
    }

    try {
        // Le enviamos el carrito al Backend para que haga los cálculos matemáticos
        const respuesta = await fetch('/api/ventas/checkout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: state.cart })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            showToast(`❌ ${resultado.message || 'Error en el servidor al procesar la venta'}`);
            return;
        }

        if (resultado.success) {
            state.cart = []; // Limpiamos el carrito local
            updateCartUI();
            
            // Refrescamos toda la pantalla con los nuevos datos calculados por el servidor
            await cargarEstadoDesdeServidor(); 
            showToast(`¡Pago procesado! Comanda ${resultado.orderId} registrada en el servidor.`);
        } else {
            // Si el servidor detectó que no había inventario (Homeostasis), nos avisa aquí
            showToast(`❌ ${resultado.message}`);
            switchScreen('admin');
        }
    } catch (error) {
        console.error('Error checkout:', error);
        showToast("⚠️ Error de conexión al procesar la venta");
    }
}

// ---- 5. MONITOR BARISTA (HU-03) ----
function renderBaristaOrders() {
    const container = document.getElementById('barista-orders-container');
    const emptyMsg = document.getElementById('barista-empty-msg');
    container.innerHTML = '';

    document.getElementById('barista-badge').innerText = state.orders.length;

    if (state.orders.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        state.orders.forEach(order => {
            const card = document.createElement('div');
            card.className = "bg-white rounded-xl border-l-4 border-amber-600 shadow-md p-4 space-y-3 flex flex-col justify-between";
            let itemsHtml = order.items.map(i => `
                <div class="flex justify-between border-b border-stone-100 py-1.5">
                    <span class="font-bold text-stone-800">${i.quantity}x ${i.name}</span>
                    <span class="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded">${i.notes}</span>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="space-y-2">
                    <div class="flex justify-between items-center text-xs text-stone-500 font-bold border-b border-stone-100 pb-2">
                        <span>${order.id}</span>
                        <span class="bg-stone-100 px-2 py-0.5 rounded text-coffee-800">${order.time}</span>
                    </div>
                    <div class="space-y-1">${itemsHtml}</div>
                </div>
                <button onclick="completeOrder('${order.id}')" class="w-full bg-coffee-700 hover:bg-coffee-800 text-white font-bold py-2 rounded-lg text-xs mt-4 transition">
                    Marcar como Servido
                </button>
            `;
            container.appendChild(card);
        });
    }
}

async function completeOrder(orderId) {
    try {
        const respuesta = await fetch('/api/barista/completar', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderId })
        });
        
        const resultado = await respuesta.json();
        if (resultado.success) {
            await cargarEstadoDesdeServidor();
            showToast(`Pedido ${orderId} removido del servidor`);
        } else {
            showToast(`❌ ${resultado.message || 'No se pudo completar el pedido'}`);
        }
    } catch (error) {
        showToast("⚠️ Error al actualizar pedido en el servidor");
    }
}

function simulateLoss() {
    (async () => {
        const items = ['Leche', 'Café en Grano', 'Azúcar'];
        const chosenItem = items[Math.floor(Math.random() * items.length)];
        let lossQty = 0, dbKey = '';

        if (chosenItem === 'Leche') { lossQty = 250; dbKey = 'leche'; }
        if (chosenItem === 'Café en Grano') { lossQty = 50; dbKey = 'cafe'; }
        if (chosenItem === 'Azúcar') { lossQty = 100; dbKey = 'azucar'; }

        try {
            const resp = await fetch('/api/barista/merma', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ item: chosenItem, qty: lossQty, dbKey, reason: 'Derrame accidental en barra' })
            });
            const data = await resp.json();
            if (!resp.ok) {
                showToast(data.message || 'No se pudo registrar la merma');
                return;
            }
            await cargarEstadoDesdeServidor();
            showToast(`Merma registrada: -${lossQty} de ${chosenItem}`);
        } catch (err) {
            console.error('Error registrando merma:', err);
            showToast('⚠️ Error: No se pudo conectar al servidor para registrar merma');
        }
    })();
}

// ---- 6. GERENCIA (HU-04) ----
function renderAdminDashboard() {
    const invContainer = document.getElementById('inventory-list');
    invContainer.innerHTML = '';
    let hasCritical = false;

    const units = { cafe: 'g', leche: 'ml', azucar: 'g' };
    const names = { cafe: 'Café en Grano', leche: 'Leche Deslactosada', azucar: 'Azúcar Refinada' };

    for (let [key, val] of Object.entries(state.inventory)) {
        const limit = state.inventoryLimits[key];
        const isLow = val <= limit;
        if (isLow) hasCritical = true;
        const pct = Math.min((val / (limit * 3)) * 100, 100);

        const itemRow = document.createElement('div');
        itemRow.className = "space-y-1.5";
        itemRow.innerHTML = `
            <div class="flex justify-between text-sm">
                <span class="font-bold text-stone-700">${names[key]}</span>
                <span class="${isLow ? 'text-red-600 font-extrabold animate-pulse' : 'text-stone-600 font-semibold'}">${val} / ${limit * 3} ${units[key]}</span>
            </div>
            <div class="w-full bg-stone-100 rounded-full h-3 border border-stone-200">
                <div class="${isLow ? 'bg-red-500' : 'bg-coffee-600'} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
            </div>
        `;
        invContainer.appendChild(itemRow);
    }

    const alertsContainer = document.getElementById('admin-alerts');
    const alertBadge = document.getElementById('alert-badge');
    alertsContainer.innerHTML = '';

    if (hasCritical) {
        alertBadge.classList.remove('hidden');
        const alertCard = document.createElement('div');
        alertCard.className = "bg-red-50 border-l-4 border-red-500 rounded-xl p-4 flex justify-between items-center gap-3";
        alertCard.innerHTML = `
            <div>
                <h4 class="font-black text-red-800 text-sm">Alerta de Insumos</h4>
                <p class="text-xs text-red-600">Stock por debajo del mínimo.</p>
            </div>
            <button onclick="openPurchaseModal()" class="bg-red-600 text-white font-bold py-1 px-2 rounded text-xs">Generar Orden</button>
        `;
        alertsContainer.appendChild(alertCard);
    } else {
        alertBadge.classList.add('hidden');
    }

    // Mermas e Historial Financiero
    document.getElementById('admin-total-sales').innerText = `$${state.financials.totalSales.toLocaleString()}`;
    document.getElementById('admin-total-count').innerText = state.financials.totalCount;
    // Cargar usuarios para la vista de administración (no bloqueante)
    try { fetchAdminUsers(); } catch (e) { console.error('No se pudo cargar usuarios al renderizar admin:', e); }
}

// ---- Usuarios (Administración) ----
async function fetchAdminUsers() {
    try {
        const resp = await fetch('/api/admin/users', { credentials: 'include' });
        const data = await resp.json();
        if (!resp.ok) {
            document.getElementById('users-list').innerHTML = `<p class="text-xs text-red-600">${data.message || 'No autorizado'}</p>`;
            return;
        }
        renderUsers(data.users || []);
    } catch (err) {
        console.error('Error cargando usuarios:', err);
        document.getElementById('users-list').innerHTML = `<p class="text-xs text-red-600">Error conectando al servidor</p>`;
    }
}

function renderUsers(users) {
    const container = document.getElementById('users-list');
    if (!users || users.length === 0) {
        container.innerHTML = `<p class="text-xs text-stone-500">No hay usuarios registrados.</p>`;
        return;
    }
    container.innerHTML = '';
    users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center p-3 border border-stone-100 rounded gap-3';

        const info = document.createElement('div');
        info.innerHTML = `
            <div class="font-semibold">${u.name}</div>
            <div class="text-xs text-stone-500">${u.email} • <span class="uppercase font-bold text-[11px]">${u.role}</span></div>
        `;

        const actions = document.createElement('div');
        actions.className = 'flex gap-2';

        const editBtn = document.createElement('button');
        editBtn.className = 'text-blue-600 hover:text-blue-800 text-xs font-bold';
        editBtn.innerText = 'Editar';
        editBtn.onclick = () => openUserModal(u);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-red-600 hover:text-red-800 text-xs font-bold';
        deleteBtn.innerText = 'Borrar';
        deleteBtn.onclick = () => deleteUser(u.email);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        row.appendChild(info);
        row.appendChild(actions);
        container.appendChild(row);
    });
}

function openUserModal(user = null) {
    const title = document.getElementById('user-modal-title');
    const email = document.getElementById('user-email');
    const password = document.getElementById('user-password');
    const name = document.getElementById('user-name');
    const role = document.getElementById('user-role');
    const originalEmail = document.getElementById('user-original-email');
    const saveButton = document.getElementById('save-user-button');

    if (user) {
        title.innerText = 'Editar Usuario';
        saveButton.innerText = 'Actualizar';
        email.value = user.email;
        email.disabled = true;
        password.value = '';
        name.value = user.name;
        role.value = user.role;
        originalEmail.value = user.email;
    } else {
        title.innerText = 'Crear Nuevo Usuario';
        saveButton.innerText = 'Crear';
        email.disabled = false;
        email.value = '';
        password.value = '';
        name.value = '';
        role.value = 'cajero';
        originalEmail.value = '';
    }

    document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

async function saveUser() {
    const email = document.getElementById('user-email').value.trim().toLowerCase();
    const originalEmail = document.getElementById('user-original-email').value.trim().toLowerCase();
    const password = document.getElementById('user-password').value;
    const name = document.getElementById('user-name').value.trim();
    const role = document.getElementById('user-role').value;

    if (!email || !name || !role) { showToast('Rellena todos los campos excepto contraseña si no se cambia'); return; }

    try {
        const payload = { name, role };
        if (password) payload.password = password;

        let resp;
        if (originalEmail) {
            resp = await fetch(`/api/admin/users/${encodeURIComponent(originalEmail)}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            if (!password) { showToast('La contraseña es obligatoria al crear un usuario'); return; }
            resp = await fetch('/api/admin/users', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, role, name })
            });
        }

        const data = await resp.json();
        if (!resp.ok) {
            showToast(data.message || 'No se pudo guardar el usuario');
            return;
        }

        closeUserModal();
        await fetchAdminUsers();
        showToast(originalEmail ? 'Usuario actualizado' : 'Usuario creado correctamente');
    } catch (err) {
        console.error('Error guardando usuario:', err);
        showToast('⚠️ Error al guardar usuario');
    }
}

async function deleteUser(email) {
    if (!confirm(`¿Eliminar al usuario ${email}? Esta acción no se puede deshacer.`)) return;

    try {
        const resp = await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        const data = await resp.json();
        if (!resp.ok) {
            showToast(data.message || 'No se pudo borrar el usuario');
            return;
        }
        await fetchAdminUsers();
        showToast('Usuario eliminado');
    } catch (err) {
        console.error('Error borrando usuario:', err);
        showToast('⚠️ Error al borrar usuario');
    }
}

function restockAll() {
    (async () => {
        try {
            const resp = await fetch('/api/admin/restock', { method: 'POST', credentials: 'include' });
            const data = await resp.json();
            if (!resp.ok) {
                showToast(data.message || 'No autorizado para reabastecer');
                return;
            }
            await cargarEstadoDesdeServidor();
            showToast(data.message || 'Bodega reabastecida');
        } catch (err) {
            console.error('Error reabasteciendo:', err);
            showToast('⚠️ Error: No se pudo conectar al servidor para reabastecer');
        }
    })();
}

// ---- 7. AUXILIARES ----
function updateAllViews() {
    renderBaristaOrders();
    renderAdminDashboard();
}

function showToast(text) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-text').innerText = text;
    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 2500);
}

function openPurchaseModal() {
    document.getElementById('export-modal').classList.remove('hidden');
    document.getElementById('modal-doc-preview').innerText = `ORDEN SUGERIDA AUTOMÁTICA\nGenerado por: Jonathan David Rodriguez Guzman`;
}

function closeModal() { document.getElementById('export-modal').classList.add('hidden'); }
function triggerPrintSim() { showToast("Orden descargada."); closeModal(); }