import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL1,
  process.env.SUPABASE_SERVICE_ROLE1
)

export default async function handler(req, res){

  // ============================
  // METHOD CHECK
  // ============================
  if(req.method !== "POST"){
    return res.status(405).json({ error:"Use POST" })
  }

  // ============================
  // AUTH TOKEN
  // ============================
  if(req.headers.authorization !== process.env.ADMIN_TOKEN){
    return res.status(401).json({ error:"Não autorizado" })
  }

  try{

    const body = req.body || {}
    const action = body.action

    if(!action){
      return res.json({ ok:true, message:"API OK" })
    }

    // =========================================
    // LISTAR
    // =========================================
    if(action === "listar"){

      const empresasRes = await supabase.from("empresas").select("*")
      const usuariosRes = await supabase.from("usuarios").select("*")

      if(empresasRes.error) throw empresasRes.error
      if(usuariosRes.error) throw usuariosRes.error

      return res.json({
        empresas: empresasRes.data || [],
        usuarios: usuariosRes.data || []
      })
    }

    // =========================================
    // CRIAR EMPRESA
    // =========================================
    if(action === "criar_empresa"){

      const {
        nome,
        nome_fantasia,
        cnpj,
        email,
        telefone,
        cidade,
        estado,
        plano,
        usuarios_limite,
        valor_mensal
      } = body

      if(!nome){
        return res.status(400).json({ error:"Nome obrigatório" })
      }

      const { data, error } = await supabase
        .from("empresas")
        .insert({
          nome,
          nome_fantasia,
          cnpj,
          email,
          telefone,
          cidade,
          estado,
          plano: plano || "basic",
          status: "ativo",
          usuarios_limite: usuarios_limite || 3,
          valor_mensal: valor_mensal || 0
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

      const { id, ...dados } = body

      if(!id){
        return res.status(400).json({ error:"ID obrigatório" })
      }

      const { error } = await supabase
        .from("empresas")
        .update(dados)
        .eq("id", id)

      if(error) throw error

      return res.json({ ok:true })
    }

    // =========================================
    // EXCLUIR EMPRESA
    // =========================================
    if(action === "excluir_empresa"){

      const { id } = body

      if(!id){
        return res.status(400).json({ error:"ID obrigatório" })
      }

      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("auth_id")
        .eq("empresa_id", id)

      for(const u of usuarios || []){
        if(u.auth_id){
          await supabase.auth.admin.deleteUser(u.auth_id)
        }
      }

      await supabase.from("usuarios").delete().eq("empresa_id", id)
      await supabase.from("empresas").delete().eq("id", id)

      return res.json({ ok:true })
    }

    // =========================================
    // CRIAR USUARIO
    // =========================================
    if(action === "criar_usuario"){

      const { email, senha, nome, empresa_id, perfil } = body

      if(!email || !senha || !empresa_id){
        return res.status(400).json({ error:"Dados obrigatórios faltando" })
      }

      // limite
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
        return res.status(400).json({ error:"Limite atingido" })
      }

      // criar auth
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm:true
      })

      if(error) throw error

      const userId = data.user.id

      // vincular
      const { error: upError } = await supabase
        .from("usuarios")
        .update({
          nome,
          empresa_id,
          perfil: perfil || "usuario"
        })
        .eq("auth_id", userId)

      if(upError) throw upError

      return res.json({ ok:true })
    }

    // =========================================
    // EDITAR USUARIO
    // =========================================
    if(action === "editar_usuario"){

      const { auth_id, nome, perfil } = body

      if(!auth_id){
        return res.status(400).json({ error:"auth_id obrigatório" })
      }

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

      const { auth_id } = body

      if(!auth_id){
        return res.status(400).json({ error:"auth_id obrigatório" })
      }

      const { error } = await supabase.auth.admin.deleteUser(auth_id)
      if(error) throw error

      await supabase
        .from("usuarios")
        .delete()
        .eq("auth_id", auth_id)

      return res.json({ ok:true })
    }

    // =========================================
    // LOGIN LOG
    // =========================================
    if(action === "log_login"){

      const { auth_id } = body

      if(!auth_id){
        return res.status(400).json({ error:"auth_id obrigatório" })
      }

      await supabase.rpc("increment_login", { uid: auth_id })

      return res.json({ ok:true })
    }

    return res.status(400).json({ error:"Ação inválida" })

  }catch(err){

    console.error("🔥 ERRO API:", err)

    return res.status(500).json({
      error: err.message || "Erro interno"
    })
  }
}
