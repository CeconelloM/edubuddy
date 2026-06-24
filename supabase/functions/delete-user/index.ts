import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) return json({ success: false, error: "Server misconfiguration" }, 500);

    // 1. Verificar identidade do chamador
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ success: false, error: "Unauthorized" }, 401);

    // 2. Verificar se o chamador é admin ou teacher (via service role)
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    const { data: callerProfile } = await adminClient
      .from("profiles").select("role").eq("id", caller.id).single();

    const callerRole = callerProfile?.role ?? "user";
    if (!["admin", "teacher"].includes(callerRole)) {
      return json({ success: false, error: "Forbidden: admin or teacher required" }, 403);
    }

    // 3. Parsear body
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }

    const { user_id } = body as { user_id?: string };
    if (!user_id) return json({ success: false, error: "user_id é obrigatório" }, 400);

    // 4. Impedir auto-deleção
    if (user_id === caller.id) {
      return json({ success: false, error: "Você não pode deletar sua própria conta por aqui" }, 400);
    }

    // 5. Verificar role do alvo — ninguém pode deletar um admin
    const { data: targetProfile } = await adminClient
      .from("profiles").select("role").eq("id", user_id).maybeSingle();

    if (targetProfile?.role === "admin") {
      return json({ success: false, error: "Não é possível deletar uma conta de administrador" }, 403);
    }

    // 6. Deletar profile primeiro (nem sempre tem CASCADE no FK)
    await adminClient.from("profiles").delete().eq("id", user_id);

    // 7. Deletar da auth.users (remove sessões ativas e dados de auth)
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteErr) return json({ success: false, error: `Erro ao deletar: ${deleteErr.message}` }, 500);

    return json({ success: true });
  } catch (err: unknown) {
    return json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
