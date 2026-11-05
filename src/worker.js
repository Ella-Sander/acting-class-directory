const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'acting-class-directory', databaseConfigured: Boolean(env.DIRECTORY_DB) });
    }
    return env.ASSETS.fetch(request);
  },
};
