import express from "express";

const router = express.Router();

// 📲 Webhook do Twilio
router.post("/", (req, res) => {
  const mensagem = req.body.Body;
  const numero = req.body.From;

  console.log(`📩 ${numero}: ${mensagem}`);

  // resposta simples (depois vamos ligar com IA)
  const resposta = "Recebi sua mensagem! 👀";

  res.set("Content-Type", "text/xml");
  res.send(`
    <Response>
      <Message>${resposta}</Message>
    </Response>
  `);
});

export default router;