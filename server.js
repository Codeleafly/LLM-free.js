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
  return req.headers["x-forwarded-for"]?.split(",")[0]
    || req.socket.remoteAddress
    || "unknown";
}

function resetQuotaIfNewDay(ip) {
  const today = new Date().toDateString();
  if (!userQuota[ip] || userQuota[ip].date !== today) {
    userQuota[ip] = { count: 0, date: today };
  }
}

function normalizeModelName(raw) {
  // Remove provider prefix if present
  let m = raw.replace(/^.*\//, "").toLowerCase();
  // Ensure it matches Gemini format: gemini-<gen>-<variation>
  const parts = m.split("-");
  if (parts[0] !== "gemini" || parts.length < 3) {
    throw new Error("Unsupported model format");
  }
  // Add stable version suffix "00x" if missing
  if (parts.length === 3) {
    return `${parts.join("-")}-002`;
  }
  // Otherwise return full raw normalized
  return parts.join("-");
}

app.post("/smart-tell-line/api/v1", async (req, res) => {
  const ip = getClientIP(req);
  resetQuotaIfNewDay(ip);
  if (userQuota[ip].count >= QUOTA_LIMIT) {
    return res.status(429).json({ error: "Daily quota exceeded." });
  }

  const { model, text } = req.body;
  if (typeof model !== "string" || typeof text !== "string") {
    return res.status(400).json({ error: "Invalid format. Required: { model, text }" });
  }

  let normModel;
  try {
    normModel = normalizeModelName(model);
  } catch {
    return res.status(400).json({ error: "Unsupported model name format." });
  }

  try {
    const ctx = new Context();
    const messages = [{ role: "user", content: text }];
    const chatResp = await ctx.ai.chat(messages, {
      model: normModel,
      stream: false
    });
    const reply = await chatResp.text();

    userQuota[ip].count++;
    res.json({ model: normModel, response: reply });
  } catch (err) {
    console.error("❌ AI Error:", err);
    res.status(500).json({ error: "AI response failed." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Running on port ${PORT}`);
});
