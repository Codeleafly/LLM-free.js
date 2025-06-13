// index.js
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS Allow for all origins
app.use(cors());

// ✅ Body parser
app.use(express.json());

// ✅ Stateless LLM API endpoint
app.post('/smart-tell-line/llm/api/free/v1', async (req, res) => {
  const { model, text } = req.body;

  if (!model || !text) {
    return res.status(400).json({ error: 'model and text fields are required' });
  }

  try {
    const aiResponse = await fetch('https://api.puter.com/v1/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: text }]
      })
    });

    const json = await aiResponse.json();

    if (json?.choices?.[0]?.message?.content) {
      return res.json({ response: json.choices[0].message.content });
    } else {
      return res.status(500).json({ error: 'Invalid AI response format', raw: json });
    }
  } catch (err) {
    console.error('AI Error:', err);
    return res.status(500).json({ error: 'Something went wrong', detail: err.message });
  }
});

// ✅ Server start
app.listen(PORT, () => {
  console.log(`🟢 Server running on http://localhost:${PORT}`);
});
