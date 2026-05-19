const WORKER_URL = "https://quickwin-lab-smart-cooperative-api.tong-wasin.workers.dev";

const form = document.getElementById("quickWinForm");
const statusMessage = document.getElementById("statusMessage");
const imagePreview = document.getElementById("imagePreview");
const projectDetailPreview = document.getElementById("projectDetailPreview");
const imageState = document.getElementById("imageState");
const detailState = document.getElementById("detailState");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const oneMinuteSummary = document.getElementById("oneMinuteSummary");

let currentStep = 1;
let generatedImage = null;
let generatedDetail = "";

const scoreFields = ["impact", "speed", "feasibility", "dataUse", "scalability"];
const requiredForApi = [
  "groupName",
  "coopType",
  "painPoint",
  "painPointDetail",
  "quickWinName",
  "goal90",
  "plan30",
  "plan60",
  "plan90",
  "kpi1",
];

function byId(id) {
  return document.getElementById(id);
}

function getRadioValue(name) {
  return form.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function setLoading(isLoading, message = "") {
  document.body.classList.toggle("loading", isLoading);
  [
    "generateImageBtn",
    "generateDetailBtn",
    "calculateBtn",
    "downloadPngBtn",
    "downloadPdfBtn",
    "resetBtn",
    "nextBtn",
    "backBtn",
  ].forEach((id) => {
    const element = byId(id);
    if (!element) return;
    const blockedByResult = (id === "downloadPngBtn" && !generatedImage) || (id === "downloadPdfBtn" && !generatedDetail);
    const blockedByStep = id === "backBtn" && currentStep === 1;
    element.disabled = isLoading || blockedByResult || blockedByStep;
  });
  if (message) setStatus(message);
}

function showStep(step) {
  currentStep = Math.min(6, Math.max(1, step));
  document.querySelectorAll(".step-card").forEach((card) => {
    card.classList.toggle("active", Number(card.dataset.step) === currentStep);
  });
  document.querySelectorAll(".progress-step").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.stepTarget) === currentStep);
  });
  byId("backBtn").disabled = currentStep === 1;
  byId("nextBtn").textContent = currentStep === 6 ? "กลับไปตรวจข้อมูล" : "Next";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function getIdea(index) {
  return {
    name: byId(`idea${index}Name`).value.trim(),
    action: byId(`idea${index}Action`).value.trim(),
    benefit: byId(`idea${index}Benefit`).value.trim(),
  };
}

function selectedIdeaText() {
  const selectedIndex = getRadioValue("selectedIdeaIndex") || "1";
  const idea = getIdea(selectedIndex);
  if (!idea.name && !idea.action && !idea.benefit) return "";
  return [idea.name, idea.action, idea.benefit].filter(Boolean).join(" | ");
}

function calculateScore() {
  const scores = Object.fromEntries(scoreFields.map((field) => [field, Number(byId(field).value || 0)]));
  const total = scoreFields.reduce((sum, field) => sum + scores[field], 0);
  let interpretation = "ยังไม่เหมาะ ควรเปลี่ยนหรือปรับให้เล็กลง";

  if (total >= 21) interpretation = "เหมาะมาก ควรเลือกเป็น Quick Win หลัก";
  else if (total >= 16) interpretation = "เหมาะสม แต่ควรปรับแผนให้ชัดขึ้น";
  else if (total >= 11) interpretation = "พอทำได้ แต่ยังไม่ใช่ Quick Win ที่ดี";

  byId("totalScore").textContent = `${total}/25`;
  byId("scoreInterpretation").textContent = interpretation;
  byId("heroScore").textContent = `${total}/25`;
  byId("heroResult").textContent = interpretation;
  byId("feasibilityWarning").classList.toggle("hidden", scores.feasibility >= 3);

  scoreFields.forEach((field) => {
    const input = byId(field);
    const output = input.parentElement.querySelector("output");
    output.value = input.value;
    output.textContent = input.value;
  });

  updateSummary();
  return { ...scores, totalScore: total, interpretation };
}

