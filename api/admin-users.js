import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL1,
  process.env.SUPABASE_SERVICE_ROLE1
)

export default async function handler(req, res) {

  // ===============================
  // PERMITIR SOMENTE POST
  // ===============================
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" })
  }

  try {

    const { action } = req.body

    // =========================================
    // LISTAR EMPRESAS + USUARIOS
    // =========================================
    if (action === "listar") {

      const { data: empresas, error: e1 } = await supabase
        .from("empresas")
        .select("*")
        .order("nome", { ascending: true })

      const { data: usuarios, error: e2 } = await supabase
        .from("usuarios")
        .select("*")
        .order("created_at", { ascending: false })

      if (e1 || e2) {
        throw new Error(e1?.message || e2?.message)
      }

      return res.json({
        empresas: empresas || [],
        usuarios: usuarios || []
      })
    }

    // =========================================
    // CRIAR USUARIO
    // =========================================
    if (action === "criar") {

      const {
        email,
        senha,
        nome,
        empresa_id,
        perfil
      } = req.body

      if (!email || !senha || !empresa_id) {
        return res.status(400).json({
          error: "Dados obrigatórios faltando"
        })
      }

      // 🔥 cria no auth
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true
      })

      if (error) throw error

      const userId = data.user.id

      // 🔥 atualiza na tabela usuarios
      const { error: updateError } = await supabase
        .from("usuarios")
        .update({
          nome,
          empresa_id,
          perfil: perfil || "usuario"
        })
        .eq("auth_id", userId)

      if (updateError) throw updateError

      return res.json({ ok: true })
    }

    // =========================================
    // EXCLUIR USUARIO
    // =========================================
    if (action === "excluir") {

      const { auth_id } = req.body

      if (!auth_id) {
        return res.status(400).json({
          error: "auth_id obrigatório"
        })
      }

      // 🔥 remove do auth
      const { error: e1 } = await supabase.auth.admin.deleteUser(auth_id)

      if (e1) throw e1

      // 🔥 remove do banco
      const { error: e2 } = await supabase
        .from("usuarios")
        .delete()
        .eq("auth_id", auth_id)

      if (e2) throw e2

      return res.json({ ok: true })
    }

    // =========================================
    // EDITAR USUARIO (BÔNUS 🔥)
    // =========================================
    if (action === "editar") {

      const { auth_id, nome, perfil, empresa_id } = req.body

      const { error } = await supabase
        .from("usuarios")
        .update({
          nome,
          perfil,
          empresa_id
        })
        .eq("auth_id", auth_id)

      if (error) throw error

      return res.json({ ok: true })
    }

    // =========================================
    // AÇÃO INVÁLIDA
    // =========================================
    return res.status(400).json({ error: "Ação inválida" })

  } catch (err) {

    console.error("ERRO API:", err)

    return res.status(500).json({
      error: err.message || "Erro interno"
    })
  }
}
