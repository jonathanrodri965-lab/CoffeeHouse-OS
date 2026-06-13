// 1. Cargamos las librerías que acabamos de instalar con npm
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');

const app = express();
const PUERTO = 5000;

// 2. Configuramos los permisos de seguridad y lectura de datos
app.use(cors({ origin: 'http://localhost:5000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Servir el frontend estático desde /.vscode para que la UI se cargue desde el mismo origen
app.use(express.static(path.join(__dirname, '..', '.vscode')));

// Inicializar Firebase Admin si existe la credencial
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.join(__dirname, 'firebase-service-account.json');
let firestore = null;

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firestore = admin.firestore();
    console.log('Firebase Admin inicializado con Firestore.');
} else {
    console.warn('Advertencia: no se encontró firebase-service-account.json. Firestore no estará disponible.');
}

// JWT secret (development only). En producción usar variable de entorno segura.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-coffeehouse-2026';
const JWT_EXPIRES_IN = '2h';

// Middleware opcional: si hay cookie con token, la valida y asigna req.user, pero no bloquea rutas públicas
app.use((req, res, next) => {
    const token = req.cookies && req.cookies.token;
    if (!token) return next();
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
    } catch (err) {
        // token inválido: lo ignoramos y la ruta puede decidir bloquear si es necesaria
        req.user = null;
    }
    next();
});

// 3. BASE DE DATOS EN MEMORIA (Es exactamente la misma de tu archivo HTML)
const CATALOGO = [
    { id: 'prod_cafe', name: 'Capuchino Mediano', price: 4500, recipe: { cafe: 18, leche: 200, azucar: 10 }, category: 'Calientes' },
    { id: 'prod_maca', name: 'Macchiato Premium', price: 5200, recipe: { cafe: 22, leche: 150, azucar: 5 }, category: 'Calientes' },
    { id: 'prod_tinto', name: 'Café Tinto Negro', price: 2200, recipe: { cafe: 15, leche: 0, azucar: 15 }, category: 'Calientes' },
    { id: 'prod_frap', name: 'Frapuccino de Caramelo', price: 7500, recipe: { cafe: 18, leche: 250, azucar: 30 }, category: 'Fríos' },
    { id: 'prod_croi', name: 'Muffin de Chocolate', price: 3800, recipe: { cafe: 0, leche: 0, azucar: 25 }, category: 'Pastelería' },
    { id: 'prod_tort', name: 'Tarta de Queso y Frutos', price: 6000, recipe: { cafe: 0, leche: 50, azucar: 40 }, category: 'Pastelería' }
];

// Estado inicial del sistema (Nevera, Bodega, Comandas y Dinero)
let inventarioYFinanzas = {
    inventory: { cafe: 300, leche: 2500, azucar: 500 },
    inventoryLimits: { cafe: 100, leche: 800, azucar: 150 },
    orders: [],   // Comandas para el barista
    mermas: [],   // Registro de pérdidas
    financials: { totalSales: 0, totalCount: 0 },
    popularProducts: {} // Estadísticas
};

const FIRESTORE_COLLECTION = 'coffeehouse_state';
const FIRESTORE_DOC = 'main';

async function loadStateFromFirestore() {
    if (!firestore) return;
    try {
        const snapshot = await firestore.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).get();
        if (snapshot.exists) {
            inventarioYFinanzas = snapshot.data();
            console.log('Estado cargado desde Firestore.');
        } else {
            await saveStateToFirestore();
            console.log('Documento Firestore creado con estado inicial.');
        }
    } catch (err) {
        console.error('Error cargando estado desde Firestore:', err);
    }
}

async function saveStateToFirestore() {
    if (!firestore) return;
    try {
        await firestore.collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC).set(inventarioYFinanzas);
    } catch (err) {
        console.error('Error guardando estado en Firestore:', err);
    }
}

