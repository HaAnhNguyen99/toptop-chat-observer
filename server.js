// Server tự host: chạy trình duyệt đọc chat TikTok Live → đẩy realtime tới dashboard qua WebSocket.
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { startScraper } = require('./scraper');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const args = process.argv.slice(2);
const MOCK = args.includes('--mock');
const userArg = args.find((a) => !a.startsWith('--'));
if (userArg) config.username = userArg.replace(/^@/, '');
if (args.includes('--headless')) config.headless = true;
if (MOCK) config.username = 'mock';

// ---------- Nhận diện chốt đơn ----------
const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const kwList = config.order.keywords.map(norm);
const codeRe = new RegExp(`\\b(${config.order.codePattern})\\b`, 'i');
const phoneRe = new RegExp(config.order.phonePattern);
const qtyRe = /(?:\bx\s*|\bsl\s*:?\s*)(\d{1,3})\b|\b(\d{1,3})\s*(?:cai|c|sp|bo|hop)\b/i;

function detectOrder(text) {
  let t = norm(text);
  const phone = (text.match(phoneRe) || [])[0] || null;
  if (phone) t = t.replace(norm(phone), ' ');
  const hasKw = kwList.some((k) => new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(t));
  const qm = t.match(qtyRe);
  const qty = qm ? parseInt(qm[1] || qm[2], 10) : 1;
  if (qm) t = t.replace(qm[0], ' ');
  const cm = t.match(codeRe);
  const onlyCode = cm && t.trim() === cm[1];
  if (!hasKw && !onlyCode) return null;
  return { code: cm ? cm[1].toUpperCase() : '(chưa rõ mã)', qty, phone };
}

// ---------- Lưu trữ ----------
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const logFile = path.join(dataDir, `chat-${config.username}-${stamp}.jsonl`);
const history = []; // 1000 tin gần nhất
const orders = [];
let status = 'Khởi động';
let counter = 0;

// ---------- Web + WebSocket ----------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/mock', express.static(path.join(__dirname, 'mock')));
app.get('/orders.csv', (_req, res) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Thời gian', 'User', 'Mã', 'SL', 'SĐT', 'Nội dung']].concat(
    orders.map((o) => [new Date(o.ts).toLocaleString('vi-VN'), o.user, o.code, o.qty, o.phone, o.text])
  );
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="don-${config.username}-${stamp}.csv"`);
  res.send('﻿' + rows.map((r) => r.map(esc).join(',')).join('\n'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const broadcast = (obj) => {
  const s = JSON.stringify(obj);
  wss.clients.forEach((c) => c.readyState === 1 && c.send(s));
};
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'init', username: config.username, status, history, orders }));
});

function onMessage({ user, text, ts }) {
  const msg = { id: ++counter, user, text, ts };
  const order = detectOrder(text);
  if (order) {
    msg.order = order;
    orders.push({ ...order, user, text, ts });
  }
  history.push(msg);
  if (history.length > 1000) history.shift();
  fs.appendFile(logFile, JSON.stringify(msg) + '\n', () => {});
  broadcast({ type: 'chat', msg });
  console.log(`${order ? '🛒' : '  '} ${user}: ${text}`);
}
function onStatus(s) {
  status = s;
  console.log('[status]', s);
  broadcast({ type: 'status', status: s });
}

server.listen(config.port, async () => {
  console.log(`Dashboard: http://localhost:${config.port}`);
  const url = MOCK
    ? `http://localhost:${config.port}/mock/live.html`
    : `https://www.tiktok.com/@${config.username}/live`;
  await startScraper({ url, config, onMessage, onStatus });
});

module.exports = { detectOrder };
