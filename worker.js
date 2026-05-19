const GEMINI_TEXT_MODEL = "gemini-3.1-flash-lite";
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
const MAX_REQUEST_BYTES = 32 * 1024;

// TODO: เปลี่ยนเป็นโดเมน GitHub Pages จริงของคุณก่อนใช้งานจริง
// ตัวอย่าง: "https://your-user.github.io"
const ALLOWED_ORIGINS = [
  "https://wasinsri.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "รองรับเฉพาะ POST request" }, 405, corsHeaders);
    }

    if (!isOriginAllowed(origin)) {
      return jsonResponse({ success: false, error: "Origin นี้ไม่ได้รับอนุญาตให้เรียก API" }, 403, corsHeaders);
    }

    if (!env.GEMINI_API_KEY) {
      return jsonResponse({ success: false, error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Worker Secret" }, 500, corsHeaders);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ success: false, error: "ข้อมูลที่ส่งมีขนาดใหญ่เกินไป" }, 413, corsHeaders);
    }

    let payload;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
        return jsonResponse({ success: false, error: "ข้อมูลที่ส่งมีขนาดใหญ่เกินไป" }, 413, corsHeaders);
      }
      payload = JSON.parse(rawBody);
    } catch (error) {
      return jsonResponse({ success: false, error: "รูปแบบ JSON ไม่ถูกต้อง" }, 400, corsHeaders);
    }

    const { action, data } = payload || {};
    if (!action || !data || typeof data !== "object") {
      return jsonResponse({ success: false, error: "Request ต้องมี action และ data" }, 400, corsHeaders);
    }

    try {
      if (action === "generate_image") {
        const imageResult = await generateImage(env.GEMINI_API_KEY, data);
        return jsonResponse({ success: true, ...imageResult }, 200, corsHeaders);
      }

      if (action === "generate_project_detail") {
        const projectDetail = await generateProjectDetail(env.GEMINI_API_KEY, data);
        return jsonResponse({ success: true, projectDetail }, 200, corsHeaders);
      }

      return jsonResponse({ success: false, error: "action ไม่ถูกต้อง" }, 400, corsHeaders);
    } catch (error) {
      return jsonResponse({ success: false, error: error.message || "เกิดข้อผิดพลาดจาก Gemini API" }, 500, corsHeaders);
    }
  },
};

function isOriginAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function buildCorsHeaders(origin) {
  const allowOrigin = isOriginAllowed(origin) && origin ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

async function generateImage(apiKey, data) {
  const prompt = buildImagePrompt(data);
  const response = await callGemini(apiKey, GEMINI_IMAGE_MODEL, {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      temperature: 0.8,
    },
  });

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;

  if (!inlineData?.data) {
    throw new Error("Gemini ไม่ได้ส่งภาพกลับมา กรุณาลองปรับข้อมูลโครงการให้ชัดขึ้น");
  }

  return {
    imageBase64: inlineData.data,
    mimeType: inlineData.mimeType || inlineData.mime_type || "image/png",
  };
}

async function generateProjectDetail(apiKey, data) {
  const prompt = buildProjectDetailPrompt(data);
  const response = await callGemini(apiKey, GEMINI_TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 2400,
    },
  });

  const parts = response?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text || "").join("\n").trim();

  if (!text) {
    throw new Error("Gemini ไม่ได้ส่งข้อมูลโครงการกลับมา");
  }

  return text;
}

async function callGemini(apiKey, model, body) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.error?.message || "เรียก Gemini API ไม่สำเร็จ";
    throw new Error(message);
  }
  return result;
}

function buildImagePrompt(data) {
  return `
สร้างภาพอินโฟกราฟิกภาษาไทย 1 หน้า อัตราส่วน 16:9 สำหรับนำเสนอใน Workshop
หัวข้อ: โครงการ Quick Win ขับเคลื่อน Smart Cooperative 6.0
ใช้โทนสีเขียว น้ำเงิน ทอง สไตล์เกษตรดิจิทัล สหกรณ์อัจฉริยะ
ให้มีองค์ประกอบภาพ เช่น เจ้าหน้าที่สหกรณ์ เกษตรกร dashboard ข้อมูล และรูปภาพที่เกี่ยวข้องกับเนื้อหา
ข้อความต้องอ่านง่าย ไม่แน่นเกินไป เหมาะสำหรับใช้เป็นสไลด์นำเสนอ

ข้อมูลที่ต้องแสดงในภาพ:
- ชื่อโครงการ: ${clean(data.quickWinName)}
- ประเภทสหกรณ์: ${clean(data.coopType)}
- Pain Point: ${clean(data.painPoint)}
- แนวทาง Quick Win: ${clean(data.selectedIdea)}
- เป้าหมาย 90 วัน: ${clean(data.goal90)}
- Timeline 0–30 วัน: ${clean(data.plan30)}
- Timeline 31–60 วัน: ${clean(data.plan60)}
- Timeline 61–90 วัน: ${clean(data.plan90)}
- KPI สำคัญ: ${clean([data.kpi1, data.kpi2, data.kpi3].filter(Boolean).join(" | "))}
- คะแนนรวม: ${Number(data.totalScore || 0)}/25
- ผลลัพธ์ที่คาดหวัง: ${clean(data.goal90)}

ห้ามใส่โลโก้หน่วยงาน
ห้ามใส่เลขหน้า
ให้จัดวางแบบมืออาชีพ สดใส อ่านง่าย
`.trim();
}

