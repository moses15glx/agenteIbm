import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// 🧠 memória simples por usuário (número)
let estadoUsuarios = {};

router.post("/", async (req, res) => {
  try {
    const mensagem = req.body.Body?.toLowerCase() || "";
    const numero = req.body.From;

    console.log(`📩 ${numero}: ${mensagem}`);

    // cria estado se não existir
    if (!estadoUsuarios[numero]) {
      estadoUsuarios[numero] = { etapa: 0 };
    }

    const estado = estadoUsuarios[numero];
    let resposta = "";

    // ===============================
    // 🧠 FLUXO DO AGENTE
    // ===============================

    if (estado.etapa === 0) {
      resposta = "👋 Olá! Qual sua cidade?";
      estado.etapa = 1;
    } 
    
    else if (estado.etapa === 1) {
      estado.cidade = mensagem;

      // 🔥 chama sua API
      const apiRes = await fetch(
        "https://agenteibm-production.up.railway.app/previsao-inteligente",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cidade: mensagem })
        }
      );

      const data = await apiRes.json();

      resposta = `
📍 Cidade: ${data.cidade}
🌤️ Clima: ${data.clima}
⚠️ Risco: ${data.risco}
🧠 ${data.recomendacao}

Você quer ajudar como voluntário? (sim/não)
`;

      estado.etapa = 2;
    } 
    
    else if (estado.etapa === 2) {
      if (mensagem.includes("sim")) {
        resposta = "💪 Você tem boa força física?";
        estado.etapa = 3;
      } else {
        resposta = "👍 Tudo bem! Se precisar, estou por aqui.";
        delete estadoUsuarios[numero]; // limpa estado
      }
    } 
    
    else if (estado.etapa === 3) {
      estado.forca = mensagem;

      // 🔥 chama match
      const apiRes = await fetch(
        "https://agenteibm-production.up.railway.app/match",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cidade: estado.cidade,
            habilidades: [mensagem]
          })
        }
      );

      const data = await apiRes.json();

      resposta = `
🤝 Grupo recomendado: ${data.grupo_recomendado}

📋 Tarefas:
- ${data.tarefas.join("\n- ")}

🏆 Voluntários destaque:
${data.voluntarios_destaque.map(v => `- ${v.nome} (${v.media})`).join("\n")}
`;

      delete estadoUsuarios[numero]; // finaliza fluxo
    }

    // ===============================

    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>${resposta}</Message>
      </Response>
    `);

  } catch (err) {
    console.error(err);

    res.set("Content-Type", "text/xml");
    res.send(`
      <Response>
        <Message>Erro ao processar 😥</Message>
      </Response>
    `);
  }
});

export default router;