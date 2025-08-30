import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: "../.env.local" }); // ⚠️ đọc luôn từ .env.local

const app = express();
app.use(express.json());

app.post("/api/gemini", async (req, res) => {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        process.env.VITE_GEMINI_API_KEY, // dùng key từ .env.local
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy server error" });
  }
});

app.listen(3001, () => {
  console.log("✅ Proxy running at http://localhost:3001");
});
