import findspark
findspark.init()

import os
import sys
import time
from datetime import datetime, timedelta
from pyspark.sql import SparkSession
from pyspark.sql import functions as F

# --- CẤU HÌNH MÔI TRƯỜNG ---
os.environ["HADOOP_HOME"] = r"C:\hadoop"
sys.path.append(r"C:\hadoop\bin")

# Khởi tạo Spark Session
spark = SparkSession.builder \
    .appName("ETL_log_search") \
    .config("spark.driver.memory", "4g") \
    .config("spark.local.dir", r"D:\spark_temp") \
    .config("spark.sql.shuffle.partitions", "8") \
    .config("spark.jars.packages", "org.postgresql:postgresql:42.7.2") \
    .getOrCreate()

# --- CÁC HÀM XỬ LÝ ---

def classify_keyword(df):
    """Phân loại keyword thành thể loại nội dung dựa trên từ khóa"""
    return df.withColumn("ContentType",
        F.when(
            F.lower(F.col("keyword")).rlike(r"kênh|vtv|htv|channel|trực tiếp|live tv"),
            "TruyenHinh"
        ).when(
            F.lower(F.col("keyword")).rlike(r"bóng đá|u23|u20|ngoại hạng|running man|thể thao|sport|world cup|champion"),
            "TheThao"
        ).when(
            F.lower(F.col("keyword")).rlike(r"siêu nhân|naruto|boruto|fairy tail|doraemon|conan|pokemon|hoạt hình|anime|thiếu nhi"),
            "ThieuNhi"
        ).when(
            F.lower(F.col("keyword")).rlike(r"phim|tập \d|season|episode|ep\.|movie|drama"),
            "Phim"
        ).otherwise("GiaiTri")
    )


def extract_plan(df):
    """Trích xuất thông tin gói cước từ userPlansMap (array)"""
    df_exploded = df.select(
        "user_id",
        F.explode_outer(F.col("userPlansMap")).alias("plan_raw")
    ).withColumn("plan_name",
        F.split(F.col("plan_raw"), ":").getItem(0)
    )

    df_plan = df_exploded.groupBy("user_id").agg(
        F.first("plan_name", ignorenulls=True).alias("PlanName"),
        F.count("plan_raw").alias("PlanCount")
    )
    return df_plan


def get_main_value(df, group_col, value_col, alias):
    """Lấy giá trị xuất hiện nhiều nhất (mode) theo nhóm"""
    df_count = df.groupBy(group_col, value_col).count()
    df_max = df_count.groupBy(group_col).agg(F.max("count").alias("max_count"))
    df_mode = df_count.join(df_max, group_col) \
        .filter(F.col("count") == F.col("max_count")) \
        .groupBy(group_col) \
        .agg(F.first(value_col).alias(alias))
    return df_mode


def calculate_search_stats(df_classified, df_plan):
    """Tổng hợp các chỉ số tìm kiếm theo từng user"""
    categories = ["TruyenHinh", "TheThao", "ThieuNhi", "Phim", "GiaiTri"]

    # 1. Chỉ số hành vi tìm kiếm
    df_behavior = df_classified.groupBy("user_id").agg(
        F.count("eventID").alias("SearchCount"),
        F.countDistinct("keyword").alias("UniqueKeyword"),
        F.countDistinct("Date").alias("SearchDays"),
        F.sum(F.when(F.col("category") == "enter", 1).otherwise(0)).alias("SearchEnter"),
        F.sum(F.when(F.col("category") == "quit",  1).otherwise(0)).alias("SearchQuit"),
    ).withColumn("QuitRate",
        F.round(F.col("SearchQuit") / F.col("SearchCount"), 4)
    )

    # 2. Pivot thể loại nội dung (Interest)
    df_pivot = df_classified \
        .groupBy("user_id") \
        .pivot("ContentType", categories) \
        .count() \
        .fillna(0)
    df_pivot = df_pivot.select(
        "user_id",
        *[F.col(c).alias(f"Interest_{c}") for c in categories]
    )

    # 3. TopInterest — thể loại được tìm nhiều nhất
    df_top = df_pivot.withColumn("MaxVal",
        F.greatest(*[F.col(f"Interest_{c}") for c in categories])
    )
    top_expr = F.when(F.col(f"Interest_{categories[0]}") == F.col("MaxVal"), categories[0])
    for c in categories[1:]:
        top_expr = top_expr.when(F.col(f"Interest_{c}") == F.col("MaxVal"), c)
    df_top = df_top.withColumn("TopInterest", top_expr).drop("MaxVal")

    # 4. MainPlatform — thiết bị dùng nhiều nhất
    df_platform = get_main_value(
        df_classified.filter(F.col("platform").isNotNull()),
        "user_id", "platform", "MainPlatform"
    )

    # 5. MainISP — nhà mạng dùng nhiều nhất
    df_isp = get_main_value(
        df_classified.filter(F.col("proxy_isp").isNotNull()),
        "user_id", "proxy_isp", "MainISP"
    )

    # 6. Gộp tất cả
    final_df = df_behavior \
        .join(df_top,      "user_id") \
        .join(df_platform, "user_id", "left") \
        .join(df_isp,      "user_id", "left") \
        .join(df_plan,     "user_id", "left") \
        .withColumn("HasPlan",
            F.when(F.col("PlanCount") > 0, True).otherwise(False)
        ).withColumn("SearchActive",
            F.when(F.col("SearchDays") >= 4, "High").otherwise("Low")
        ).fillna({
            "PlanName":     "None",
            "PlanCount":    0,
            "MainPlatform": "unknown",
            "MainISP":      "unknown"
        })

    return final_df.select(
        "user_id",
        "SearchCount", "UniqueKeyword", "SearchDays",
        "SearchEnter", "SearchQuit", "QuitRate",
        *[f"Interest_{c}" for c in categories],
        "TopInterest",
        "MainPlatform", "MainISP",
        "PlanName", "PlanCount", "HasPlan",
        "SearchActive"
    )


