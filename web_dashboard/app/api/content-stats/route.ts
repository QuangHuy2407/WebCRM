import { NextResponse } from 'next/server';
import { contentPool } from '@/lib/db';

export async function GET() {
  try {
    // 1. KPI tổng quan
    const kpiRes = await contentPool.query(`
      SELECT
        COUNT(*)                                          AS "total_contracts",
        ROUND(AVG("Total_Giai_Tri")::numeric,    0)      AS "avg_giai_tri",
        ROUND(AVG("Total_Phim_Truyen")::numeric,  0)     AS "avg_phim_truyen",
        ROUND(AVG("Total_The_Thao")::numeric,     0)     AS "avg_the_thao",
        ROUND(AVG("Total_Thieu_Nhi")::numeric,    0)     AS "avg_thieu_nhi",
        ROUND(AVG("Total_Truyen_Hinh")::numeric,  0)     AS "avg_truyen_hinh",
        SUM(CASE WHEN "Active" = 'High' THEN 1 ELSE 0 END) AS "high_active",
        SUM(CASE WHEN "Active" = 'Low'  THEN 1 ELSE 0 END) AS "low_active"
      FROM customer_content_stats
    `);

    // 2. Phân bổ MostWatch
    const mostWatchRes = await contentPool.query(`
      SELECT "MostWatch" AS "mostWatch", COUNT(*) AS "count"
      FROM customer_content_stats
      GROUP BY "MostWatch"
      ORDER BY "count" DESC
    `);

    // 3. Tổng thời gian xem theo thể loại (trung bình)
    const durationRes = await contentPool.query(`
      SELECT
        ROUND(SUM("Total_Giai_Tri")::numeric    / 3600, 1) AS "giai_tri_h",
        ROUND(SUM("Total_Phim_Truyen")::numeric / 3600, 1) AS "phim_truyen_h",
        ROUND(SUM("Total_The_Thao")::numeric    / 3600, 1) AS "the_thao_h",
        ROUND(SUM("Total_Thieu_Nhi")::numeric   / 3600, 1) AS "thieu_nhi_h",
        ROUND(SUM("Total_Truyen_Hinh")::numeric / 3600, 1) AS "truyen_hinh_h"
      FROM customer_content_stats
    `);

    // 4. Top 10 Taste phổ biến nhất
    const tasteRes = await contentPool.query(`
      SELECT "Taste" AS "taste", COUNT(*) AS "count"
      FROM customer_content_stats
      GROUP BY "Taste"
      ORDER BY "count" DESC
      LIMIT 10
    `);

    // 5. Top 20 contracts xem nhiều nhất
    const topContractsRes = await contentPool.query(`
      SELECT
        "Contract"    AS "contract",
        ROUND(("Total_Giai_Tri" + "Total_Phim_Truyen" + "Total_The_Thao" + "Total_Thieu_Nhi" + "Total_Truyen_Hinh")::numeric / 3600, 1) AS "total_hours",
        "MostWatch"   AS "mostWatch",
        "Active"      AS "active",
        "Taste"       AS "taste"
      FROM customer_content_stats
      ORDER BY "total_hours" DESC
      LIMIT 20
    `);

    return NextResponse.json({
      kpi:          kpiRes.rows[0],
      mostWatch:    mostWatchRes.rows,
      duration:     durationRes.rows[0],
      taste:        tasteRes.rows,
      topContracts: topContractsRes.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
