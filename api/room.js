// Vercel serverless function: stores one JSON document per game room in Upstash Redis.
// GET  /api/room?code=ABCD[&since=N]  -> { room } or { unchanged: true }
// POST /api/room {op:"set"|"update", code, data}  -> { room }
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = 60 * 60 * 24; // rooms vanish after 24 hours without a write
const key = (code) => 'hf:room:' + code;
const validCode = (c) => typeof c === 'string' && /^[A-Z]{4}$/.test(c);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// Objects merge recursively; arrays and scalars replace. Same rule the game page expects.
function deepMerge(target, patch) {
  const out = { ...target };
  for (const k of Object.keys(patch)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = isObj(patch[k]) && isObj(out[k]) ? deepMerge(out[k], patch[k]) : patch[k];
  }
  return out;
}

async function load(code) {
  const raw = await redis(['GET', key(code)]);
  return raw ? JSON.parse(raw) : null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!URL_ || !TOKEN) {
      return res.status(500).json({ error: 'Storage is not set up. Connect an Upstash Redis database to this Vercel project.' });
    }
    if (req.method === 'GET') {
      const code = String(req.query.code || '').toUpperCase();
      if (!validCode(code)) return res.status(400).json({ error: 'Bad room code.' });
      const room = await load(code);
      if (room && req.query.since !== undefined && Number(req.query.since) === room._v) {
        return res.status(200).json({ unchanged: true });
      }
      return res.status(200).json({ room });
    }
    if (req.method === 'POST') {
      const { op, code, data } = req.body || {};
      if (!validCode(code)) return res.status(400).json({ error: 'Bad room code.' });
      if (!isObj(data)) return res.status(400).json({ error: 'Missing data.' });
      if (JSON.stringify(data).length > 60000) return res.status(413).json({ error: 'Too large.' });
      const old = await load(code);
      let room;
      if (op === 'set') {
        room = { ...data };
      } else if (op === 'update') {
        if (!old) return res.status(404).json({ error: 'That room no longer exists.' });
        room = deepMerge(old, data);
      } else {
        return res.status(400).json({ error: 'Unknown operation.' });
      }
      room._v = ((old && old._v) || 0) + 1;
      await redis(['SET', key(code), JSON.stringify(room), 'EX', TTL]);
      return res.status(200).json({ room });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Server error.' });
  }
};
