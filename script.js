const WORKER_URL = "https://quickwin-lab-smart-cooperative-api.tong-wasin.workers.dev";

const form = document.getElementById("quickWinForm");
const statusMessage = document.getElementById("statusMessage");
const imagePreview = document.getElementById("imagePreview");
const projectDetailPreview = document.getElementById("projectDetailPreview");
const imageState = document.getElementById("imageState");
const detailState = document.getElementById("detailState");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const copyProjectBtn = document.getElementById("copyProjectBtn");
const oneMinuteSummary = document.getElementById("oneMinuteSummary");

let currentStep = 1;
let generatedImage = null;
let generatedDetail = "";
let lastAutoQuickWinName = "";
let isBusy = false;

const scoreCriteria = ["Impact", "Speed", "Feasibility", "DataUse", "Scalability"];
const scoreFieldMap = {
  Impact: "impact",
  Speed: "speed",
  Feasibility: "feasibility",
  DataUse: "dataUse",
  Scalability: "scalability",
};
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
  isBusy = isLoading;
  document.body.classList.toggle("loading", isLoading);
  const apiReady = isApiReady();
  [
    "generateImageBtn",
    "generateDetailBtn",
    "calculateBtn",
    "downloadPngBtn",
    "copyProjectBtn",
    "resetBtn",
    "nextBtn",
    "backBtn",
  ].forEach((id) => {
    const element = byId(id);
    if (!element) return;
    const blockedByResult = (id === "downloadPngBtn" && !generatedImage) || (id === "copyProjectBtn" && !generatedDetail);
    const blockedByStep = id === "backBtn" && currentStep === 1;
    const blockedByApi = (id === "generateImageBtn" || id === "generateDetailBtn") && !apiReady;
    element.disabled = isLoading || blockedByResult || blockedByStep || blockedByApi;
  });
  if (message) setStatus(message);
}

function updateActionButtons() {
  setLoading(isBusy);
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
    index,
    name: byId(`idea${index}Name`).value.trim(),
    action: byId(`idea${index}Action`).value.trim(),
    benefit: byId(`idea${index}Benefit`).value.trim(),
  };
}

function ideaText(idea) {
  if (!idea.name && !idea.action && !idea.benefit) return "";
  return [idea.name, idea.action, idea.benefit].filter(Boolean).join(" | ");
}

function scoreInputId(index, criterion) {
  return `idea${index}${criterion}`;
}

function getIdeaScore(index) {
  const values = Object.fromEntries(
    scoreCriteria.map((criterion) => [scoreFieldMap[criterion], Number(byId(scoreInputId(index, criterion)).value || 0)])
  );
  const totalScore = Object.values(values).reduce((sum, value) => sum + value, 0);
  return { ...values, totalScore };
}

function getScoredIdeas() {
  return [1, 2, 3].map((index) => {
    const idea = getIdea(index);
    const score = getIdeaScore(index);
    return { ...idea, text: ideaText(idea), ...score };
  });
}

function selectedIdeaInfo() {
  const ideas = getScoredIdeas();
  const namedIdeas = ideas.filter((idea) => idea.name || idea.action || idea.benefit);
  const candidates = namedIdeas.length ? namedIdeas : ideas;
  return candidates.reduce((winner, idea) => {
    if (!winner) return idea;
    if (idea.totalScore > winner.totalScore) return idea;
    if (idea.totalScore === winner.totalScore && idea.feasibility > winner.feasibility) return idea;
    return winner;
  }, null);
}

function selectedIdeaText() {
  const winner = selectedIdeaInfo();
  return winner?.text || "";
}

function scoreInterpretation(total) {
  if (total >= 21) return "เหมาะมาก ควรเลือกเป็น Quick Win หลัก";
  if (total >= 16) return "เหมาะสม แต่ควรปรับแผนให้ชัดขึ้น";
  if (total >= 11) return "พอทำได้ แต่ยังไม่ใช่ Quick Win ที่ดี";
  return "ยังไม่เหมาะ ควรเปลี่ยนหรือปรับให้เล็กลง";
}