function collectData() {
  const painPointChoice = getRadioValue("painPoint");
  const painPoint = painPointChoice === "อื่น ๆ" ? byId("otherPainPoint").value.trim() || "อื่น ๆ" : painPointChoice;
  const score = calculateScore();

  return {
    groupName: byId("groupName").value.trim(),
    coordinator: byId("coordinator").value.trim(),
    organization: byId("organization").value.trim(),
    coopType: getRadioValue("coopType"),
    context: byId("context").value.trim(),
    members: byId("members").value.trim(),
    mainService: byId("mainService").value.trim(),
    painPoint,
    painPointDetail: byId("painPointDetail").value.trim(),
    whyImportant: byId("whyImportant").value.trim(),
    idea1: getIdea(1),
    idea2: getIdea(2),
    idea3: getIdea(3),
    selectedIdea: selectedIdeaText(),
    quickWinName: byId("quickWinName").value.trim(),
    goal90: byId("goal90").value.trim(),
    plan30: byId("plan30").value.trim(),
    plan60: byId("plan60").value.trim(),
    plan90: byId("plan90").value.trim(),
    owner: byId("owner").value.trim(),
    resources: byId("resources").value.trim(),
    risk: byId("risk").value.trim(),
    riskMitigation: byId("riskMitigation").value.trim(),
    kpi1: byId("kpi1").value.trim(),
    kpi2: byId("kpi2").value.trim(),
    kpi3: byId("kpi3").value.trim(),
    impact: score.impact,
    speed: score.speed,
    feasibility: score.feasibility,
    dataUse: score.dataUse,
    scalability: score.scalability,
    totalScore: score.totalScore,
  };
}

function updateSummary() {
  const data = {
    coopType: getRadioValue("coopType") || "...",
    painPoint: getRadioValue("painPoint") === "อื่น ๆ" ? byId("otherPainPoint").value.trim() || "..." : getRadioValue("painPoint") || "...",
    selectedIdea: selectedIdeaText() || byId("quickWinName").value.trim() || "...",
    quickWinName: byId("quickWinName").value.trim() || "...",
    kpis: [byId("kpi1").value.trim(), byId("kpi2").value.trim(), byId("kpi3").value.trim()].filter(Boolean).join(", ") || "...",
  };

  oneMinuteSummary.textContent = [
    `ประเภทสหกรณ์ที่เราเลือกคือ ${data.coopType}`,
    `Pain Point สำคัญคือ ${data.painPoint}`,
    `Quick Win ที่เราเลือกคือ ${data.quickWinName !== "..." ? data.quickWinName : data.selectedIdea}`,
    `ภายใน 90 วัน เราจะวัดผลจาก ${data.kpis}`,
  ].join("\n");
}

function validateForApi() {
  const data = collectData();
  const missing = requiredForApi.filter((key) => !data[key]);
  if (!data.selectedIdea) missing.push("selectedIdea");

  if (missing.length) {
    setStatus("กรุณากรอกข้อมูลสำคัญให้ครบก่อนส่งสร้างผลลัพธ์ เช่น ชื่อกลุ่ม ประเภทสหกรณ์ Pain Point โครงการ แผน และ KPI", "error");
    return null;
  }

  if (WORKER_URL.includes("YOUR-WORKER-NAME")) {
    setStatus("ยังไม่ได้ตั้งค่า WORKER_URL ใน script.js กรุณาแก้เป็น URL ของ Cloudflare Worker ก่อนเรียก Gemini", "error");
    return null;
  }

  return data;
}

async function callWorker(action, data) {
  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "ไม่สามารถเชื่อมต่อ API ได้ กรุณาตรวจสอบ Worker URL และ Gemini API Key");
  }
  return payload;
}

