# 📊 Hướng Dẫn Quản Lý Quota Gemini API

## 🎯 Tổng Quan

Gemini API có 2 tier sử dụng:
- **Free Tier** (Miễn phí)
- **Paid Tier** (Trả phí)

Tài liệu này hướng dẫn tối ưu sử dụng **Free Tier** và xử lý khi vượt quota.

---

## 📋 Hạn Mức Free Tier

| Metric | Giới Hạn | Reset Time |
|--------|----------|------------|
| **Requests per Minute (RPM)** | 15 | Mỗi phút |
| **Tokens per Minute (TPM)** | 1,000,000 | Mỗi phút |
| **Requests per Day (RPD)** | 1,500 | Mỗi 24 giờ |
| **Tokens per Day (TPD)** | **250,000** | Mỗi 24 giờ |

> ⚠️ **Giới hạn chính:** 250,000 tokens/ngày là giới hạn dễ vượt nhất!

---

## 🔍 Ước Tính Token Usage

### Công thức ước tính:
```
Tokens ≈ (Tổng ký tự / 3) + 1000 (prompt overhead)
```

### Ví dụ thực tế:

| Segments | Ký tự/segment | Tổng ký tự | Tokens ước tính | % Quota |
|----------|---------------|------------|-----------------|---------|
| 10 | 100 | 1,000 | ~1,333 | 0.5% |
| 50 | 100 | 5,000 | ~2,667 | 1% |
| 100 | 150 | 15,000 | ~6,000 | 2.4% |
| 500 | 150 | 75,000 | ~26,000 | 10.4% |
| 1000 | 150 | 150,000 | ~51,000 | 20.4% |
| 2000 | 200 | 400,000 | ~134,333 | **53.7%** |
| 3000 | 200 | 600,000 | ~201,000 | **80.4%** ⚠️ |

### Kết luận:
- ✅ **Dưới 1000 segments:** An toàn, xử lý một lần
- ⚠️ **1000-2000 segments:** Gần giới hạn, hệ thống tự động chia batches
- 🚫 **Trên 2000 segments:** Rất dễ vượt quota, cần chia nhiều ngày

---

## 🛠️ Giải Pháp Tự Động Của Ứng Dụng

### 1. **Batch Processing** 🔄

Khi ước tính vượt 80% quota (200,000 tokens), hệ thống tự động:

```
Ví dụ: 2500 segments
├─ Batch 1: 50 segments → ~7,500 tokens
├─ Batch 2: 50 segments → ~7,500 tokens
├─ ...
└─ Batch 50: 50 segments → ~7,500 tokens

Tổng: 50 batches × 7,500 = 375,000 tokens
⚠️ Vượt quota! Sẽ dừng tại batch thứ ~33 (247,500 tokens)
```

**Lợi ích:**
- ✅ Tự động chia nhỏ
- ✅ Progress tracking rõ ràng
- ✅ Delay 5s giữa các batches (tránh vượt RPM)
- ✅ Báo lỗi rõ ràng khi vượt quota

### 2. **Quota Estimation** 📊

Trước khi xử lý, hiển thị:
```
📊 Ước tính token sử dụng
• Segments: 1500
• Ước tính: ~75,000 tokens
• Hạn mức free: 250,000 tokens/ngày
• Sử dụng: ~30%
```

### 3. **Error Handling** 🚨

Khi nhận lỗi 429 (quota exceeded):
```
🚫 Đã vượt hạn mức miễn phí của Gemini API

📊 Hạn mức free tier: 250,000 tokens/ngày
⏰ Thời gian reset: Sau 26.68s (~ 1 phút)

💡 Giải pháp:
1️⃣ Đợi 1 phút rồi thử lại
2️⃣ Xử lý ít segments hơn (chọn đoạn quan trọng để chuẩn hóa)
3️⃣ Nâng cấp lên Gemini API trả phí:
   • Truy cập: https://console.cloud.google.com
   • Enable billing để có quota cao hơn (60 requests/phút)

📈 Monitor usage: https://ai.dev/rate-limit

Chi tiết: You exceeded your current quota...
```

---

## 💡 Chiến Lược Sử Dụng Tối Ưu

### Kịch Bản 1: Cuộc họp ngắn (<30 phút, ~500 segments)
✅ **Xử lý:** Một lần, không vấn đề
```
500 segments × 150 chars = 75,000 chars
Tokens: ~26,000 (10% quota)
```

### Kịch Bản 2: Cuộc họp trung bình (1 giờ, ~1000 segments)
⚠️ **Xử lý:** Batch tự động, an toàn
```
1000 segments × 150 chars = 150,000 chars
Tokens: ~51,000 (20% quota)
→ Chia 20 batches × 50 segments
```

### Kịch Bản 3: Cuộc họp dài (2 giờ, ~2000 segments)
🚫 **Xử lý:** Cẩn thận, có thể vượt quota
```
2000 segments × 150 chars = 300,000 chars
Tokens: ~101,000 (40% quota)
→ Chia 40 batches × 50 segments

⚠️ Nếu đã dùng 60% quota trong ngày:
   → Batch thứ 25 sẽ vượt quota
   → Error: Đã xử lý 1250/2000 segments
```

**Giải pháp:**
1. Xử lý 60% đầu (1200 segments) hôm nay
2. Xử lý 40% còn lại (800 segments) ngày mai
3. Hoặc chọn lọc segments quan trọng để chuẩn hóa