def import_to_local_db(df, table_name):
    """Ghi dữ liệu vào PostgreSQL local (WebCRM datasource) qua JDBC"""
    host     = "localhost"
    port     = "5432"
    database = "logsearchdb" 
    user     = "postgres"
    password = "huytit2004"          # ← đổi nếu password khác
    url      = f"jdbc:postgresql://{host}:{port}/{database}"

    print(f"📤 Đang đẩy dữ liệu vào {table_name} (local PostgreSQL)...")

    df.write.format("jdbc") \
        .option("url",      url) \
        .option("driver",   "org.postgresql.Driver") \
        .option("dbtable",  table_name) \
        .option("user",     user) \
        .option("password", password) \
        .mode("overwrite") \
        .save()


# --- TIẾN TRÌNH CHÍNH ---

def main_task(path, start_str, end_str):
    start_time = time.time()
    print(f"🚀 Khởi động ETL log_search: {start_str} → {end_str}")

    if not os.path.exists(r"D:\spark_temp"):
        os.makedirs(r"D:\spark_temp")

    start_date = datetime.strptime(start_str, "%Y%m%d")
    end_date   = datetime.strptime(end_str,   "%Y%m%d")

    full_df       = None
    count_folders = 0

    current_date = start_date
    while current_date <= end_date:
        date_str    = current_date.strftime("%Y%m%d")
        folder_path = os.path.join(path, date_str)

        if os.path.exists(folder_path):
            day_df  = spark.read.parquet(folder_path) \
                           .withColumn("Date", F.lit(date_str))
            full_df = day_df if full_df is None else full_df.union(day_df)
            count_folders += 1
            print(f"  ✅ Đọc folder: {date_str}")

        current_date += timedelta(days=1)

    if full_df is None:
        print("❌ Không tìm thấy dữ liệu.")
        return

    print(f"\n📂 Đã đọc {count_folders} folders")

    # Lọc bỏ user_id null / rỗng
    full_df = full_df.filter(
        F.col("user_id").isNotNull() & (F.col("user_id") != "")
    )

    print("🔤 Đang phân loại keyword...")
    full_df = classify_keyword(full_df)

    print("📋 Đang trích xuất gói cước...")
    df_plan = extract_plan(full_df)

    print("🔄 Đang tính toán chỉ số...")
    result_df = calculate_search_stats(full_df, df_plan)

    try:
        import_to_local_db(result_df, "customer_search_stats")
        print("✅ Dữ liệu đã được đẩy vào PostgreSQL local thành công!")
    except Exception as e:
        print(f"❌ Lỗi Database: {e}")

    print("\n" + "=" * 40)
    print(f"🏁 HOÀN THÀNH JOB")
    print(f"⏱️  Tổng thời gian: {time.time() - start_time:.2f} giây")
    print("=" * 40)

    result_df.show(5)


if __name__ == "__main__":
    log_path = r"f:\Data_DE_Onl\WebCRM\log_search"
    main_task(log_path, "20220601", "20220714")
