# Quick Win Lab for Smart Cooperative 6.0

เว็บแอปแบบ Static สำหรับกิจกรรม Workshop 30 นาที ใช้กรอกข้อมูลโครงการ Quick Win ของสหกรณ์ คำนวณคะแนน สร้างภาพสรุปโครงการ และสร้างรายละเอียดโครงการผ่าน Cloudflare Worker ที่เรียก Gemini API โดยไม่เปิดเผย API Key ในหน้าเว็บ

## ไฟล์ในโปรเจกต์

- `index.html` หน้า Workshop สำหรับ GitHub Pages
- `style.css` รูปแบบหน้าจอ Responsive และ Print
- `script.js` การคำนวณคะแนน ฟอร์ม การเรียก Worker ดาวน์โหลด PNG และพิมพ์ PDF
- `worker.js` Cloudflare Worker สำหรับซ่อน Gemini API Key และเรียก Gemini API
- `README.md` คู่มือ deploy และใช้งาน

## 1. Deploy GitHub Pages

1. สร้าง GitHub repository ใหม่
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repository
3. ไปที่ `Settings > Pages`
4. เลือก `Deploy from a branch`
5. เลือก branch เช่น `main` และ folder เป็น `/root`
6. กด Save
7. รอ GitHub Pages สร้าง URL: `https://wasinsri.github.io/quickwin-lab-smart-cooperative/`

## 2. สร้าง Cloudflare Worker

1. เข้า Cloudflare Dashboard
2. ไปที่ `Workers & Pages`
3. เลือก `Create application`
4. เลือก `Create Worker`
5. นำโค้ดจาก `worker.js` ไปวางแทนโค้ดเดิม
6. แก้ `ALLOWED_ORIGINS` ใน `worker.js` ให้ตรงกับ GitHub Pages ของคุณ

ตัวอย่าง:

```js
const ALLOWED_ORIGINS = [
  "https://wasinsri.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];
```

## 3. ใส่ GEMINI_API_KEY เป็น Secret

1. เปิด Worker ที่สร้างไว้
2. ไปที่ `Settings > Variables`
3. เพิ่ม Secret ชื่อ `GEMINI_API_KEY`
4. ใส่ Gemini API Key ของคุณ
5. กด Save and deploy

ห้ามใส่ Gemini API Key ใน `index.html`, `script.js` หรือไฟล์ frontend ใด ๆ

## 4. แก้ WORKER_URL ใน script.js

เปิดไฟล์ `script.js` แล้วแก้บรรทัดนี้:

```js
const WORKER_URL = "https://quickwin-lab-smart-cooperative-api.tong-wasin.workers.dev";
```

ให้เป็น URL จริงของ Cloudflare Worker เช่น:

```js
const WORKER_URL = "https://quickwin-lab-smart-cooperative-api.tong-wasin.workers.dev";
```

จากนั้น commit และ push ขึ้น GitHub อีกครั้ง

## 5. วิธีทดสอบ

1. เปิดหน้า GitHub Pages
2. กรอกข้อมูลสำคัญให้ครบ ได้แก่ ชื่อกลุ่ม ประเภทสหกรณ์ Pain Point ชื่อโครงการ แผน 90 วัน และ KPI
3. เลื่อนคะแนน Impact, Speed, Feasibility, Data Use, Scalability
4. ตรวจว่าคะแนนรวมเปลี่ยนอัตโนมัติ
5. กด `สร้างภาพสรุปโครงการ`
6. เมื่อภาพขึ้น preview ให้กด `Download PNG`
7. กด `สร้างรายละเอียดโครงการ`
8. เมื่อรายละเอียดขึ้น preview ให้กด `Download PDF`
9. ระบบจะเปิดหน้าต่างพิมพ์ ให้เลือก `Save as PDF`

หมายเหตุ: PDF ใช้วิธี Printable HTML เพื่อรองรับภาษาไทยได้เสถียรกว่า jsPDF ในหลาย browser

## 6. วิธีใช้งานในห้อง Workshop

1. แบ่งผู้เข้าอบรมเป็นกลุ่ม
2. ให้แต่ละกลุ่มเปิด GitHub Pages URL
3. ใช้ Step 1–6 กรอกข้อมูลตามลำดับ
4. ให้กลุ่มเลือกไอเดีย Quick Win 1 ไอเดียจาก 3 ไอเดีย
5. ให้คะแนน 5 เกณฑ์ รวมเต็ม 25 คะแนน
6. ใช้สรุป 1 นาทีสำหรับนำเสนอหน้าห้อง
7. หากมีเวลาและอินเทอร์เน็ตพร้อม ให้กดสร้างภาพและรายละเอียดโครงการด้วย Gemini
8. ดาวน์โหลด PNG สำหรับสไลด์ และบันทึก PDF สำหรับรายงานกลุ่ม

## 7. ข้อควรระวังเรื่องค่าใช้จ่าย Gemini API

- การกดสร้างภาพและสร้างรายละเอียดโครงการจะเรียก Gemini API และอาจมีค่าใช้จ่าย
- ควรกำหนดงบประมาณหรือ quota ใน Google AI Studio / Google Cloud
- แนะนำให้ผู้สอนสาธิตการกด Gemini เพียงบางกลุ่ม หากต้องควบคุมค่าใช้จ่าย
- Worker มีการจำกัดขนาด request เบื้องต้น แต่ยังไม่ใช่ระบบ rate limit เต็มรูปแบบ
- ไม่ควรเปิด Worker URL ให้ใช้งานนอกกิจกรรมโดยไม่มีการควบคุมเพิ่มเติม

## หมายเหตุด้าน Gemini API

Worker ใช้ REST endpoint แบบ `generateContent`

- Text model: `gemini-2.5-flash`
- Image model: `gemini-2.5-flash-image`

หาก Google เปลี่ยนชื่อ model ในอนาคต ให้แก้ค่าคงที่ด้านบนของ `worker.js`

## ความปลอดภัยและข้อมูลส่วนบุคคล

- เว็บบน GitHub Pages ไม่เก็บข้อมูลถาวร
- Cloudflare Worker ไม่บันทึกข้อมูลผู้ใช้ถาวร
- Gemini API Key อยู่ใน Worker Secret เท่านั้น
- ควรหลีกเลี่ยงการกรอกข้อมูลส่วนบุคคลที่ละเอียดอ่อนเกินความจำเป็นในกิจกรรม Workshop
