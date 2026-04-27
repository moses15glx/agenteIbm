import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";
import whatsappRoutes from "./whatsapp.js";

dotenv.config();

const { Pool } = pkg;
const app = express();

app.use(express.json());
app.use(cors());

// 🔗 rota do WhatsApp
app.use("/whatsapp", whatsappRoutes);

// 🔌 BANCO
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ===============================
// 🔎 HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.json({ status: "API rodando 🚀" });
});

// ===============================
// 🌪️ PREVISÃO INTELIGENTE (CLIMA + NASA + BANCO)
// ===============================
app.post("/previsao", async (req, res) => {
  const { cidade } = req.body;

  try {
    // 🔹 CLIMA
    const climaRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${cidade}&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=pt_br`
    );
    const climaData = await climaRes.json();

    if (!climaData.weather || !climaData.main) {
      return res.status(400).json({
        erro: "Erro ao buscar clima",
        resposta: climaData,
      });
    }

    const clima = climaData.weather[0].description;
    const temp = climaData.main.temp;

    // 🔹 NASA
    const nasaRes = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events"
    );
    const nasaData = await nasaRes.json();

    const eventosAtivos = nasaData.events
      ? nasaData.events.slice(0, 3).map((e) => e.title)
      : [];

    // 🔹 BANCO (ocorrências reais)
    const ocorrencias = await pool.query(`
      SELECT * FROM ocorrencias
      ORDER BY gravidade DESC
      LIMIT 3
    `);

    let risco = "baixo";
    let recomendacao = "situação estável";
    let desastres = [];

    // 🔹 LÓGICA CLIMA
    if (clima.includes("chuva") || clima.includes("tempestade")) {
      risco = "alto";
      recomendacao = "risco de enchentes e deslizamentos";
    }

    if (temp > 35) {
      risco = "medio";
      recomendacao = "risco de calor extremo";
    }

    // 🔹 LÓGICA BANCO
    if (ocorrencias.rows.length > 0) {
      const media =
        ocorrencias.rows.reduce((acc, o) => acc + o.gravidade, 0) /
        ocorrencias.rows.length;

      if (media >= 8) {
        risco = "alto";
        desastres = ["enchente", "deslizamento"];
        recomendacao = "mobilizar equipes de resgate imediatamente";
      } else if (media >= 5) {
        risco = "medio";
        desastres = ["alagamento"];
        recomendacao = "preparar equipes de apoio";
      }
    }

    // 🔹 LÓGICA COMBINADA (mais forte)
    if (clima.includes("tempestade") && temp > 30) {
      risco = "alto";
      recomendacao = "situação crítica combinada (clima severo)";
    }

    res.json({
      cidade,
      clima,
      temperatura: temp,
      eventos_globais: eventosAtivos,
      possiveis_desastres: desastres,
      risco,
      recomendacao,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===============================
// 🧠 MATCH DE VOLUNTÁRIO
// ===============================
app.post("/match", async (req, res) => {
  const { habilidades, cidade } = req.body;

  try {
    const ocorrencia = await pool.query(`
      SELECT * FROM ocorrencias
      ORDER BY gravidade DESC
      LIMIT 1
    `);

    if (!ocorrencia.rows.length) {
      return res.status(400).json({
        erro: "Nenhuma ocorrência encontrada",
      });
    }

    const localCritico = ocorrencia.rows[0];

    let tipoNecessidade = "apoio";
    if (localCritico.gravidade >= 8) tipoNecessidade = "resgate";
    else if (localCritico.gravidade >= 5)
      tipoNecessidade = "logistica";

    const habilidadesUsuario = habilidades.map((h) =>
      h.toLowerCase()
    );

    let grupo = "Apoio";

    if (
      habilidadesUsuario.includes("forca") ||
      habilidadesUsuario.includes("resistencia")
    ) {
      grupo = "Resgate";
    } else if (
      habilidadesUsuario.includes("organizacao") ||
      habilidadesUsuario.includes("planejamento")
    ) {
      grupo = "Logistica";
    } else if (
      habilidadesUsuario.includes("comunicacao") ||
      habilidadesUsuario.includes("empatia")
    ) {
      grupo = "Atendimento";
    }

    const voluntarios = await pool.query(`
      SELECT v.nome, AVG(p.desempenho) as media
      FROM voluntarios v
      JOIN participacoes p ON v.id = p.voluntario_id
      WHERE p.compareceu = true
      GROUP BY v.nome
      ORDER BY media DESC
      LIMIT 3
    `);

    let tarefas = [];

    if (grupo === "Resgate") {
      tarefas = [
        "Atuar em áreas de risco",
        "Auxiliar no resgate de vítimas",
        "Apoiar equipes de emergência",
      ];
    } else if (grupo === "Logistica") {
      tarefas = [
        "Organizar suprimentos",
        "Distribuir doações",
        "Gerenciar recursos",
      ];
    } else {
      tarefas = [
        "Acolher vítimas",
        "Fornecer informações",
        "Apoiar comunicação",
      ];
    }

    res.json({
      cidade,
      local_critico: localCritico.local,
      gravidade: localCritico.gravidade,
      tipo_necessidade: tipoNecessidade,
      grupo_recomendado: grupo,
      tarefas,
      voluntarios_destaque: voluntarios.rows,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ===============================
// 📋 LISTAGENS
// ===============================
app.get("/habilidades", async (req, res) => {
  const result = await pool.query("SELECT * FROM habilidades");
  res.json(result.rows);
});

app.get("/voluntarios", async (req, res) => {
  const result = await pool.query("SELECT * FROM voluntarios");
  res.json(result.rows);
});

// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});