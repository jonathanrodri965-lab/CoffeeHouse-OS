CoffeeHouse-OS

📱 **Acceso Público (Túnel HTTPS):**
```
http://127.0.0.1:5000/
```

Instrucciones rápidas para desarrollo local:

1) Backend

```bash
cd Backend
npm install
npm start
```

El servidor escucha en http://localhost:5000

Endpoints relevantes:
- GET /api/estado
- POST /api/auth/login { email, password } -> emite cookie HttpOnly
- POST /api/auth/logout
- POST /api/ventas/checkout (cajero/gerente)
- POST /api/barista/merma (barista/gerente)
- POST /api/barista/completar (barista/gerente)
- POST /api/admin/restock (gerente)

2) Frontend

El frontend se sirve desde el backend para que las cookies HttpOnly funcionen correctamente.

**Opción A (Localhost):**
Después de `npm start` abre:
```
http://localhost:5000/
```

**Opción B (Público - Túnel HTTPS):**
Accede a:
```
(http://127.0.0.1:5000/)
```
(Requiere que el backend y túnel estén corriendo)

3) Tests de integración

Desde la carpeta `Backend` puedes ejecutar:

```bash
npm run test:integration
```

Notas de seguridad:
- Este repositorio usa una base de usuarios en memoria para demostración. Mueve la autenticación a un sistema real y usa HTTPS en producción.
