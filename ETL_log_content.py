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
    .appName("ETL_Weekly_Final_Fixed") \
    .config("spark.driver.memory", "4g") \
    .config("spark.local.dir", r"D:\spark_temp") \
    .config("spark.sql.shuffle.partitions", "8") \
    .config("spark.jars.packages", "org.postgresql:postgresql:42.7.2") \
    .getOrCreate()

# --- CÁC HÀM XỬ LÝ LOGIC ---

def category_app_name(df):
    """Phân loại AppName và chuẩn hóa tên để Pivot"""
    return df.withColumn("Type", F.when(F.col("AppName") == "CHANNEL", "Truyen_Hinh")
                        .when(F.col("AppName") == "RELAX", "Giai_Tri")
                        .when(F.col("AppName") == "CHILD", "Thieu_Nhi")
                        .when(F.col("AppName").isin("FIMS", "VOD"), "Phim_Truyen")
                        .when(F.col("AppName").isin("KPLUS", "SPORT"), "The_Thao")
                        .otherwise("Other")) \
             .filter((F.col("Contract") != '0') & (F.col("Type") != "Other"))

def calculate_stats(df, day_limit=4):
    """Tính toán chỉ số tích hợp fix lỗi Taste null"""
    categories = ["Giai_Tri", "Phim_Truyen", "The_Thao", "Thieu_Nhi", "Truyen_Hinh"]
    
    # 1. Pivot và fill 0
    df_pivot = df.groupBy("Contract").pivot("Type", categories).agg(F.sum("TotalDuration")).fillna(0.0)
    
    # Ép kiểu Double
    for c in categories:
        df_pivot = df_pivot.withColumn(c, F.col(c).cast("double"))

    # 2. Tìm MostWatch
    df_stats = df_pivot.withColumn("MaxVal", F.greatest(*[F.col(c) for c in categories]))
    most_watch_expr = F.when(F.col(categories[0]) == F.col("MaxVal"), categories[0])
    for c in categories[1:]:
        most_watch_expr = most_watch_expr.when(F.col(c) == F.col("MaxVal"), c)
    df_stats = df_stats.withColumn("MostWatch", most_watch_expr)

    # 3. Tính Taste (Dùng concat_ws để chống Null)
    for c in categories:
        clean_name = c.replace("_", " ")
        df_stats = df_stats.withColumn(f"tmp_{c}", 
            F.when(F.col(c) > 0, F.lit(clean_name)).otherwise(F.lit(None)))

    tmp_cols = [f"tmp_{c}" for c in categories]
    df_stats = df_stats.withColumn("Taste", F.concat_ws("-", *[F.col(tc) for tc in tmp_cols]))
    df_stats = df_stats.withColumn("Taste", 
        F.when(F.col("Taste") == "", "None").otherwise(F.col("Taste")))

    # 4. Tính Active
    df_active = df.groupBy("Contract").agg(F.countDistinct("Date").alias("DayCount"))
    
    final_df = df_stats.join(df_active, "Contract") \
        .withColumn("Active", F.when(F.col("DayCount") > day_limit, "High").otherwise("Low"))
        
    return final_df.drop(*tmp_cols).select(
        "Contract", 
        *[F.col(c).alias(f"Total_{c}") for c in categories],
        "MostWatch", "Taste", "Active"
    )

def import_to_local_db(df, table_name):
    """Ghi dữ liệu vào PostgreSQL local (logcontentdb) qua JDBC"""
    host     = "localhost"
    port     = "5432"
    database = "logcontentdb"
    user     = "postgres"
    password = "huytit2004"
    url      = f"jdbc:postgresql://{host}:{port}/{database}"

    print(f"📤 Đang đẩy dữ liệu vào {table_name} (local PostgreSQL - {database})...")

    df.write.format('jdbc') \
        .option('url',      url) \
        .option('driver',   "org.postgresql.Driver") \
        .option('dbtable',  table_name) \
        .option('user',     user) \
        .option('password', password) \
        .mode('overwrite') \
        .save()

# --- TIẾN TRÌNH CHÍNH ---

def main_task(path):
    start_time = time.time()

    if not os.path.exists(r"D:\spark_temp"):
        os.makedirs(r"D:\spark_temp")

    # Tự động quét toàn bộ file JSON trong thư mục
    json_files = sorted([
        f for f in os.listdir(path)
        if f.endswith(".json") and f[:8].isdigit()
    ])

    if not json_files:
        print("❌ Không tìm thấy file JSON nào trong thư mục.")
        return

    print(f"🚀 Khởi động ETL log_content — tìm thấy {len(json_files)} file")
    print(f"   Từ {json_files[0]} đến {json_files[-1]}")

    full_df    = None
    count_files = 0

    for fname in json_files:
        file_path = os.path.join(path, fname)
        date_str  = fname.replace(".json", "")          # yyyymmdd
        try:
            day_df  = spark.read.json(file_path).select("_source.*") \
                          .withColumn("Date", F.lit(date_str))
            full_df = day_df if full_df is None else full_df.union(day_df)
            count_files += 1
            print(f"  ✅ Đọc file: {fname}")
        except Exception as e:
            print(f"  ⚠️  Bỏ qua {fname}: {e}")

    if full_df is None:
        print("❌ Không đọc được dữ liệu.")
        return

    print(f"\n📂 Đã đọc {count_files} / {len(json_files)} file")
    print("🔄 Đang biến đổi dữ liệu...")
    full_df = category_app_name(full_df)

    # Ngưỡng Active: tuần (<=7 ngày) → 4, tháng (>7 ngày) → 15
    active_limit = 4 if count_files <= 7 else 15
    result_df = calculate_stats(full_df, day_limit=active_limit)

    try:
        import_to_local_db(result_df, "customer_content_stats")
        print("✅ Dữ liệu đã được đẩy vào PostgreSQL local thành công!")
    except Exception as e:
        print(f"❌ Lỗi Database: {e}")

    print("\n" + "="*40)
    print(f"🏁 HOÀN THÀNH JOB")
    print(f"⏱️  Tổng thời gian: {time.time() - start_time:.2f} giây")
    print("="*40)

    result_df.show(5)


if __name__ == "__main__":
    log_path = r"f:\Data_DE_Onl\WebCRM\log_content"
    main_task(log_path)