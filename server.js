require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serper search proxy
app.post('/api/search', async (req, res) => {
    const SERPER_KEY = process.env.SERPER_API_KEY;
    if (!SERPER_KEY) return res.status(500).json({ error: 'SERPER_API_KEY not set in environment' });
    const query = req.body.q;
    if (!query) return res.status(400).json({ error: "Missing 'q' parameter" });
    try {
        const r = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'X-API-KEY': SERPER_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: query, num: 5 }),
        });
        const data = await r.json();
        res.status(r.status).json(data);
    } catch (err) {
        console.error('Serper Error:', err);
        res.status(500).json({ error: 'Search proxy error', message: err.message });
    }
});

// NVIDIA completions proxy — injects API key from env
app.post('/api/completions', async (req, res) => {
    const NV_KEY = process.env.NV_API_KEY;
    if (!NV_KEY) return res.status(500).json({ error: 'NV_API_KEY not set in environment' });

    try {
        // Security: Server-side file size check (Vuln #8)
        const payloadSize = JSON.stringify(req.body).length;
        if (payloadSize > 6000000) { // ~6MB limit for entire payload
            return res.status(413).json({ error: 'Payload too large', message: 'Attachments and prompt exceed size limit.' });
        }

        const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NV_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body),
        });

        // Forward status and headers
        res.status(nvidiaRes.status);
        res.set('Content-Type', nvidiaRes.headers.get('content-type') || 'application/json');

        // Stream the response body
        const reader = nvidiaRes.body.getReader();
        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); return; }
                res.write(Buffer.from(value));
            }
        };
        await pump();
    } catch (err) {
        console.error('NVIDIA Proxy Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Proxy error', message: err.message });
        }
    }
});

// NVIDIA NIM image generation proxy — SD 3.5 Large
app.post('/api/generate-image', async (req, res) => {
    const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
    if (!NVIDIA_KEY) return res.status(500).json({ error: 'NVIDIA_API_KEY not set in environment' });

    const { prompt, aspect_ratio, output_format, negative_prompt, cfg_scale, seed, steps } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing 'prompt' parameter" });

    try {
        if (prompt.length > 2000) return res.status(400).json({ error: "Prompt too long" });
        
        // Build JSON payload for NVIDIA NIM API
        const payload = {
            prompt,
            mode: "text-to-image",
            aspect_ratio: aspect_ratio || "1:1",
            output_format: output_format || "jpeg",
            cfg_scale: cfg_scale ?? 5,
            seed: seed ?? 0,
            steps: steps ?? 50,
        };

        if (negative_prompt) payload.negative_prompt = negative_prompt;

        const nvidiaRes = await fetch("https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-5-large", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${NVIDIA_KEY}`,
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!nvidiaRes.ok) {
            const errText = await nvidiaRes.text();
            console.error('NVIDIA API Error:', nvidiaRes.status, errText);
            return res.status(nvidiaRes.status).json({ error: 'NVIDIA API error', message: errText });
        }

        const data = await nvidiaRes.json();
        res.status(200).json(data);
    } catch (err) {
        console.error('NVIDIA Proxy Error:', err);
        res.status(500).json({ error: 'Image generation proxy error', message: err.message });
    }
});

// Automatically serve the index.html and all files in this folder
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Cleverly Local Server is RUNNING`);
    console.log(`======================================================`);
    console.log(`Open your browser to: http://localhost:${PORT}`);
    console.log(`\nIMPORTANT: Keep this window open while chatting!`);
});
