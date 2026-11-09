# TopTop Chat Observer — đọc chat TikTok Live tự host

Đọc bình luận TikTok Live realtime, **không dùng API hay server của bên thứ ba**:
server Node.js của bạn tự mở trang live bằng Chromium (Playwright), đọc chat trực tiếp
từ trang, rồi đẩy sang dashboard qua WebSocket.

```
TikTok Live (trang web) ──► Chromium do bạn điều khiển ──► server.js ──WebSocket──► Dashboard (trình duyệt)
                                                              └─► data/*.jsonl (log toàn bộ chat)
```

## Tính năng
- **Hiển thị & lọc**: nhập từ khoá (cách nhau dấu phẩy), không phân biệt dấu — tô sáng, hoặc chỉ hiện tin khớp.
- **Thống kê chốt đơn**: tự nhận tin có `chốt / lấy / mua / đặt…` + mã SP (`A12`, `B3`), số lượng (`x2`, `sl 3`, `2 cái`), SĐT. Tin chỉ ghi mã (vd `A12`) cũng tính là đơn. Bảng tổng theo mã + **Xuất CSV** (mở được bằng Excel).
- **Cảnh báo / đọc to**: bíp khi khớp từ khoá; đọc to (giọng tiếng Việt của trình duyệt) tin khớp / tin chốt đơn / tất cả.
- Tự tải lại trang nếu im lặng quá N phút; log toàn bộ chat vào `data/`.

## Cài đặt (máy Windows / Mac / Linux, hoặc VPS)
Cần Node.js 18+.
```bash
npm install
npx playwright install chromium
```

## Chạy
```bash
# Thử trước với trang giả lập (không cần TikTok):
npm run mock

# Chạy thật — thay bằng username kênh đang live:
node server.js ten_kenh
```
Mở **http://localhost:3000** để xem dashboard.

Lần đầu, cửa sổ Chromium sẽ hiện ra. Nếu TikTok yêu cầu đăng nhập hoặc xác minh, bạn
tự thao tác trong cửa sổ đó — phiên đăng nhập được lưu ở `.browser-profile/` cho các lần sau.
Khi đã ổn, có thể chạy ẩn: `node server.js ten_kenh --headless`.

## Tuỳ chỉnh (`config.json`)
| Khoá | Ý nghĩa |
|---|---|
| `username` | Kênh mặc định nếu không truyền trên dòng lệnh |
| `port` | Cổng dashboard |
| `reloadIfSilentMinutes` | Không có tin mới sau N phút → tải lại trang (0 = tắt) |
| `order.keywords` | Từ khoá chốt đơn (so khớp không dấu) |
| `order.codePattern` | Regex mã sản phẩm, mặc định 0–3 chữ + 1–4 số |
| `selectors` | CSS selector khung chat TikTok — **sửa ở đây nếu TikTok đổi giao diện** |

### Khi TikTok đổi giao diện (tool không thấy tin nào)
Mở live trên Chrome → chuột phải vào 1 bình luận → *Inspect* → tìm thuộc tính
`data-e2e` của khối bình luận và của tên người dùng, rồi cập nhật `selectors.message`
và `selectors.owner` trong `config.json`.

## Lưu ý
- Đây là đọc dữ liệu công khai hiển thị trên trang, không phải API chính thức — dùng cho kênh của bạn, tần suất hợp lý, tuân thủ điều khoản TikTok.
- Muốn mở dashboard từ điện thoại cùng mạng: vào `http://<IP-máy-chạy>:3000`. Nếu đặt trên VPS, nên để sau reverse proxy có mật khẩu.
