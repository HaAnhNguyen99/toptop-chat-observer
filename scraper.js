// Mở trang live TikTok bằng Chromium của chính bạn (Playwright) và đọc chat từ DOM.
// Không dùng API/server bên thứ ba nào.
const path = require('path');
const { chromium } = require('playwright');

// Script này chạy BÊN TRONG trang TikTok, theo dõi khung chat và đẩy tin mới ra Node.
function pageObserver(sel) {
  const seen = new WeakSet();

  function parse(el) {
    if (seen.has(el)) return;
    seen.add(el);
    const nameEl = el.querySelector(sel.owner);
    const user = nameEl ? nameEl.textContent.trim() : '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll(sel.owner).forEach((n) => n.remove());
    // bỏ ảnh/huy hiệu, giữ emoji dạng alt nếu có
    clone.querySelectorAll('img').forEach((img) => img.replaceWith(img.alt || ''));
    const text = clone.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    window.__onChat({ user, text, ts: Date.now() });
  }

  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(sel.message)) parse(node);
    else node.querySelectorAll(sel.message).forEach(parse);
  }

  function start() {
    document.querySelectorAll(sel.message).forEach(parse);
    new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach(scan);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
}

async function startScraper({ url, config, onMessage, onStatus }) {
  const ctx = await chromium.launchPersistentContext(path.resolve(config.profileDir), {
    headless: config.headless,
    viewport: { width: 1280, height: 820 },
    locale: 'vi-VN',
  });
  const page = ctx.pages()[0] || (await ctx.newPage());

  let lastMsgAt = Date.now();
  await page.exposeFunction('__onChat', (m) => {
    lastMsgAt = Date.now();
    onMessage(m);
  });
  await page.addInitScript(pageObserver, config.selectors);

  async function open() {
    onStatus(`Đang mở ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      onStatus('Đã mở trang live — đang chờ tin nhắn');
    } catch (e) {
      onStatus('Lỗi mở trang: ' + e.message);
    }
  }
  await open();

  // Nếu im lặng quá lâu (live rớt, trang đứng) thì tải lại.
  const silentMs = (config.reloadIfSilentMinutes || 0) * 60000;
  if (silentMs > 0) {
    setInterval(async () => {
      if (Date.now() - lastMsgAt > silentMs) {
        lastMsgAt = Date.now();
        onStatus('Không có tin nhắn mới — tải lại trang');
        await open();
      }
    }, 30000);
  }

  return ctx;
}

module.exports = { startScraper };
