// lib/paginate.js — one shared pagination contract for every admin record list.
//
// Query params: ?page=<1-based, default 1>&limit=<default 20, max 100>
// Response adds: page, limit, total, total_pages  (alongside the list's own key
// and, where applicable, a `stats` object computed across ALL rows — never just
// the page — so summary cards stay true to the full dataset).

export function parsePaging(request, defaultLimit = 20, maxLimit = 100) {
  const sp = new URL(request.url).searchParams;
  let page = parseInt(sp.get('page'), 10);
  let limit = parseInt(sp.get('limit'), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

export function pageMeta(total, page, limit) {
  const t = parseInt(total, 10) || 0;
  return { total: t, page, limit, total_pages: Math.max(1, Math.ceil(t / limit)) };
}