function calculateScore() {
  const ideas = getScoredIdeas();
  const selected = selectedIdeaInfo();
  const hasSelectedIdea = Boolean(selected?.text);
  const total = selected?.totalScore || 0;
  const interpretation = scoreInterpretation(total);

  byId("totalScore").textContent = `${total}/25`;
  byId("scoreInterpretation").textContent = hasSelectedIdea
    ? `ไอเดียที่ ${selected.index}: ${selected.name || selected.action || "ยังไม่ตั้งชื่อ"} - ${interpretation}`
    : interpretation;
  byId("heroScore").textContent = `${total}/25`;
  byId("heroResult").textContent = hasSelectedIdea ? `ไอเดียที่ ${selected.index}: ${interpretation}` : "เริ่มให้คะแนนเพื่อดูผลประเมิน";
  byId("selectedIdeaName").textContent = hasSelectedIdea ? `ไอเดียที่ ${selected.index}: ${selected.name || selected.action || "ยังไม่ตั้งชื่อ"}` : "ยังไม่มีไอเดียที่พร้อมประเมิน";
  byId("selectedIdeaReason").textContent = hasSelectedIdea
    ? `คะแนนสูงสุด ${total}/25 - ระบบจะใช้ไอเดียนี้เป็นโครงการหลัก`
    : "กรอกชื่อไอเดียและให้คะแนนทุกไอเดียเพื่อเลือกโครงการหลัก";
  byId("feasibilityWarning").classList.toggle("hidden", !hasSelectedIdea || selected.feasibility >= 3);

  ideas.forEach((idea) => {
    byId(`idea${idea.index}Total`).textContent = `${idea.totalScore}/25`;
    byId(`idea${idea.index}ScoreTitle`).textContent = idea.name || `ไอเดียที่ ${idea.index}`;
    document.querySelector(`[data-idea-score-card="${idea.index}"]`)?.classList.toggle("selected", selected?.index === idea.index);
    scoreCriteria.forEach((criterion) => {
      const input = byId(scoreInputId(idea.index, criterion));
      const output = input.parentElement.querySelector("output");
      output.value = input.value;
      output.textContent = input.value;
    });
  });

  syncQuickWinName(selected);
  updateSummary();
  return { ...selected, totalScore: total, interpretation };
}

function syncQuickWinName(selected) {
  if (!selected?.name) return;
  const quickWinName = byId("quickWinName");
  if (!quickWinName.value.trim() || quickWinName.value.trim() === lastAutoQuickWinName) {
    quickWinName.value = selected.name;
    lastAutoQuickWinName = selected.name;
  }
}