// Base de datos de usuarios (inicial en memoria, migrable a Firestore)
let USERS_DATABASE = [
    { email: "gerente@coffeehouse.co", password: "admin2026", role: "gerente", name: "Gerente General" },
    { email: "cajero@coffeehouse.co", password: "caja123", role: "cajero", name: "Cajero de Turno" },
    { email: "barista@coffeehouse.co", password: "cafe123", role: "barista", name: "Barista Profesional" }
];

// Persistencia de usuarios en Firestore
async function saveUsersToFirestore() {
    if (!firestore) return;
    try {
        const usersCol = firestore.collection('users');
        const batch = firestore.batch();
        USERS_DATABASE.forEach(u => {
            const ref = usersCol.doc(u.email);
            batch.set(ref, { email: u.email, password: u.password, role: u.role, name: u.name });
        });
        await batch.commit();
    } catch (err) {
        console.error('Error guardando usuarios en Firestore:', err);
    }
}

async function loadUsersFromFirestore() {
    if (!firestore) return;
    try {
        const snapshot = await firestore.collection('users').get();
        const loaded = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            loaded.push({ email: d.email, password: d.password, role: d.role, name: d.name });
        });
        if (loaded.length > 0) {
            USERS_DATABASE = loaded;
            console.log('Usuarios cargados desde Firestore.');
            // Migrar contraseñas en claro a bcrypt si es necesario
            let migrated = false;
            for (let u of USERS_DATABASE) {
                if (u.password && typeof u.password === 'string' && !u.password.startsWith('$2')) {
                    try {
                        const h = await bcrypt.hash(u.password, 10);
                        u.password = h;
                        migrated = true;
                    } catch (err) {
                        console.error('Error hasheando password de usuario', u.email, err);
                    }
                }
            }
            if (migrated) {
                await saveUsersToFirestore();
                console.log('Usuarios migrados a contraseñas hasheadas en Firestore.');
            }
        } else {
            // Si no hay usuarios en Firestore, crear los iniciales
            await saveUsersToFirestore();
            console.log('Documento usuarios creado en Firestore con valores iniciales.');
        }
    } catch (err) {
        console.error('Error cargando usuarios desde Firestore:', err);
    }
}

// Genera y firma un JWT
function signToken(user) {
    return jwt.sign({ email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Middleware que valida JWT desde cookie
function authenticateMiddleware(req, res, next) {
    const token = req.cookies && req.cookies.token;
    if (!token) return res.status(401).json({ success: false, message: 'No autenticado' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token inválido' });
    }
}

// Ruta de autenticación (emite cookie HttpOnly con JWT)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Faltan credenciales' });

    const user = USERS_DATABASE.find(u => u.email === email.toLowerCase());
    if (!user) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });

    try {
        let passwordMatches = false;
        // Si la contraseña almacenada parece un hash bcrypt, usamos compare
        if (typeof user.password === 'string' && user.password.startsWith('$2')) {
            passwordMatches = await bcrypt.compare(password, user.password);
        } else {
            // Contraseña en claro (legacy). Comparamos y, si coincide, migramos a hash.
            passwordMatches = (password === user.password);
            if (passwordMatches) {
                const newHash = await bcrypt.hash(password, 10);
                user.password = newHash;
                // Persistir migración
                await saveUsersToFirestore();
            }
        }

        if (!passwordMatches) return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });

        const token = signToken(user);
        const isSecure = req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https');
        res.cookie('token', token, { httpOnly: true, secure: !!isSecure, sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 });
        res.json({ success: true, user: { email: user.email, role: user.role, name: user.name } });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ success: false, message: 'Error interno' });
    }
});

// Ruta de logout (limpia la cookie)
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Sesión cerrada' });
});

// Rutas de administración de usuarios (solo gerente)
app.get('/api/admin/users', authenticateMiddleware, async (req, res) => {
    if (!req.user || req.user.role !== 'gerente') return res.status(403).json({ success: false, message: 'No autorizado' });
    const list = USERS_DATABASE.map(u => ({ email: u.email, role: u.role, name: u.name }));
    res.json({ success: true, users: list });
});

