(async () => {
  const base = 'http://localhost:5000';
  function log(...a){ console.log(...a) }

  async function login(email, password){
    const res = await fetch(base + '/api/auth/login', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, password })
    });
    const txt = await res.text();
    let json; try{ json = JSON.parse(txt); } catch(e){ json = { raw: txt }; }
    const sc = res.headers.get('set-cookie') || '';
    const cookie = sc.split(';')[0] || '';
    return { ok: res.ok, status: res.status, body: json, cookie };
  }

  async function post(path, body, cookie){
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json().catch(()=>null);
    return { ok: res.ok, status: res.status, body: data };
  }

  try {
    log('1) Login cajero');
    const caj = await login('cajero@coffeehouse.co','caja123');
    log(' ->', caj.status, caj.body);
    if (!caj.ok) throw new Error('Login cajero falló');

    log('2) Checkout como cajero');
    const checkout = await post('/api/ventas/checkout', { cart: [ { product: { id: 'prod_tinto', name: 'Café Tinto Negro', price: 2200, recipe: { cafe:15, leche:0, azucar:15 }, category: 'Calientes' }, quantity: 1 } ] }, caj.cookie);
    log(' ->', checkout.status, checkout.body);
    if (!checkout.ok) throw new Error('Checkout falló');
    const orderId = checkout.body.orderId;

    log('3) Login barista');
    const bar = await login('barista@coffeehouse.co','cafe123');
    log(' ->', bar.status, bar.body);
    if (!bar.ok) throw new Error('Login barista falló');

    log('4) Completar orden como barista');
    const complete = await post('/api/barista/completar', { orderId }, bar.cookie);
    log(' ->', complete.status, complete.body);
    if (!complete.ok) throw new Error('Completar orden falló');

    log('5) Login gerente');
    const ger = await login('gerente@coffeehouse.co','admin2026');
    log(' ->', ger.status, ger.body);
    if (!ger.ok) throw new Error('Login gerente falló');

    log('6) Restock como gerente');
    const rest = await post('/api/admin/restock', {}, ger.cookie);
    log(' ->', rest.status, rest.body);
    if (!rest.ok) throw new Error('Restock falló');

    log('\nIntegración completa: OK');
    process.exit(0);
  } catch (err) {
    console.error('Prueba fallida:', err.message || err);
    process.exit(2);
  }
})();