function collectData() {
  const painPointChoice = getRadioValue("painPoint");
  const painPoint = painPointChoice === "อื่น ๆ" ? byId("otherPainPoint").value.trim() || "อื่น ๆ" : painPointChoice;
  const score = calculateScore();
  const ideaScores = getScoredIdeas();
  const selectedIdea = selectedIdeaInfo();

  return {
    groupName: byId("groupName").value.trim(),
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
    ideaScores,
    selectedIdeaIndex: selectedIdea?.index || 0,
    selectedIdea: selectedIdea?.text || "",
    quickWinName: byId("quickWinName").value.trim(),
    goal90: byId("goal90").value.trim(),
    plan30: byId("plan30").value.trim(),
    plan60: byId("plan60").value.trim(),
    plan90: byId("plan90").value.trim(),
    resources: byId("resources").value.trim(),
    risk: byId("risk").value.trim(),
    riskMitigation: byId("riskMitigation").value.trim(),
    kpi1: byId("kpi1").value.trim(),
    kpi2: byId("kpi2").value.trim(),
    kpi3: byId("kpi3").value.trim(),
    impact: score.impact || 0,
    speed: score.speed || 0,
    feasibility: score.feasibility || 0,
    dataUse: score.dataUse || 0,
    scalability: score.scalability || 0,
    totalScore: score.totalScore || 0,
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
  const missing = getMissingRequiredFields(data);

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

function getMissingRequiredFields(data = null) {
  const needsOtherPainPoint = getRadioValue("painPoint") === "อื่น ๆ" && !byId("otherPainPoint").value.trim();
  const source = data || {
    groupName: byId("groupName").value.trim(),
    coopType: getRadioValue("coopType"),
    painPoint: getRadioValue("painPoint") === "อื่น ๆ" ? byId("otherPainPoint").value.trim() : getRadioValue("painPoint"),
    painPointDetail: byId("painPointDetail").value.trim(),
    quickWinName: byId("quickWinName").value.trim(),
    goal90: byId("goal90").value.trim(),
    plan30: byId("plan30").value.trim(),
    plan60: byId("plan60").value.trim(),
    plan90: byId("plan90").value.trim(),
    kpi1: byId("kpi1").value.trim(),
    selectedIdea: selectedIdeaText(),
  };
  const missing = requiredForApi.filter((key) => !source[key]);
  if (needsOtherPainPoint) missing.push("painPoint");
  if (!source.selectedIdea) missing.push("selectedIdea");
  return [...new Set(missing)];
}

function isApiReady() {
  return getMissingRequiredFields().length === 0 && !WORKER_URL.includes("YOUR-WORKER-NAME");
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
    setLoading(true, "กำลังเขียนข้อมูลโครงการจาก Gemini...");
    const result = await callWorker("generate_project_detail", data);
    generatedDetail = result.projectDetail || "";
    projectDetailPreview.textContent = generatedDetail;
    detailState.textContent = "สร้างสำเร็จ";
    copyProjectBtn.disabled = false;
    setStatus("สร้างข้อมูลโครงการสำเร็จ สามารถคัดลอกไปใช้งานต่อได้", "success");
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

async function copyProjectDetail() {
  if (!generatedDetail) return;
  try {
    await navigator.clipboard.writeText(generatedDetail);
    setStatus("คัดลอกข้อมูลโครงการแล้ว", "success");
  } catch (error) {
    setStatus("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความข้อมูลโครงการแล้วคัดลอกด้วยตนเอง", "error");
  }
}

function resetForm() {
  form.reset();
  generatedImage = null;
  generatedDetail = "";
  lastAutoQuickWinName = "";
  imagePreview.innerHTML = "<p>ภาพจาก Gemini จะแสดงที่นี่</p>";
  projectDetailPreview.innerHTML = "<p>ข้อมูลโครงการจาก Gemini จะแสดงที่นี่ และสามารถกด Copy ข้อมูลโครงการ เพื่อนำไปใช้ต่อได้</p>";
  imageState.textContent = "ยังไม่ได้สร้าง";
  detailState.textContent = "ยังไม่ได้สร้าง";
  downloadPngBtn.disabled = true;
  copyProjectBtn.disabled = true;
  setStatus("");
  calculateScore();
  updateActionButtons();
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
copyProjectBtn.addEventListener("click", copyProjectDetail);
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
  updateActionButtons();
});

form.addEventListener("change", () => {
  byId("otherPainWrap").classList.toggle("hidden", getRadioValue("painPoint") !== "อื่น ๆ");
  calculateScore();
  updateIdeaLabels();
  updateActionButtons();
});

function updateIdeaLabels() {
  [1, 2, 3].forEach((index) => {
    const ideaName = byId(`idea${index}Name`).value.trim();
    const title = byId(`idea${index}ScoreTitle`);
    if (title) title.textContent = ideaName || `ไอเดียที่ ${index}`;
  });
}

calculateScore();
updateActionButtons();
showStep(1);