function buildProjectDetailPrompt(data) {
  const selectedIdea = getSelectedIdea(data);
  const kpis = [data.kpi1, data.kpi2, data.kpi3].filter(Boolean).join(" | ");

  return `
กรุณาเขียนข้อมูลโครงการ Quick Win ภาษาไทยแบบเป็นทางการ กระชับ อ่านง่าย และพร้อมนำไปใช้ต่อในเอกสาร Workshop
ให้ใช้เฉพาะข้อมูลทั่วไปของกลุ่ม สถานการณ์สหกรณ์ Pain Point และข้อมูลของไอเดียที่มีคะแนนสูงสุดเป็นแกนหลักในการเขียนโครงการ
ห้ามนำไอเดียอื่นที่ไม่ได้คะแนนสูงสุดมาเป็นโครงการหลัก

ข้อมูลทั่วไป:

ชื่อกลุ่ม: ${clean(data.groupName)}
ชื่อผู้ประสานงาน: ${clean(data.coordinator)}
หน่วยงาน / จังหวัด: ${clean(data.organization)}
ประเภทสหกรณ์: ${clean(data.coopType)}
บริบทสหกรณ์: ${clean(data.context)}
สมาชิกหลัก: ${clean(data.members)}
บริการ / สินค้า / ภารกิจหลัก: ${clean(data.mainService)}
Pain Point: ${clean(data.painPoint)}
รายละเอียด Pain Point: ${clean(data.painPointDetail)}
เหตุผลความสำคัญ: ${clean(data.whyImportant)}

ไอเดียที่มีคะแนนสูงสุด:
ลำดับไอเดีย: ${Number(selectedIdea.index || data.selectedIdeaIndex || 0)}
ชื่อไอเดีย: ${clean(selectedIdea.name || data.quickWinName)}
แนวทางดำเนินงานของไอเดีย: ${clean(selectedIdea.action || data.selectedIdea)}
ผู้ได้รับประโยชน์จากไอเดีย: ${clean(selectedIdea.benefit)}
ชื่อโครงการ Quick Win: ${clean(data.quickWinName)}
เป้าหมาย 90 วัน: ${clean(data.goal90)}
แผน 0–30 วัน: ${clean(data.plan30)}
แผน 31–60 วัน: ${clean(data.plan60)}
แผน 61–90 วัน: ${clean(data.plan90)}
ผู้รับผิดชอบหลัก: ${clean(data.owner)}
ทรัพยากรที่ต้องใช้: ${clean(data.resources)}
ความเสี่ยง: ${clean(data.risk)}
วิธีลดความเสี่ยง: ${clean(data.riskMitigation)}
KPI: ${clean(kpis)}
คะแนน Quick Win: Impact ${Number(data.impact || 0)}, Speed ${Number(data.speed || 0)}, Feasibility ${Number(data.feasibility || 0)}, Data Use ${Number(data.dataUse || 0)}, Scalability ${Number(data.scalability || 0)}, รวม ${Number(data.totalScore || 0)}/25

กรุณาจัดรูปแบบเป็นหัวข้อ:
1. ชื่อโครงการ ภาษาไทยและภาษาอังกฤษ
2. ที่มาและความสำคัญ
   เขียน 3-4 ย่อหน้า ความยาวรวมประมาณ 15 บรรทัด อธิบายสถานการณ์ปัจจุบัน ปัญหา เหตุผลความสำคัญ และความจำเป็นของ Quick Win
3. วัตถุประสงค์
   เขียน 2-3 ข้อ
4. กลุ่มเป้าหมาย
5. ขั้นตอนการดำเนินงาน
   เขียน 4-5 ข้อ
6. แผนงานดำเนินงาน (ภายใน 90 วัน)
   แยกเป็นระยะ 0–30 วัน, 31–60 วัน, 61–90 วัน
7. ความพร้อมในการดำเนินงาน
   โดยอ้างอิงคะแนนและคำอธิบายในแต่ละช่วงคะแนน ทั้ง 5 ด้าน ได้แก่ Impact, Speed, Feasibility, Data Use, Scalability และคะแนนรวม /25
8. ความเสี่ยงและแนวทางแก้ไข
9. ประโยชน์ที่ได้รับ
   เขียน 2-3 ข้อ
สำนวนต้องเหมาะกับผู้บริหารงานส่งเสริมสหกรณ์
ใช้ภาษาราชการที่อ่านง่าย
เน้นว่าโครงการเริ่มได้เร็ว เห็นผลภายใน 90 วัน ใช้ข้อมูลนำทาง และมีความเป็นไปได้ตามคะแนนประเมิน
ให้ส่งกลับเป็นข้อความล้วน ไม่ใช้ Markdown table และไม่ต้องใส่คำอธิบายก่อนหรือหลังเอกสาร
`.trim();
}

function getSelectedIdea(data) {
  if (!Array.isArray(data.ideaScores)) {
    return {};
  }

  const selectedIndex = Number(data.selectedIdeaIndex || 0);
  const selected = data.ideaScores.find((idea) => Number(idea.index) === selectedIndex);
  if (selected) return selected;

  return data.ideaScores.reduce((winner, idea) => {
    if (!winner) return idea;
    if (Number(idea.totalScore || 0) > Number(winner.totalScore || 0)) return idea;
    return winner;
  }, {});
}

function clean(value) {
  return String(value || "-").replace(/[<>]/g, "").slice(0, 1200);
}