async function generateImage() {
  const data = validateForApi();
  if (!data) return;

  try {
    setLoading(true, "กำลังสร้างภาพสรุปโครงการจาก Gemini...");
    const result = await callWorker("generate_image", data);
    generatedImage = {
      base64: result.imageBase64,
      mimeType: result.mimeType || "image/png",
    };

    const src = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
    imagePreview.innerHTML = "";
    const image = document.createElement("img");
    image.src = src;
    image.alt = `ภาพสรุปโครงการ ${data.quickWinName}`;
    imagePreview.appendChild(image);
    imageState.textContent = "สร้างสำเร็จ";
    downloadPngBtn.disabled = false;
    setStatus("สร้างภาพสรุปโครงการสำเร็จ", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function generateDetail() {
  const data = validateForApi();
  if (!data) return;

  try {
    setLoading(true, "กำลังเขียนรายละเอียดโครงการจาก Gemini...");
    const result = await callWorker("generate_project_detail", data);
    generatedDetail = result.projectDetail || "";
    projectDetailPreview.textContent = generatedDetail;
    detailState.textContent = "สร้างสำเร็จ";
    downloadPdfBtn.disabled = false;
    setStatus("สร้างรายละเอียดโครงการสำเร็จ", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function downloadPng() {
  if (!generatedImage) return;
  const data = collectData();
  const link = document.createElement("a");
  link.href = `data:${generatedImage.mimeType};base64,${generatedImage.base64}`;
  link.download = `${safeFileName(data.quickWinName || "quick-win-summary")}.png`;
  link.click();
}

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 80);
}

function buildPrintableDocument() {
  const data = collectData();
  const printRoot = document.createElement("main");
  printRoot.className = "print-document";
  printRoot.id = "printDocument";

  const sections = [
    ["ชื่อโครงการ", data.quickWinName],
    ["ประเภทสหกรณ์", data.coopType],
    ["Pain Point", data.painPoint],
    ["เหตุผลความสำคัญ", data.whyImportant || data.painPointDetail],
    ["วัตถุประสงค์", data.selectedIdea],
    ["เป้าหมาย 90 วัน", data.goal90],
    ["แผนดำเนินงาน 0–30 วัน", data.plan30],
    ["แผนดำเนินงาน 31–60 วัน", data.plan60],
    ["แผนดำเนินงาน 61–90 วัน", data.plan90],
    ["KPI", [data.kpi1, data.kpi2, data.kpi3].filter(Boolean).join("\n")],
    ["คะแนนประเมิน", `${data.totalScore}/25`],
    ["ความเสี่ยงและวิธีลดความเสี่ยง", [data.risk, data.riskMitigation].filter(Boolean).join("\n")],
    ["ผลลัพธ์ที่คาดหวัง", data.goal90],
    ["แนวทางขยายผล", "นำบทเรียน เครื่องมือ และตัวชี้วัดไปปรับใช้กับสหกรณ์ประเภทเดียวกันหรือพื้นที่ใกล้เคียง"],
  ];

  const title = document.createElement("h1");
  title.textContent = data.quickWinName || "รายละเอียดโครงการ Quick Win";
  printRoot.appendChild(title);

  if (generatedDetail) {
    const detail = document.createElement("section");
    detail.textContent = generatedDetail;
    printRoot.appendChild(detail);
  } else {
    sections.forEach(([heading, body]) => {
      const h2 = document.createElement("h2");
      h2.textContent = heading;
      const p = document.createElement("p");
      p.textContent = body || "-";
      printRoot.append(h2, p);
    });
  }

  document.getElementById("printDocument")?.remove();
  document.body.appendChild(printRoot);
}

function downloadPdf() {
  buildPrintableDocument();
  setStatus("เปิดหน้าต่างพิมพ์แล้ว เลือก Save as PDF เพื่อบันทึกไฟล์ PDF ภาษาไทย", "success");
  window.print();
}

function resetForm() {
  form.reset();
  generatedImage = null;
  generatedDetail = "";
  imagePreview.innerHTML = "<p>ภาพจาก Gemini จะแสดงที่นี่</p>";
  projectDetailPreview.innerHTML = "<p>รายละเอียดโครงการจาก Gemini จะแสดงที่นี่</p>";
  imageState.textContent = "ยังไม่ได้สร้าง";
  detailState.textContent = "ยังไม่ได้สร้าง";
  downloadPngBtn.disabled = true;
  downloadPdfBtn.disabled = true;
  setStatus("");
  calculateScore();
  showStep(1);
}

document.querySelectorAll(".progress-step").forEach((button) => {
  button.addEventListener("click", () => showStep(Number(button.dataset.stepTarget)));
});

byId("nextBtn").addEventListener("click", () => {
  if (currentStep === 6) showStep(1);
  else showStep(currentStep + 1);
});

byId("backBtn").addEventListener("click", () => showStep(currentStep - 1));
byId("calculateBtn").addEventListener("click", () => {
  const score = calculateScore();
  setStatus(`คำนวณคะแนนแล้ว: ${score.totalScore}/25 - ${score.interpretation}`, "success");
});
byId("generateImageBtn").addEventListener("click", generateImage);
byId("generateDetailBtn").addEventListener("click", generateDetail);
downloadPngBtn.addEventListener("click", downloadPng);
downloadPdfBtn.addEventListener("click", downloadPdf);
byId("resetBtn").addEventListener("click", resetForm);
byId("copySummaryBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(oneMinuteSummary.textContent);
    setStatus("คัดลอกสรุป 1 นาทีแล้ว", "success");
  } catch (error) {
    setStatus("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความสรุปแล้วคัดลอกด้วยตนเอง", "error");
  }
});

form.addEventListener("input", () => {
  calculateScore();
  updateIdeaLabels();
});

form.addEventListener("change", () => {
  byId("otherPainWrap").classList.toggle("hidden", getRadioValue("painPoint") !== "อื่น ๆ");
  calculateScore();
  updateIdeaLabels();
});

function updateIdeaLabels() {
  document.querySelectorAll("#selectedIdeaOptions label").forEach((label, index) => {
    const ideaName = byId(`idea${index + 1}Name`).value.trim();
    label.lastChild.textContent = ideaName ? ` ${ideaName}` : ` ไอเดียที่ ${index + 1}`;
  });
}

calculateScore();
showStep(1);
