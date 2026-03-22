import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL1,
  process.env.SUPABASE_SERVICE_ROLE1
)

export default async function handler(req, res){

  // 🔐 PROTEÇÃO
  if (req.headers.authorization !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Não autorizado" })
  }

  try{

    const { action } = req.body || {}

    // =========================================
    // HEALTH CHECK
    // =========================================
    if(!action){
      return res.json({ ok:true, message:"API OK" })
    }

    // =========================================
    // LISTAR TUDO
    // =========================================
    if(action === "listar"){

      const { data: empresas } = await supabase
        .from("empresas")
        .select("*")

      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("*")

      return res.json({
        empresas: empresas || [],
        usuarios: usuarios || []
      })
    }

    // =========================================
    // CRIAR EMPRESA
    // =========================================
    if(action === "criar_empresa"){

      const payload = req.body

      const { data, error } = await supabase
        .from("empresas")
        .insert({
          nome: payload.nome,
          nome_fantasia: payload.nome_fantasia,
          cnpj: payload.cnpj,
          email: payload.email,
          telefone: payload.telefone,
          cidade: payload.cidade,
          estado: payload.estado,
          plano: payload.plano || "basic",
          status: "ativo",
          usuarios_limite: payload.usuarios_limite || 3,
          valor_mensal: payload.valor_mensal || 0
        })
        .select()
        .single()

      if(error) throw error

      return res.json({ ok:true, empresa:data })
    }

    // =========================================
    // EDITAR EMPRESA
    // =========================================
    if(action === "editar_empresa"){

      const { id, ...rest } = req.body

      const { error } = await supabase
        .from("empresas")
        .update(rest)
        .eq("id", id)

      if(error) throw error

      return res.json({ ok:true })
    }

    // =========================================
    // EXCLUIR EMPRESA
    // =========================================
    if(action === "excluir_empresa"){

      const { id } = req.body

      // remove usuarios primeiro
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("auth_id")
        .eq("empresa_id", id)

      for(const u of usuarios || []){
        await supabase.auth.admin.deleteUser(u.auth_id)
      }

      await supabase.from("usuarios").delete().eq("empresa_id", id)
      await supabase.from("empresas").delete().eq("id", id)

      return res.json({ ok:true })
    }

    // =========================================
    // CRIAR USUARIO
    // =========================================
    if(action === "criar_usuario"){

      const { email, senha, nome, empresa_id, perfil } = req.body

      // 🔒 validar limite
      const { count } = await supabase
        .from("usuarios")
        .select("*", { count:"exact", head:true })
        .eq("empresa_id", empresa_id)

      const { data: empresa } = await supabase
        .from("empresas")
        .select("usuarios_limite")
        .eq("id", empresa_id)
        .single()

      if(count >= empresa.usuarios_limite){
        return res.status(400).json({ error:"Limite de usuários atingido" })
      }

      // 🔥 cria no auth
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm:true
      })

      if(error) throw error

      const userId = data.user.id

      // 🔥 vincula
      await supabase
        .from("usuarios")
        .update({
          nome,
          empresa_id,
          perfil
        })
        .eq("auth_id", userId)

      return res.json({ ok:true })
    }

    // =========================================
    // EDITAR USUARIO
    // =========================================
    if(action === "editar_usuario"){

      const { auth_id, nome, perfil } = req.body

      const { error } = await supabase
        .from("usuarios")
        .update({ nome, perfil })
        .eq("auth_id", auth_id)

      if(error) throw error

      return res.json({ ok:true })
    }

    // =========================================
    // EXCLUIR USUARIO
    // =========================================
    if(action === "excluir_usuario"){

      const { auth_id } = req.body

      await supabase.auth.admin.deleteUser(auth_id)

      await supabase
        .from("usuarios")
        .delete()
        .eq("auth_id", auth_id)

      return res.json({ ok:true })
    }

    // =========================================
    // LOG DE LOGIN
    // =========================================
    if(action === "log_login"){

      const { auth_id } = req.body

      await supabase.rpc("increment_login", {
        uid: auth_id
      })

      return res.json({ ok:true })
    }

    return res.status(400).json({ error:"Ação inválida" })

  }catch(err){

    console.error("🔥 ERRO:", err)

    return res.status(500).json({
      error: err.message,
      stack: err
    })
  }
}
