import { NextResponse } from 'next/server';
import { searchPool } from '@/lib/db';

export async function GET() {
  try {
    // 1. KPI tổng quan
    const kpiRes = await searchPool.query(`
      SELECT
        COUNT(*)                                       AS "total_users",
        ROUND(AVG("SearchCount")::numeric, 1)         AS "avg_search_count",
        ROUND(AVG("UniqueKeyword")::numeric, 1)       AS "avg_unique_kw",
        ROUND(AVG("QuitRate")::numeric, 4)            AS "avg_quit_rate",
        SUM(CASE WHEN "SearchActive" = 'High' THEN 1 ELSE 0 END) AS "high_active",
        SUM(CASE WHEN "SearchActive" = 'Low'  THEN 1 ELSE 0 END) AS "low_active",
        SUM(CASE WHEN "HasPlan" = true THEN 1 ELSE 0 END)        AS "has_plan",
        SUM(CASE WHEN "HasPlan" = false THEN 1 ELSE 0 END)       AS "no_plan"
      FROM customer_search_stats
    `);

    // 2. Phân bổ TopInterest
    const interestRes = await searchPool.query(`
      SELECT "TopInterest" AS "topInterest", COUNT(*) AS "count"
      FROM customer_search_stats
      GROUP BY "TopInterest"
      ORDER BY "count" DESC
    `);

    // 3. Tổng lượt Interest theo thể loại
    const interestSumRes = await searchPool.query(`
      SELECT
        SUM("Interest_TruyenHinh") AS "truyen_hinh",
        SUM("Interest_TheThao")    AS "the_thao",
        SUM("Interest_ThieuNhi")   AS "thieu_nhi",
        SUM("Interest_Phim")       AS "phim",
        SUM("Interest_GiaiTri")    AS "giai_tri"
      FROM customer_search_stats
    `);

    // 4. Phân bổ Platform
    const platformRes = await searchPool.query(`
      SELECT "MainPlatform" AS "mainPlatform", COUNT(*) AS "count"
      FROM customer_search_stats
      WHERE "MainPlatform" != 'unknown'
      GROUP BY "MainPlatform"
      ORDER BY "count" DESC
      LIMIT 10
    `);

    // 5. Phân bổ ISP
    const ispRes = await searchPool.query(`
      SELECT "MainISP" AS "mainISP", COUNT(*) AS "count"
      FROM customer_search_stats
      WHERE "MainISP" != 'unknown'
      GROUP BY "MainISP"
      ORDER BY "count" DESC
      LIMIT 10
    `);

    // 6. Top 20 users tìm kiếm nhiều nhất
    const topUsersRes = await searchPool.query(`
      SELECT
        "user_id"                                             AS "user_id",
        "SearchCount"                                         AS "SearchCount",
        "UniqueKeyword"                                       AS "UniqueKeyword",
        "SearchDays"                                          AS "SearchDays",
        ROUND("QuitRate"::numeric * 100, 1)                   AS "quit_pct",
        "TopInterest"                                         AS "TopInterest",
        "MainPlatform"                                        AS "MainPlatform",
        "SearchActive"                                        AS "SearchActive"
      FROM customer_search_stats
      ORDER BY "SearchCount" DESC
      LIMIT 20
    `);

    // 7. Phân bổ gói cước
    const planRes = await searchPool.query(`
      SELECT "PlanName" AS "planName", COUNT(*) AS "count"
      FROM customer_search_stats
      WHERE "PlanName" != 'None'
      GROUP BY "PlanName"
      ORDER BY "count" DESC
      LIMIT 10
    `);

    return NextResponse.json({
      kpi:         kpiRes.rows[0],
      topInterest: interestRes.rows,
      interestSum: interestSumRes.rows[0],
      platform:    platformRes.rows,
      isp:         ispRes.rows,
      topUsers:    topUsersRes.rows,
      plan:        planRes.rows,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
