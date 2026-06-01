# 📡 CRM Analytics — ETL Pipeline & Dashboard

Dự án xây dựng pipeline ETL end-to-end xử lý dữ liệu log hành vi người dùng từ nền tảng truyền hình, chuyển đổi từ OLTP sang OLAP và trực quan hóa insight qua web dashboard.

---

## 🗂️ Cấu trúc dự án

```
WebCRM/
├── ETL_log_content.py       # ETL pipeline xử lý log xem nội dung
├── ETL_log_search.py        # ETL pipeline xử lý log tìm kiếm
├── count_raw_rows_content.py
├── count_raw_rows_search.py
├── log_content/             # Dữ liệu thô (ignored by git)
├── log_search/              # Dữ liệu thô (ignored by git)
└── web_dashboard/           # Next.js analytics dashboard
    ├── app/
    │   ├── page.tsx          # Dashboard chính (2 tab)
    │   ├── globals.css       # Design system
    │   └── api/
    │       ├── content-stats/route.ts
    │       └── search-stats/route.ts
    └── lib/
        └── db.ts             # PostgreSQL connection pools
```

---

## ⚙️ Tech Stack

| Layer | Công nghệ |
|---|---|
| Data Processing | Apache Spark (PySpark) |
| Data Storage | PostgreSQL (local) |
| DB Connector | JDBC (`postgresql:42.7.2`) |
| Frontend | Next.js 14 (App Router) |
| Charts | Chart.js + react-chartjs-2 |
| DB Client | node-postgres (`pg`) |

---

## 🔄 Pipeline ETL

### 1. `ETL_log_content.py` → `logcontentdb.customer_content_stats`

Xử lý log xem nội dung theo từng hợp đồng (Contract):

```
JSON files → Read with Spark → Classify AppName → Pivot by Type → Calculate Stats → PostgreSQL
```

**Output schema:**

| Cột | Mô tả |
|---|---|
| `Contract` | ID hợp đồng |
| `Total_Giai_Tri` | Tổng giây xem Giải Trí |
| `Total_Phim_Truyen` | Tổng giây xem Phim Truyện |
| `Total_The_Thao` | Tổng giây xem Thể Thao |
| `Total_Thieu_Nhi` | Tổng giây xem Thiếu Nhi |
| `Total_Truyen_Hinh` | Tổng giây xem Truyền Hình |
| `MostWatch` | Thể loại xem nhiều nhất |
| `Taste` | Khẩu vị nội dung (combo thể loại) |
| `Active` | Mức độ hoạt động: `High` / `Low` |

---

### 2. `ETL_log_search.py` → `logsearchdb.customer_search_stats`

Xử lý log hành vi tìm kiếm theo từng user:

```
Parquet folders → Read with Spark → Classify Keyword → Extract Plan → Calculate Stats → PostgreSQL
```

**Output schema:**

| Cột | Mô tả |
|---|---|
| `user_id` | ID người dùng |
| `SearchCount` | Tổng lượt tìm kiếm |
| `UniqueKeyword` | Số keyword độc nhất |
| `QuitRate` | Tỷ lệ thoát tìm kiếm |
| `Interest_*` | Lượt tìm theo từng thể loại (5 loại) |
| `TopInterest` | Thể loại quan tâm nhất |
| `MainPlatform` | Thiết bị sử dụng chủ yếu |
| `MainISP` | Nhà mạng chủ yếu |
| `PlanName` | Tên gói cước |
| `SearchActive` | Mức độ hoạt động: `High` / `Low` |

---

## 📊 Web Dashboard

Dashboard trực quan hóa kết quả ETL với 2 tab phân tích:

### Tab 1 — Content Analytics
- KPI: Tổng contracts, % High Active, trung bình giây xem theo thể loại
- Donut chart: Phân bổ MostWatch
- Bar chart: Tổng giờ xem theo thể loại
- Bảng: Top 10 Taste & Top 20 Contracts xem nhiều nhất

### Tab 2 — Search Analytics
- KPI: Tổng users, Avg SearchCount, Avg QuitRate, % có gói cước
- Donut chart: Phân bổ TopInterest
- Bar chart: Tổng lượt tìm theo thể loại, Platform, ISP, gói cước
- Bảng: Top 20 Users tìm kiếm nhiều nhất

---

## 🚀 Hướng dẫn chạy

### Yêu cầu
- Apache Spark + Hadoop (Windows)
- Python 3.x + PySpark
- PostgreSQL (local, port 5432)
- Node.js 18+

### 1. Chạy ETL

```bash
# Tạo database trước
# logcontentdb và logsearchdb trong PostgreSQL

python ETL_log_content.py
python ETL_log_search.py
```

### 2. Chạy Dashboard

```bash
cd web_dashboard

# Tạo file .env.local
cp .env.local.example .env.local
# Điền thông tin kết nối PostgreSQL

npm install
npm run dev
```

Mở trình duyệt tại: **http://localhost:3000**

---

## 🔐 Biến môi trường

Tạo file `web_dashboard/.env.local`:

```env
CONTENT_DB_HOST=localhost
CONTENT_DB_PORT=5432
CONTENT_DB_NAME=logcontentdb
CONTENT_DB_USER=postgres
CONTENT_DB_PASSWORD=your_password

SEARCH_DB_HOST=localhost
SEARCH_DB_PORT=5432
SEARCH_DB_NAME=logsearchdb
SEARCH_DB_USER=postgres
SEARCH_DB_PASSWORD=your_password
```

---

## 📈 Quy mô dữ liệu

| Nguồn | Định dạng | Số file/folder | Tổng số dòng | Thời gian |
|---|---|---|---|---|
| `log_content` | JSON | 30 files | **48,457,499 dòng** | 04/2022 |
| `log_search` | Parquet | 28 folders | **2,366,972 dòng** | 06–07/2022 |

- **~620,000+** users được tổng hợp trong `customer_search_stats`
- **5 thể loại** nội dung: Truyền Hình, Phim Truyện, Thể Thao, Thiếu Nhi, Giải Trí
- Tổng cộng xử lý hơn **50 triệu dòng** dữ liệu thô qua Apache Spark
