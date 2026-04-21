export async function onRequest(context) {
  const { request, env } = context;
  
  // Only allow POST requests (matching what the frontend sends)
  // or OPTIONS for CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Title, HTTP-Referer",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // The target NVIDIA endpoint
  const targetUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

  // Read API key from environment variable (set in Cloudflare dashboard or .env)
  const nvApiKey = env.NV_API_KEY;
  if (!nvApiKey) {
    return new Response(JSON.stringify({ error: "NV_API_KEY not configured on server" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    // 1. Build clean request headers — inject the API key server-side
    const reqHeaders = new Headers();
    reqHeaders.set("Content-Type", request.headers.get("Content-Type") || "application/json");
    reqHeaders.set("Authorization", `Bearer ${nvApiKey}`);

    // Read the body text instead of passing the stream to prevent request issues
    const reqBody = await request.text();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    // 2. Forward the request to NVIDIA
    const nvidiaResponse = await fetch(targetUrl, {
      method: "POST",
      headers: reqHeaders,
      body: reqBody,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // 3. Create a clean response with CORS headers
    const resHeaders = new Headers(nvidiaResponse.headers);
    resHeaders.set("Access-Control-Allow-Origin", "*");
    
    // Delete headers that might interfere with Cloudflare's own chunking/encoding
    resHeaders.delete("content-encoding");
    resHeaders.delete("content-length");
    resHeaders.delete("transfer-encoding");
    resHeaders.set("X-Accel-Buffering", "no"); // Prevent proxy buffering
    resHeaders.set("Cache-Control", "no-cache");
    
    return new Response(nvidiaResponse.body, {
      status: nvidiaResponse.status,
      statusText: nvidiaResponse.statusText,
      headers: resHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Proxy Error", message: err.message }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
    });
  }
}
