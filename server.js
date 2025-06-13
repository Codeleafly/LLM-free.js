const express = require("express");
const cors = require("cors");
const { Context } = require("@heyputer/putility");

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middlewares
app.use(cors()); // 🌐 Enable CORS for frontend
app.use(express.json());

// ✅ Quota Setup
const QUOTA_LIMIT = 1500;
const userQuota = {}; // IP-based tracking

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

// ✅ Request Validator
function isValidRequest(body) {
  return (
    typeof body === "object" &&
    typeof body.provider === "string" &&
    typeof body.model === "string" &&
    typeof body.text === "string"
  );
}

// ✅ Main Endpoint
app.post("/smart-tell-line/api/v1", async (req, res) => {
  const ip = getClientIP(req);
  resetQuotaIfNewDay(ip);

  // ✅ Quota limit check
  if (userQuota[ip].count >= QUOTA_LIMIT) {
    return res.status(429).json({
      error: "Daily quota (1,500 requests) exceeded for your IP.",
    });
  }

  const { provider, model, text } = req.body;

  if (!isValidRequest(req.body)) {
    return res.status(400).json({
      error: "Invalid request format. Required: { provider, model, text }",
    });
  }

  try {
    const ctx = new Context();
    const result = await ctx.ai.chat(text, {
      model: `${provider}/${model}`,
      stream: false,
    });

    const reply = await result.text();
    userQuota[ip].count++;

    res.json({ response: reply });
  } catch (err) {
    console.error("❌ AI Error:", err);
    res.status(500).json({ error: "AI response failed. Please try again later." });
  }
});

// ✅ Server Live
app.listen(PORT, () => {
  console.log(`✅ Smart Tell Line API running on http://localhost:${PORT}/smart-tell-line/api/v1`);
});
