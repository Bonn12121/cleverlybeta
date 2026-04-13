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

  const STABILITY_KEY = env.STABILITY_API_KEY;
  if (!STABILITY_KEY) {
    return new Response(JSON.stringify({ error: "STABILITY_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await request.json();
    const { prompt, aspect_ratio, output_format, negative_prompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing 'prompt' parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Build multipart form-data
    const formData = new FormData();
    formData.append("prompt", prompt);
    formData.append("model", "sd3.5-large");
    formData.append("output_format", output_format || "png");
    if (aspect_ratio) formData.append("aspect_ratio", aspect_ratio);
    if (negative_prompt) formData.append("negative_prompt", negative_prompt);

    const stabilityRes = await fetch("https://api.stability.ai/v2beta/stable-image/generate/sd3", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STABILITY_KEY}`,
        "Accept": "application/json",
      },
      body: formData,
    });

    if (!stabilityRes.ok) {
      const errText = await stabilityRes.text();
      return new Response(JSON.stringify({ error: "Stability API error", message: errText }), {
        status: stabilityRes.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await stabilityRes.json();

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
