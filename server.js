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

// Automatically serve the index.html and all files in this folder
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Cleverly Local Server is RUNNING`);
    console.log(`======================================================`);
    console.log(`Open your browser to: http://localhost:${PORT}`);
    console.log(`\nIMPORTANT: Keep this window open while chatting!`);
});
