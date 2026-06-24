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

    // 2. Verificar se o chamador é admin ou teacher
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles").select("role").eq("id", caller.id).single();

    if (profileErr) return json({ success: false, error: `DB error: ${profileErr.message}` }, 500);

    const callerRole = callerProfile?.role ?? "user";
    if (!["admin", "teacher"].includes(callerRole)) {
      return json({ success: false, error: "Forbidden: admin or teacher required" }, 403);
    }

    // 3. Parsear e validar o body
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ success: false, error: "Invalid JSON" }, 400); }

    const { email, password, full_name, role } = body as {
      email?: string; password?: string; full_name?: string; role?: string;
    };

    if (!email?.trim())    return json({ success: false, error: "email é obrigatório" }, 400);
    if (!password?.trim()) return json({ success: false, error: "password é obrigatório" }, 400);
    if ((password as string).length < 8)
      return json({ success: false, error: "password deve ter no mínimo 8 caracteres" }, 400);

    // Regra de negócio: teacher só pode criar usuários com role 'user'
    // Admin pode criar 'user' ou 'teacher'. Ninguém pode criar 'admin'.
    const allowedRoles = callerRole === "admin" ? ["user", "teacher"] : ["user"];
    const assignedRole = allowedRoles.includes(role ?? "") ? (role as string) : "user";

    const fullNameTrimmed = full_name?.trim() || null;

    // 4. Criar usuário na auth.users
    const { data: { user: newUser }, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: { full_name: fullNameTrimmed },
    });

    if (createErr) return json({ success: false, error: `Erro ao criar usuário: ${createErr.message}` }, 422);

    // 5. Upsert profile com full_name, role e english_level padrão
    //    (o trigger do Supabase pode já ter criado a linha — o upsert lida com os dois casos)
    await adminClient.from("profiles").upsert({
      id: newUser!.id,
      email: email.trim(),
      full_name: fullNameTrimmed,
      role: assignedRole,
      english_level: "Beginner",
    }, { onConflict: "id" });

    return json({ success: true, user_id: newUser!.id, role: assignedRole });
  } catch (err: unknown) {
    return json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
