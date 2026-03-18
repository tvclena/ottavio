import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE ================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

/* ================= HANDLER ================= */
export default async function handler(req, res) {

  /* =====================================================
  🔐 VERIFICAÇÃO META (OBRIGATÓRIO)
  ===================================================== */
  if (req.method === "GET") {

    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verificado com sucesso");
      return res.status(200).send(challenge);
    } else {
      console.log("Falha na verificação");
      return res.sendStatus(403);
    }
  }

  /* =====================================================
  📩 WEBHOOK (MENSAGEM + STATUS)
  ===================================================== */
  if (req.method === "POST") {
    try {

      const body = req.body;

      /* =====================================================
      🔥 1. CAPTURA STATUS (ENTREGUE / LIDO)
      ===================================================== */
      const statusObj =
        body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];

      if (statusObj) {

        const messageId = statusObj.id;
        const status = statusObj.status; // sent, delivered, read
        const timestamp = statusObj.timestamp;

        const dataHora = new Date(timestamp * 1000).toISOString();

        console.log("STATUS:", status, messageId);

        await supabase
          .from("conversas_whatsapp")
          .update({
            status: status,
            status_data: dataHora
          })
          .eq("message_id", messageId);

        return res.sendStatus(200);
      }

      /* =====================================================
      📥 2. RECEBER MENSAGEM DO CLIENTE
      ===================================================== */
      const msg =
        body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (!msg) return res.sendStatus(200);

      const from = msg.from;
      const text = msg.text?.body || "";

      console.log("MENSAGEM RECEBIDA:", from, text);

      /* =====================================================
      💾 SALVAR MENSAGEM CLIENTE
      ===================================================== */
      await supabase.from("conversas_whatsapp").insert({
        telefone: from,
        mensagem: text,
        role: "user",
        status: "read"
      });

      /* =====================================================
      🤖 OPENAI
      ===================================================== */
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "Você é atendente do Mercatto Delícia, responda de forma simpática e objetiva."
            },
            {
              role: "user",
              content: text
            }
          ]
        })
      }).then(r => r.json());

      const resposta = ai?.choices?.[0]?.message?.content || "Erro ao responder.";

      console.log("RESPOSTA IA:", resposta);

      /* =====================================================
      💬 ENVIAR WHATSAPP
      ===================================================== */
      const send = await fetch(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: { body: resposta }
          })
        }
      ).then(r => r.json());

      const messageId = send?.messages?.[0]?.id;

      console.log("MESSAGE ID:", messageId);

      /* =====================================================
      💾 SALVAR RESPOSTA COM STATUS
      ===================================================== */
      await supabase.from("conversas_whatsapp").insert({
        telefone: from,
        mensagem: resposta,
        role: "assistant",
        message_id: messageId,
        status: "sent"
      });

      return res.sendStatus(200);

    } catch (err) {
      console.error("ERRO GERAL:", err);
      return res.sendStatus(500);
    }
  }

  return res.sendStatus(405);
}