app.post('/api/admin/users', authenticateMiddleware, async (req, res) => {
    if (!req.user || req.user.role !== 'gerente') return res.status(403).json({ success: false, message: 'No autorizado' });
    const { email, password, role, name } = req.body;
    if (!email || !password || !role || !name) return res.status(400).json({ success: false, message: 'Faltan campos' });
    const exists = USERS_DATABASE.find(u => u.email === email.toLowerCase());
    if (exists) return res.status(400).json({ success: false, message: 'Usuario ya existe' });
    // Hashear la contraseña antes de guardar
    const hashed = await bcrypt.hash(password, 10);
    const user = { email: email.toLowerCase(), password: hashed, role, name };
    USERS_DATABASE.push(user);
    await saveUsersToFirestore();
    res.json({ success: true, user: { email: user.email, role: user.role, name: user.name } });
});

app.put('/api/admin/users/:email', authenticateMiddleware, async (req, res) => {
    if (!req.user || req.user.role !== 'gerente') return res.status(403).json({ success: false, message: 'No autorizado' });
    const email = req.params.email.toLowerCase();
    const { password, role, name } = req.body;
    if (!role || !name) return res.status(400).json({ success: false, message: 'Faltan campos para actualizar' });

    const userIndex = USERS_DATABASE.findIndex(u => u.email === email);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    if (password) {
        const hashed = await bcrypt.hash(password, 10);
        USERS_DATABASE[userIndex].password = hashed;
    }
    USERS_DATABASE[userIndex].role = role;
    USERS_DATABASE[userIndex].name = name;
    await saveUsersToFirestore();
    res.json({ success: true, user: { email: USERS_DATABASE[userIndex].email, role: role, name: name } });
});

app.delete('/api/admin/users/:email', authenticateMiddleware, async (req, res) => {
    if (!req.user || req.user.role !== 'gerente') return res.status(403).json({ success: false, message: 'No autorizado' });
    const email = req.params.email.toLowerCase();
    if (req.user.email === email) return res.status(400).json({ success: false, message: 'No puedes eliminar tu propio usuario' });

    const userIndex = USERS_DATABASE.findIndex(u => u.email === email);
    if (userIndex === -1) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    USERS_DATABASE.splice(userIndex, 1);
    await saveUsersToFirestore();
    res.json({ success: true, message: 'Usuario eliminado' });
});

// ==================== LAS RUTAS DE COMUNICACIÓN ====================

// Ruta 1: Mandar el estado de la cafetería cuando el frontend lo pida
app.get('/api/estado', (req, res) => {
    res.json({
        catalog: CATALOGO,
        inventory: inventarioYFinanzas.inventory,
        inventoryLimits: inventarioYFinanzas.inventoryLimits,
        orders: inventarioYFinanzas.orders,
        mermas: inventarioYFinanzas.mermas,
        financials: inventarioYFinanzas.financials,
        popularProducts: inventarioYFinanzas.popularProducts
    });
});

