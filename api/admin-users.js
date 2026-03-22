import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL1,
  process.env.SUPABASE_SERVICE_ROLE1
)

export default async function handler(req, res){

  try{

    console.log("REQ BODY:", req.body)

    const { action } = req.body || {}

    // ============================
    // TESTE
    // ============================
    if(!action){
      return res.json({ ok:true, msg:"API funcionando" })
    }

    // ============================
    // LISTAR
    // ============================
    if(action === "listar"){

      const empresasRes = await supabase
        .from("empresas")
        .select("*")

      const usuariosRes = await supabase
        .from("usuarios")
        .select("*")

      console.log("EMPRESAS:", empresasRes.error)
      console.log("USUARIOS:", usuariosRes.error)

      if(empresasRes.error) throw empresasRes.error
      if(usuariosRes.error) throw usuariosRes.error

      return res.json({
        empresas: empresasRes.data || [],
        usuarios: usuariosRes.data || []
      })
    }

    // ============================
    // CRIAR
    // ============================
    if(action === "criar"){

      const { email, senha, nome, empresa_id, perfil } = req.body

      if(!email || !senha || !empresa_id){
        return res.status(400).json({ error:"dados faltando" })
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      })

      if(error){
        console.log("ERRO AUTH:", error)
        throw error
      }

      const userId = data.user.id

      const { error: upError } = await supabase
        .from("usuarios")
        .update({
          nome,
          empresa_id,
          perfil
        })
        .eq("auth_id", userId)

      if(upError){
        console.log("ERRO UPDATE:", upError)
        throw upError
      }

      return res.json({ ok:true })
    }

    // ============================
    // EXCLUIR
    // ============================
    if(action === "excluir"){

      const { auth_id } = req.body

      const { error } = await supabase.auth.admin.deleteUser(auth_id)

      if(error){
        console.log("ERRO DELETE AUTH:", error)
        throw error
      }

      await supabase
        .from("usuarios")
        .delete()
        .eq("auth_id", auth_id)

      return res.json({ ok:true })
    }

    return res.status(400).json({ error:"ação inválida" })

  }catch(err){

    console.error("🔥 ERRO API:", err)

    return res.status(500).json({
      error: err.message || "erro interno",
      detalhe: err
    })
  }
}