### Kịch Bản 4: Hội nghị cả ngày (4+ giờ, 4000+ segments)
🚫 **Không khả thi với Free Tier**
```
4000 segments × 200 chars = 800,000 chars
Tokens: ~267,000 (107% quota - VƯỢT!)
```

**Giải pháp:**
1. Chia thành 2 ngày:
   - Ngày 1: 1800 segments (~90,000 tokens)
   - Ngày 2: 2200 segments (~110,000 tokens)
2. Hoặc nâng cấp lên Paid Tier

---

## 🎯 Best Practices

### 1. **Kiểm tra Usage trước khi xử lý**
```
🔍 Truy cập: https://ai.dev/rate-limit
→ Xem đã dùng bao nhiêu tokens trong ngày
→ Ước tính còn bao nhiêu quota
```

### 2. **Xử lý vào đầu ngày**
- Quota reset sau 24 giờ kể từ request đầu tiên
- Xử lý vào sáng sớm để có đầy đủ quota

### 3. **Ưu tiên segments quan trọng**
- Không nhất thiết phải chuẩn hóa tất cả segments
- Chọn đoạn có nhiều lỗi, từ thừa để chuẩn hóa
- Giữ lại đoạn đã tốt

### 4. **Batch nhỏ cho cuộc họp dài**
- Chuẩn hóa từng phần trong cuộc họp
- Không đợi đến cuối mới chuẩn hóa tất cả

### 5. **Monitor logs**
```
Console logs sẽ hiển thị:
📊 Quota Check: ✅ Ước tính 45,000 tokens (~18% hạn mức miễn phí)
🔄 Using batch processing to avoid quota limits...
📦 Processing 2000 segments in 40 batches...
🔄 Processing batch 1/40 (50 segments)...
⏳ Waiting 5 seconds before next batch...
```

---

## 🚀 Nâng Cấp Lên Paid Tier

### Hạn mức Paid Tier:
| Metric | Free | Paid |
|--------|------|------|
| RPM | 15 | **60** |
| TPM | 1M | **4M** |
| RPD | 1,500 | **10,000** |
| TPD | 250K | **Unlimited** |

### Cách nâng cấp:
1. Truy cập: https://console.cloud.google.com
2. Chọn project
3. Enable billing (credit card)
4. API Key cũ vẫn hoạt động, tự động nâng lên Paid tier

### Chi phí:
- **Input:** $0.000125 / 1K tokens
- **Output:** $0.000375 / 1K tokens

**Ví dụ:**
```
2000 segments × 200 chars = 400,000 chars
Tokens: ~134,000
Input cost: 134 × $0.000125 = $0.01675
Output cost: ~50K × $0.000375 = $0.01875
Total: ~$0.035 (35 cents cho 2000 segments)
```

→ Rất rẻ! Chỉ ~$1 cho 50,000 segments.

---

## ❓ FAQ

### Q1: Làm sao biết đã dùng bao nhiêu quota?
**A:** Truy cập https://ai.dev/rate-limit và đăng nhập bằng account Google có API key.

### Q2: Quota reset khi nào?
**A:** 24 giờ sau request đầu tiên trong ngày. Không phải 00:00 GMT.

### Q3: Có cách nào tăng quota miễn phí không?
**A:** Không. Free tier cố định 250K tokens/ngày. Muốn hơn phải trả phí.

### Q4: Batch processing có ảnh hưởng chất lượng không?
**A:** Không. Mỗi batch được xử lý độc lập với quality như nhau.

### Q5: Tôi đã vượt quota, phải làm gì?
**A:**
- Đợi 24 giờ để quota reset
- Hoặc nâng cấp lên Paid tier ngay lập tức
- Hoặc sử dụng API key khác (account khác)

### Q6: Có thể dùng nhiều API key để tăng quota?
**A:** Có, nhưng vi phạm Terms of Service của Google. Không khuyến khích.

### Q7: Lỗi "Please retry in 26.68s" nghĩa là gì?
**A:** Vượt RPM (15 requests/phút). Đợi 30 giây rồi thử lại. App tự động delay 5s giữa batches để tránh lỗi này.

---

## 📚 Tài Liệu Tham Khảo

- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Usage Monitor](https://ai.dev/rate-limit)
- [Pricing Calculator](https://ai.google.dev/pricing)
- [Console Cloud](https://console.cloud.google.com)

---

## 🎉 Tóm Tắt

| Segments | Tokens | Khả thi Free Tier | Giải pháp |
|----------|--------|-------------------|-----------|
| < 1000 | < 50K | ✅ An toàn | Xử lý một lần |
| 1000-2000 | 50-100K | ⚠️ Cẩn thận | Batch tự động |
| 2000-3000 | 100-150K | 🚫 Rủi ro cao | Chia 2 ngày |
| > 3000 | > 150K | ❌ Không khả thi | Paid tier |

**Khuyến nghị chung:**
- ✅ Free tier: Dùng cho cuộc họp < 1 giờ
- ⚠️ Cuộc họp dài: Chia nhiều ngày hoặc nâng cấp
- 💰 Paid tier: Chỉ $1 cho 50,000 segments → Rất đáng!

---

💡 **Mẹo cuối:** Nếu sử dụng thường xuyên, nâng cấp lên Paid tier. Chi phí rất thấp (~$1-2/tháng) nhưng không phải lo quota!