// Ruta 2: Recibir una orden de compra del cajero y procesarla
app.post('/api/ventas/checkout', authenticateMiddleware, async (req, res) => {
    // Proteger: solo cajero o gerente (authenticateMiddleware garantiza req.user)
    if (req.user.role !== 'cajero' && req.user.role !== 'gerente') {
        return res.status(403).json({ success: false, message: 'No autorizado para realizar cobros' });
    }
    const { cart } = req.body;

    if (!cart || cart.length === 0) {
        return res.status(400).json({ success: false, message: "El carrito está vacío" });
    }

    // Calcular insumos necesarios sumando las recetas
    let needed = { cafe: 0, leche: 0, azucar: 0 };
    cart.forEach(item => {
        needed.cafe += (item.product.recipe.cafe * item.quantity);
        needed.leche += (item.product.recipe.leche * item.quantity);
        needed.azucar += (item.product.recipe.azucar * item.quantity);
    });

    // Validar stock (Homeostasis)
    if (inventarioYFinanzas.inventory.cafe < needed.cafe || 
        inventarioYFinanzas.inventory.leche < needed.leche || 
        inventarioYFinanzas.inventory.azucar < needed.azucar) {
        return res.status(400).json({ success: false, message: "¡CRÍTICO: Inventario insuficiente en la cocina!" });
    }

    // Descontar del inventario del servidor
    inventarioYFinanzas.inventory.cafe -= needed.cafe;
    inventarioYFinanzas.inventory.leche -= needed.leche;
    inventarioYFinanzas.inventory.azucar -= needed.azucar;

    // Calcular dinero con IVA (19%)
    let totalOrder = 0;
    cart.forEach(item => {
        totalOrder += (item.product.price * item.quantity) * 1.19;
        inventarioYFinanzas.popularProducts[item.product.name] = (inventarioYFinanzas.popularProducts[item.product.name] || 0) + item.quantity;
    });

    inventarioYFinanzas.financials.totalSales += totalOrder;
    inventarioYFinanzas.financials.totalCount += cart.reduce((acc, item) => acc + item.quantity, 0);

    // Crear la comanda oficial para el barista
    const newOrder = {
        id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: cart.map(item => ({
            name: item.product.name,
            quantity: item.quantity,
            notes: item.product.recipe.leche > 0 ? "Leche deslactosada" : "Sin notas"
        }))
    };
    
    inventarioYFinanzas.orders.push(newOrder);
    await saveStateToFirestore();
    res.json({ success: true, message: "Venta procesada con éxito", orderId: newOrder.id });
});

// Ruta 3: Registrar merma (derrames)
app.post('/api/barista/merma', authenticateMiddleware, async (req, res) => {
    // Proteger: solo barista o gerente
    if (req.user.role !== 'barista' && req.user.role !== 'gerente') {
        return res.status(403).json({ success: false, message: 'No autorizado para registrar mermas' });
    }
    const { item, qty, dbKey, reason } = req.body;

    if (inventarioYFinanzas.inventory[dbKey] < qty) {
        return res.status(400).json({ success: false, message: "No queda stock para registrar esta merma" });
    }

    inventarioYFinanzas.inventory[dbKey] -= qty;
    inventarioYFinanzas.mermas.unshift({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        item,
        qty: `${qty} ${dbKey === 'leche' ? 'ml' : 'g'}`,
        reason
    });

    await saveStateToFirestore();
    res.json({ success: true, message: "Merma guardada en el servidor" });
});

// Ruta 4: Reabastecer stock
app.post('/api/admin/restock', authenticateMiddleware, async (req, res) => {
    // Proteger: solo gerente
    if (req.user.role !== 'gerente') {
        return res.status(403).json({ success: false, message: 'No autorizado para reabastecer' });
    }
    inventarioYFinanzas.inventory = { cafe: 300, leche: 2500, azucar: 500 };
    await saveStateToFirestore();
    res.json({ success: true, message: "Bodega reabastecida centralmente" });
});

// Ruta 5: Completar orden por el barista
app.post('/api/barista/completar', authenticateMiddleware, async (req, res) => {
    // Proteger: solo barista o gerente
    if (req.user.role !== 'barista' && req.user.role !== 'gerente') {
        return res.status(403).json({ success: false, message: 'No autorizado para completar pedidos' });
    }
    const { orderId } = req.body;
    inventarioYFinanzas.orders = inventarioYFinanzas.orders.filter(o => o.id !== orderId);
    await saveStateToFirestore();
    res.json({ success: true, message: `Pedido ${orderId} despachado` });
});


// 4. Encendemos el motor para que escuche peticiones en el puerto 5000
app.listen(PUERTO, async () => {
    console.log("=================================================");
    console.log(` ☕ CoffeeHouse OS - Servidor Backend Activo ☕ `);
    console.log(` Escuchando exitosamente en: http://localhost:5000`);
    console.log("=================================================");

    if (firestore) {
        await loadStateFromFirestore();
        await loadUsersFromFirestore();
    }
});