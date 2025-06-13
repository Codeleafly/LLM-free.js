const express = require("express");
const cors = require("cors");
const { Context } = require("@heyputer/putility");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const QUOTA_LIMIT = 1500;
const userQuota = {};

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function resetQuotaIfNewDay(ip) {
  const today = new Date().toDateString();
  if (!userQuota[ip] || userQuota[ip].date !== today) {
    userQuota[ip] = { count: 0, date: today };
  }
}

function isValidRequest(body) {
  return (
    typeof body === "object" &&
    typeof body.model === "string" &&
    typeof body.text === "string"
  );
}

// ✅ Endpoint: No separate provider field
app.post("/smart-tell-line/api/v1", async (req, res) => {
  const ip = getClientIP(req);
  resetQuotaIfNewDay(ip);

  if (userQuota[ip].count >= QUOTA_LIMIT) {
    return res.status(429).json({ error: "Daily quota (1,500 requests) exceeded." });
  }

  const { model, text } = req.body;

  if (!isValidRequest(req.body)) {
    return res.status(400).json({
      error: "Invalid format. Required: { model, text }",
    });
  }

  try {
    const ctx = new Context();
    const chatResp = await ctx.ai.chat(text, {
      model,
      stream: false,
    });
    const reply = await chatResp.text();

    userQuota[ip].count++;
    res.json({ response: reply });
  } catch (err) {
    console.error("❌ AI Error:", err);
    res.status(500).json({ error: "AI response failed. Try again later." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Live on port ${PORT} – endpoint: /smart-tell-line/api/v1`);
});
