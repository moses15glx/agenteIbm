import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(express.json());
app.use(cors());

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

app.post("/previsao", async (req, res) => {
  const { cidade } = req.body;

  try {
    // 1. buscar clima real
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${cidade}&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=pt_br`
    );

    const data = await response.json();

    if (!data.weather || !data.main) {
  return res.status(400).json({
    erro: "Falha ao obter dados do clima",
    resposta: data
  });
}

  const clima = data.weather[0].description;
  const temp = data.main.temp;

    // 2. lógica de risco simples
    let risco = "baixo";
    let recomendacao = "monitoramento normal";

    if (clima.includes("chuva") || clima.includes("tempestade")) {
      risco = "alto";
      recomendacao = "risco de alagamento e deslizamento - ativar equipes";
    }

    if (temp > 35) {
      risco = "medio";
      recomendacao = "risco de calor extremo - suporte à população";
    }

    // 3. resposta final
    res.json({
      cidade,
      temperatura: temp,
      clima,
      risco,
      recomendacao
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post("/previsao-inteligente", async (req, res) => {
  const { cidade } = req.body;

  try {
    //  1. CLIMA REAL
    const climaRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${cidade}&appid=${process.env.WEATHER_API_KEY}&units=metric&lang=pt_br`
    );
    const climaData = await climaRes.json();

    const clima = climaData.weather[0].description;
    const temp = climaData.main.temp;

    // 2. EVENTOS NASA (globais)
    const nasaRes = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events"
    );
    const nasaData = await nasaRes.json();

    const eventosAtivos = nasaData.events.slice(0, 3).map(e => e.title);

    //  3. LÓGICA DE RISCO
    let risco = "baixo";
    let recomendacao = "situação estável";

    if (clima.includes("chuva") || clima.includes("tempestade")) {
      risco = "alto";
      recomendacao = "risco de enchentes e deslizamentos";
    }

    if (temp > 35) {
      risco = "medio";
      recomendacao = "risco de calor extremo";
    }

    if (eventosAtivos.length > 0) {
      risco = "medio";
    }

    if (clima.includes("tempestade") && temp > 30) {
      risco = "alto";
      recomendacao = "situação crítica combinada (clima severo + instabilidade)";
    }

    // RESPOSTA FINAL
    res.json({
      cidade,
      clima,
      temperatura: temp,
      eventos_globais: eventosAtivos,
      risco,
      recomendacao
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});
// ===============================
// 🌪️ PREVISÃO DE DESASTRES
// ===============================
app.post("/previsao", async (req, res) => {
  const { cidade } = req.body;

  try {
    // 🔥 pega ocorrências recentes
    const ocorrencias = await pool.query(`
      SELECT * FROM ocorrencias
      ORDER BY gravidade DESC
      LIMIT 3
    `);

    if (!ocorrencias.rows.length) {
      return res.json({
        cidade,
        risco: "baixo",
        possiveis_desastres: [],
        recomendacao: "monitoramento padrão"
      });
    }

    const gravidadeMedia =
      ocorrencias.rows.reduce((acc, o) => acc + o.gravidade, 0) /
      ocorrencias.rows.length;

    let risco = "baixo";
    let desastres = [];
    let recomendacao = "";

    // 🔥 lógica simples mas convincente
    if (gravidadeMedia >= 8) {
      risco = "alto";
      desastres = ["enchente", "deslizamento"];
      recomendacao = "mobilizar equipes de resgate e evacuação";
    } else if (gravidadeMedia >= 5) {
      risco = "medio";
      desastres = ["alagamento", "interrupções logísticas"];
      recomendacao = "preparar equipes de apoio e logística";
    } else {
      risco = "baixo";
      desastres = ["impactos leves"];
      recomendacao = "monitorar situação";
    }

    res.json({
      cidade,
      risco,
      possiveis_desastres: desastres,
      recomendacao
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
    // 1. Buscar cenário mais crítico
    const ocorrencia = await pool.query(`
      SELECT * FROM ocorrencias
      ORDER BY gravidade DESC
      LIMIT 1
    `);

    const localCritico = ocorrencia.rows[0];

    // 2. Definir tipo de necessidade baseado na gravidade
    let tipoNecessidade = "apoio";

    if (localCritico.gravidade >= 8) tipoNecessidade = "resgate";
    else if (localCritico.gravidade >= 5) tipoNecessidade = "logistica";

    // 3. Mapear habilidades → grupo
    const habilidadesUsuario = habilidades.map(h => h.toLowerCase());

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

    // 4. Buscar melhores voluntários similares (ranking)
    const voluntarios = await pool.query(`
      SELECT v.nome, AVG(p.desempenho) as media
      FROM voluntarios v
      JOIN participacoes p ON v.id = p.voluntario_id
      WHERE p.compareceu = true
      GROUP BY v.nome
      ORDER BY media DESC
      LIMIT 3
    `);

    // 5. Definir tarefas
    let tarefas = [];

    if (grupo === "Resgate") {
      tarefas = [
        "Atuar em áreas de risco",
        "Auxiliar no resgate de vítimas",
        "Apoiar equipes de emergência"
      ];
    } else if (grupo === "Logistica") {
      tarefas = [
        "Organizar suprimentos",
        "Distribuir doações",
        "Gerenciar recursos"
      ];
    } else {
      tarefas = [
        "Acolher vítimas",
        "Fornecer informações",
        "Apoiar comunicação"
      ];
    }

    // 6. Resposta final
    res.json({
      cidade,
      local_critico: localCritico.local,
      gravidade: localCritico.gravidade,
      tipo_necessidade: tipoNecessidade,
      grupo_recomendado: grupo,
      tarefas,
      voluntarios_destaque: voluntarios.rows
    });

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});


// ===============================
// LISTAR HABILIDADES
// ===============================
app.get("/habilidades", async (req, res) => {
  const result = await pool.query("SELECT * FROM habilidades");
  res.json(result.rows);
});


// ===============================
// LISTAR VOLUNTÁRIOS
// ===============================
app.get("/voluntarios", async (req, res) => {
  const result = await pool.query("SELECT * FROM voluntarios");
  res.json(result.rows);
});

// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});