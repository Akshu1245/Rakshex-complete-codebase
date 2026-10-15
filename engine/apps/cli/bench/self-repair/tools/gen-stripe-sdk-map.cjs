// Generates stripe-node resource-method -> HTTP endpoint map by reading the installed package's
// generated resource classes. No network calls (client constructed with a dummy key, never used).
const path = process.argv[2]; const S = require(path); const Stripe = S.default || S.Stripe || S;
const pkg = require(path + '/package.json');
const c = new Stripe('sk_test_dummy_never_used');
const out = {}; const seen = new Set();
function walk(obj, prefix, depth) {
  if (!obj || typeof obj !== 'object' || depth > 4 || seen.has(obj)) return; seen.add(obj);
  let proto = Object.getPrototypeOf(obj);
  if (proto && proto.constructor && /Resource$/.test(proto.constructor.name)) {
    for (const m of Object.getOwnPropertyNames(proto)) {
      if (m === 'constructor') continue; const f = proto[m]; if (typeof f !== 'function') continue;
      const src = f.toString(); const r = /_makeRequest\(\s*'([A-Z]+)'\s*,\s*[`']([^`']+)[`']/.exec(src);
      if (r) out[prefix + '.' + m] = { method: r[1], path: r[2].replace(/\$\{[^}]+\}/g, '{*}') };
    }
  }
  for (const k of Object.keys(obj)) { if (k.startsWith('_')) continue; walk(obj[k], prefix ? prefix + '.' + k : k, depth + 1); }
}
walk(c, '', 0);
const sorted = Object.fromEntries(Object.entries(out).sort());
console.log(JSON.stringify({ package: 'stripe', version: pkg.version, apiVersion: Stripe.API_VERSION || c.getApiField?.('version') || null, generatedBy: 'engineering/sdkmap/gen.cjs', methods: sorted }, null, 1));
