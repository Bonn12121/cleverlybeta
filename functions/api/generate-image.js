export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Support both key names
  const NVIDIA_KEY = env.NVIDIA_API_KEY || env.NV_API_KEY;
  if (!NVIDIA_KEY) {
    return new Response(JSON.stringify({ error: "NVIDIA_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await request.json();
    const { prompt, aspect_ratio, output_format, negative_prompt, cfg_scale, seed, steps } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing 'prompt' parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Build JSON payload for NVIDIA NIM API — Optimized for SD 3.5 Large
    const payload = {
      prompt,
      aspect_ratio: aspect_ratio || "1:1",
      output_format: output_format || "jpeg",
      cfg_scale: cfg_scale ?? 5,
      seed: seed ?? 0,
      steps: steps ?? 50,
    };

    if (negative_prompt) payload.negative_prompt = negative_prompt;

    const nvidiaRes = await fetch(
      "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-5-large",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NVIDIA_KEY}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!nvidiaRes.ok) {
      const status = nvidiaRes.status;
      const errText = await nvidiaRes.text();
      let errorMessage = errText;
      try {
        const j = JSON.parse(errText);
        errorMessage = j.message || j.error?.message || errText;
      } catch {}

      return new Response(JSON.stringify({ error: "NVIDIA API error", status, message: errorMessage }), {
        status: status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await nvidiaRes.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Image generation proxy error", message: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}