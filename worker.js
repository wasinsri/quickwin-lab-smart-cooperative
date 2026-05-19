const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const MAX_REQUEST_BYTES = 32 * 1024;

// GitHub Pages origin. Add more origins here if you use a custom domain.
const ALLOWED_ORIGINS = [
  "https://wasinsri.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return jsonResponse({ success: false, error: "รองรับเฉพาะ POST request" }, 405, corsHeaders);
    if (!isOriginAllowed(origin)) return jsonResponse({ success: false, error: "Origin นี้ไม่ได้รับอนุญาตให้เรียก API" }, 403, corsHeaders);
    if (!env.GEMINI_API_KEY) return jsonResponse({ success: false, error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Worker Secret" }, 500, corsHeaders);

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) return jsonResponse({ success: false, error: "ข้อมูลที่ส่งมีขนาดใหญ่เกินไป" }, 413, corsHeaders);

    let payload;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) return jsonResponse({ success: false, error: "ข้อมูลที่ส่งมีขนาดใหญ่เกินไป" }, 413, corsHeaders);
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ success: false, error: "รูปแบบ JSON ไม่ถูกต้อง" }, 400, corsHeaders);
    }

    const { action, data } = payload || {};
    if (!action || !data || typeof data !== "object") return jsonResponse({ success: false, error: "Request ต้องมี action และ data" }, 400, corsHeaders);

    try {
      if (action === "generate_image") return jsonResponse({ success: true, ...(await generateImage(env.GEMINI_API_KEY, data)) }, 200, corsHeaders);
      if (action === "generate_project_detail") return jsonResponse({ success: true, projectDetail: await generateProjectDetail(env.GEMINI_API_KEY, data) }, 200, corsHeaders);
      return jsonResponse({ success: false, error: "action ไม่ถูกต้อง" }, 400, corsHeaders);
    } catch (error) {
      return jsonResponse({ success: false, error: error.message || "เกิดข้อผิดพลาดจาก Gemini API" }, 500, corsHeaders);
    }
  },
};

function isOriginAllowed(origin) {
  return !origin || ALLOWED_ORIGINS.includes(origin);
}

function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) && origin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}

async function generateImage(apiKey, data) {
  const response = await callGemini(apiKey, GEMINI_IMAGE_MODEL, {
    contents: [{ role: "user", parts: [{ text: buildImagePrompt(data) }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"], temperature: 0.8 },
  });
  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) throw new Error("Gemini ไม่ได้ส่งภาพกลับมา กรุณาลองปรับข้อมูลโครงการให้ชัดขึ้น");
  return { imageBase64: inlineData.data, mimeType: inlineData.mimeType || inlineData.mime_type || "image/png" };
}

async function generateProjectDetail(apiKey, data) {
  const response = await callGemini(apiKey, GEMINI_TEXT_MODEL, {
    contents: [{ role: "user", parts: [{ text: buildProjectDetailPrompt(data) }] }],
    generationConfig: { temperature: 0.35, maxOutputTokens: 2400 },
  });
  const text = (response?.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini ไม่ได้ส่งรายละเอียดโครงการกลับมา");
  return text;
}

async function callGemini(apiKey, model, body) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || "เรียก Gemini API ไม่สำเร็จ");
  return result;
}

function buildImagePrompt(data) {
  return `สร้างภาพอินโฟกราฟิกภาษาไทย 1 หน้า อัตราส่วน 16:9 สำหรับนำเสนอ Workshop หัวข้อโครงการ Quick Win ขับเคลื่อน Smart Cooperative 6.0 โทนสีเขียว น้ำเงิน ทอง สไตล์เกษตรดิจิทัล สหกรณ์อัจฉริยะ มีเจ้าหน้าที่สหกรณ์ เกษตรกร dashboard ข้อมูล ไอคอน Data, AI, Governance, Cybersecurity, Market, Climate Resilience ข้อความอ่านง่าย ไม่แน่นเกินไป ห้ามใส่โลโก้และเลขหน้า
ข้อมูล: ชื่อโครงการ ${clean(data.quickWinName)}, ประเภทสหกรณ์ ${clean(data.coopType)}, Pain Point ${clean(data.painPoint)}, Quick Win ${clean(data.selectedIdea)}, เป้าหมาย 90 วัน ${clean(data.goal90)}, Timeline 0-30 ${clean(data.plan30)}, 31-60 ${clean(data.plan60)}, 61-90 ${clean(data.plan90)}, KPI ${clean([data.kpi1, data.kpi2, data.kpi3].filter(Boolean).join(" | "))}, คะแนน ${Number(data.totalScore || 0)}/25`;
}

function buildProjectDetailPrompt(data) {
  return `กรุณาเขียนรายละเอียดโครงการ Quick Win ภาษาไทยแบบเป็นทางการ กระชับ พร้อมใช้ในรายงาน Workshop สำหรับผู้บริหารงานส่งเสริมสหกรณ์ เน้นเริ่มได้เร็ว เห็นผลใน 90 วัน ใช้ข้อมูลนำทาง และขยายผลได้
ข้อมูลฟอร์ม: ${JSON.stringify(data)}
จัดหัวข้อ: 1. ชื่อโครงการ 2. ประเภทสหกรณ์เป้าหมาย 3. หลักการและเหตุผล 4. Pain Point ที่ต้องการแก้ไข 5. วัตถุประสงค์ 6. เป้าหมายภายใน 90 วัน 7. กลุ่มเป้าหมายและผู้ได้รับประโยชน์ 8. แผนดำเนินงาน 0-30 / 31-60 / 61-90 วัน 9. ทรัพยากรที่ต้องใช้ 10. ตัวชี้วัดความสำเร็จ 11. คะแนนประเมิน Quick Win 12. ความเสี่ยงและแนวทางลดความเสี่ยง 13. ผลลัพธ์ที่คาดหวัง 14. แนวทางขยายผล 15. ข้อสรุปสำหรับการนำเสนอ 1 นาที`;
}

function clean(value) {
  return String(value || "-").replace(/[<>]/g, "").slice(0, 1200);
}
