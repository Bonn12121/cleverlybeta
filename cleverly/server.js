const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

app.use(cors());

// Automatically serve the index.html and all files in this folder
app.use(express.static(__dirname));

// Correct usage of proxy middleware so the path isn't stripped before rewriting
app.use(createProxyMiddleware({
    pathFilter: '/api/completions',
    target: 'https://integrate.api.nvidia.com',
    changeOrigin: true,
    pathRewrite: { '^/api/completions': '/v1/chat/completions' },
    onProxyRes: function (proxyRes, req, res) {
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
    },
    onError: function(err, req, res) {
        console.error('Proxy Error:', err);
        res.status(500).send('Proxy Error');
    }
}));

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Cleverly Local Server is RUNNING`);
    console.log(`======================================================`);
    console.log(`Open your browser to: http://localhost:${PORT}`);
    console.log(`\nIMPORTANT: Keep this window open while chatting!`);
});
