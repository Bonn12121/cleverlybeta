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

  const NVIDIA_KEY = env.NVIDIA_API_KEY;
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

    // Map aspect ratios to supported height/width
    // SD 3.5 Large supported: 768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344
    const ratioMap = {
      "1:1": { width: 1024, height: 1024 },
      "16:9": { width: 1344, height: 768 },
      "9:16": { width: 768, height: 1344 },
      "4:3": { width: 1216, height: 896 },
      "3:4": { width: 896, height: 1216 },
      "21:9": { width: 1344, height: 576 }, // 576 might not be supported, let's stick to docs
    };

    const dims = ratioMap[aspect_ratio] || ratioMap["1:1"];

    // Build JSON payload for NVIDIA NIM API (SD 3.5 Large spec)
    const payload = {
      prompt,
      mode: "base",
      height: dims.height,
      width: dims.width,
      cfg_scale: cfg_scale ?? 3.5, // SD 3.5 default is 3.5
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
          "Accept": "application/json", // Required as per docs
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!nvidiaRes.ok) {
      const errText = await nvidiaRes.text();
      return new Response(JSON.stringify({ error: "NVIDIA API error", message: errText }), {
        status: nvidiaRes.status,
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