const express = require("express");
const { Context } = require("@heyputer/putility");
const app = express();

app.use(express.json());

// ✅ Track per IP quota
const userQuota = {};
const QUOTA_LIMIT = 1500;

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function resetQuotaDaily() {
  const now = new Date().toDateString();
  for (const ip in userQuota) {
    if (userQuota[ip].date !== now) {
      userQuota[ip] = { count: 0, date: now };
    }
  }
}

// ✅ Validate request body
function isValidRequest(body) {
  return (
    typeof body === "object" &&
    typeof body.provider === "string" &&
    typeof body.model === "string" &&
    typeof body.text === "string"
  );
}

// ✅ API Endpoint
app.post("/smart-tell-line/api/v1", async (req, res) => {
  resetQuotaDaily();

  const ip = getClientIP(req);
  if (!userQuota[ip]) {
    userQuota[ip] = { count: 0, date: new Date().toDateString() };
  }

  if (userQuota[ip].count >= QUOTA_LIMIT) {
    return res.status(429).json({ error: "Daily quota (1,500 requests) exceeded." });
  }

  const body = req.body;

  if (!isValidRequest(body)) {
    return res.status(400).json({
      error: "Invalid request format. Required: { provider, model, text }",
    });
  }

  const { provider, model, text } = body;

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
    console.error("❌ AI Error:", err.message);
    res.status(500).json({ error: "AI response failed. Please try again." });
  }
});

// ✅ Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API live at http://localhost:${PORT}/smart-tell-line/api/v1`);
});
