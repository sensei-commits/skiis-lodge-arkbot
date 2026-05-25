// Ticket Manager — CRUD endpoints for SupportTicket entity
// Allows the tracker dashboard to update ticket status

const BASE44_API_KEY = Deno.env.get('BASE44_API_KEY') || '';
const APP_ID = '6a10ba67d4688599c08a387c';
const BASE_URL = `https://api.base44.com/api/apps/${APP_ID}/entities/SupportTicket`;
const HEADERS = { 'Content-Type': 'application/json', 'api_key': BASE44_API_KEY };

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  // LIST tickets with optional filters
  if (req.method === 'GET') {
    const status = url.searchParams.get('status') || '';
    const issue_type = url.searchParams.get('issue_type') || '';
    let query = `${BASE_URL}?limit=100&sort=-created_date`;
    if (status) query += `&status=${encodeURIComponent(status)}`;
    if (issue_type) query += `&issue_type=${encodeURIComponent(issue_type)}`;
    const resp = await fetch(query, { headers: HEADERS });
    const data = await resp.json();
    return Response.json(data);
  }

  // UPDATE ticket status/fields
  if (req.method === 'PATCH' && id) {
    const body = await req.json();
    const resp = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return Response.json(data);
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
});
