'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// ─── TYPE DEFINITIONS ───────────────────────────────────────
interface ContentKPI {
  total_contracts: string;
  avg_giai_tri: string;
  avg_phim_truyen: string;
  avg_the_thao: string;
  avg_thieu_nhi: string;
  avg_truyen_hinh: string;
  high_active: string;
  low_active: string;
}
interface ContentData {
  kpi: ContentKPI;
  mostWatch: { mostWatch: string; count: string }[];
  duration: {
    giai_tri_h: string; phim_truyen_h: string; the_thao_h: string;
    thieu_nhi_h: string; truyen_hinh_h: string;
  };
  taste: { taste: string; count: string }[];
  topContracts: {
    contract: string; total_hours: string; mostWatch: string;
    active: string; taste: string;
  }[];
}
interface SearchKPI {
  total_users: string;
  avg_search_count: string;
  avg_unique_kw: string;
  avg_quit_rate: string;
  high_active: string;
  low_active: string;
  has_plan: string;
  no_plan: string;
}
interface SearchData {
  kpi: SearchKPI;
  topInterest: { topInterest: string; count: string }[];
  interestSum: {
    truyen_hinh: string; the_thao: string; thieu_nhi: string;
    phim: string; giai_tri: string;
  };
  platform: { mainPlatform: string; count: string }[];
  isp: { mainISP: string; count: string }[];
  topUsers: {
    user_id: string; SearchCount: string; UniqueKeyword: string;
    SearchDays: string; quit_pct: string; TopInterest: string;
    MainPlatform: string; SearchActive: string;
  }[];
  plan: { planName: string; count: string }[];
}

// ─── COLOR PALETTES ─────────────────────────────────────────
const PALETTE_MAIN  = ['#3b82f6','#8b5cf6','#14b8a6','#f97316','#ec4899','#22c55e'];
const PALETTE_PASTEL = ['rgba(59,130,246,0.8)','rgba(139,92,246,0.8)','rgba(20,184,166,0.8)','rgba(249,115,22,0.8)','rgba(236,72,153,0.8)'];

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      labels: { color: '#94a3b8', font: { size: 12, family: 'Inter' }, padding: 16 },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#f1f5f9',
      bodyColor: '#94a3b8',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
    },
  },
};

const DONUT_OPTS = {
  ...CHART_DEFAULTS,
  cutout: '68%',
  plugins: {
    ...CHART_DEFAULTS.plugins,
    legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' as const },
  },
};

const BAR_OPTS = {
  ...CHART_DEFAULTS,
  indexAxis: 'y' as const,
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#64748b', font: { size: 11 } },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 12 } },
    },
  },
};

const BAR_VERT_OPTS = {
  ...CHART_DEFAULTS,
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.05)' },
      ticks: { color: '#64748b', font: { size: 11 } },
    },
  },
};

// ─── HELPER COMPONENTS ──────────────────────────────────────
function Loading() {
  return (
    <div className="loading-wrapper">
      <div className="spinner" />
      <span className="loading-text">Đang tải dữ liệu...</span>
    </div>
  );
}

function KPICard({
  icon, value, label, trend, color = '#3b82f6',
}: { icon: string; value: string; label: string; trend?: string; color?: string }) {
  return (
    <div className="kpi-card" style={{ '--kpi-color': color } as React.CSSProperties}>
      <span className="kpi-icon">{icon}</span>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {trend && <div className="kpi-trend trend-up">▲ {trend}</div>}
    </div>
  );
}

function ChartCard({
  title, subtitle, badge, children, colClass = 'col-6',
}: {
  title: string; subtitle?: string; badge?: string;
  children: React.ReactNode; colClass?: string;
}) {
  return (
    <div className={`chart-card ${colClass}`}>
      <div className="chart-card-header">
        <div>
          <div className="chart-title">{title}</div>
          {subtitle && <div className="chart-subtitle">{subtitle}</div>}
        </div>
        {badge && <span className="chart-badge">{badge}</span>}
      </div>
      <div className="chart-body">{children}</div>
    </div>
  );
}

function ActivePill({ value }: { value: string }) {
  return (
    <span className={`pill ${value === 'High' ? 'pill-high' : 'pill-low'}`}>
      {value === 'High' ? '● High' : '● Low'}
    </span>
  );
}

const INTEREST_COLOR: Record<string, string> = {
  TruyenHinh: 'pill-blue', TheThao: 'pill-teal',
  ThieuNhi: 'pill-pink', Phim: 'pill-violet', GiaiTri: 'pill-orange',
  Giai_Tri: 'pill-orange', Phim_Truyen: 'pill-violet',
  The_Thao: 'pill-teal', Thieu_Nhi: 'pill-pink', Truyen_Hinh: 'pill-blue',
};
function InterestPill({ value }: { value: string }) {
  return <span className={`pill ${INTEREST_COLOR[value] ?? 'pill-gray'}`}>{value}</span>;
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('vi-VN');
}

// ─── CONTENT TAB ────────────────────────────────────────────
function ContentTab({ data }: { data: ContentData }) {
  const { kpi, mostWatch, duration, taste, topContracts } = data;
  const total = Number(kpi.total_contracts);
  const highPct = Math.round((Number(kpi.high_active) / total) * 100);

  const mostWatchChart = {
    labels: mostWatch.map(r => r.mostWatch.replace('_', ' ')),
    datasets: [{
      data:            mostWatch.map(r => Number(r.count)),
      backgroundColor: PALETTE_MAIN,
      borderWidth:     0,
      hoverOffset:     8,
    }],
  };

  const durationLabels = ['Giải Trí', 'Phim Truyện', 'Thể Thao', 'Thiếu Nhi', 'Truyền Hình'];
  const durationValues = [
    Number(duration.giai_tri_h), Number(duration.phim_truyen_h),
    Number(duration.the_thao_h), Number(duration.thieu_nhi_h),
    Number(duration.truyen_hinh_h),
  ];
  const durationChart = {
    labels: durationLabels,
    datasets: [{
      label: 'Giờ xem (h)',
      data: durationValues,
      backgroundColor: PALETTE_PASTEL,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const activeChart = {
    labels: ['High Active', 'Low Active'],
    datasets: [{
      data:            [Number(kpi.high_active), Number(kpi.low_active)],
      backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(248,113,113,0.6)'],
      borderWidth:     0,
      hoverOffset:     8,
    }],
  };

  return (
    <div className="fade-in">
      {/* KPI Row */}
      <div className="kpi-grid">
        <KPICard icon="📋" value={fmt(kpi.total_contracts)} label="Tổng hợp đồng" color="#3b82f6" />
        <KPICard icon="🔥" value={`${highPct}%`} label="High Active" color="#22c55e" />
        <KPICard icon="🎬" value={fmt(kpi.avg_phim_truyen)} label="TB giây xem Phim" color="#8b5cf6" />
        <KPICard icon="📺" value={fmt(kpi.avg_truyen_hinh)} label="TB giây xem TV" color="#14b8a6" />
        <KPICard icon="⚽" value={fmt(kpi.avg_the_thao)} label="TB giây xem Thể Thao" color="#f97316" />
        <KPICard icon="🎭" value={fmt(kpi.avg_giai_tri)} label="TB giây xem Giải Trí" color="#ec4899" />
      </div>

      {/* Row 1: Donut + Bar + Donut */}
      <div className="charts-grid">
        <ChartCard title="Phân bổ MostWatch" subtitle="Thể loại xem nhiều nhất" colClass="col-4"
          badge={`${mostWatch.length} thể loại`}>
          <Doughnut data={mostWatchChart} options={DONUT_OPTS} />
        </ChartCard>

        <ChartCard title="Tổng thời gian xem" subtitle="Đơn vị: giờ (h) — toàn bộ contracts"
          colClass="col-5" badge="Tổng cộng">
          <Bar data={durationChart} options={BAR_OPTS} />
        </ChartCard>

        <ChartCard title="Phân bổ Active" subtitle="High vs Low active" colClass="col-3">
          <Doughnut data={activeChart} options={DONUT_OPTS} />
        </ChartCard>
      </div>

      {/* Row 2: Taste table + Top contracts */}
      <div className="charts-grid">
        <ChartCard title="Top Taste phổ biến" subtitle="Nhóm khẩu vị nội dung thường gặp nhất"
          colClass="col-5" badge="Top 10">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Taste (Khẩu vị)</th>
                  <th style={{ textAlign: 'right' }}>Contracts</th>
                </tr>
              </thead>
              <tbody>
                {taste.map((r, i) => (
                  <tr key={r.taste}>
                    <td>
                      <span className={`rank-num${i < 3 ? ` top${i+1}` : ''}`}>{i + 1}</span>
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: 240, whiteSpace: 'normal', lineHeight: 1.4 }}>
                      {r.taste}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#60a5fa' }}>
                      {fmt(r.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Top Contracts xem nhiều nhất" subtitle="Theo tổng giờ xem"
          colClass="col-7" badge="Top 20">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Contract ID</th>
                  <th>Tổng giờ</th>
                  <th>MostWatch</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {topContracts.map((r, i) => (
                  <tr key={r.contract}>
                    <td><span className={`rank-num${i < 3 ? ` top${i+1}` : ''}`}>{i + 1}</span></td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{r.contract}</td>
                    <td style={{ fontWeight: 700, color: '#60a5fa' }}>{r.total_hours}h</td>
                    <td><InterestPill value={r.mostWatch} /></td>
                    <td><ActivePill value={r.active} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── SEARCH TAB ─────────────────────────────────────────────
function SearchTab({ data }: { data: SearchData }) {
  const { kpi, topInterest, interestSum, platform, isp, topUsers, plan } = data;
  const total = Number(kpi.total_users);
  const highPct = Math.round((Number(kpi.high_active) / total) * 100);
  const hasPlanPct = Math.round((Number(kpi.has_plan) / total) * 100);

  const interestDonut = {
    labels: topInterest.map(r => r.topInterest),
    datasets: [{
      data:            topInterest.map(r => Number(r.count)),
      backgroundColor: PALETTE_MAIN,
      borderWidth:     0,
      hoverOffset:     8,
    }],
  };

  const interestBar = {
    labels: ['Truyền Hình', 'Thể Thao', 'Thiếu Nhi', 'Phim', 'Giải Trí'],
    datasets: [{
      label: 'Lượt tìm kiếm',
      data: [
        Number(interestSum.truyen_hinh), Number(interestSum.the_thao),
        Number(interestSum.thieu_nhi), Number(interestSum.phim),
        Number(interestSum.giai_tri),
      ],
      backgroundColor: PALETTE_PASTEL,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const platformChart = {
    labels: platform.map(r => r.mainPlatform),
    datasets: [{
      label: 'Số users',
      data: platform.map(r => Number(r.count)),
      backgroundColor: 'rgba(59,130,246,0.7)',
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const ispChart = {
    labels: isp.map(r => r.mainISP),
    datasets: [{
      label: 'Số users',
      data: isp.map(r => Number(r.count)),
      backgroundColor: 'rgba(139,92,246,0.7)',
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const planChart = {
    labels: plan.map(r => r.planName),
    datasets: [{
      label: 'Số users',
      data: plan.map(r => Number(r.count)),
      backgroundColor: 'rgba(20,184,166,0.7)',
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const planDonut = {
    labels: ['Có gói cước', 'Không có gói'],
    datasets: [{
      data:            [Number(kpi.has_plan), Number(kpi.no_plan)],
      backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(100,116,139,0.6)'],
      borderWidth:     0,
      hoverOffset:     8,
    }],
  };

  return (
    <div className="fade-in">
      {/* KPI Row */}
      <div className="kpi-grid">
        <KPICard icon="👤" value={fmt(kpi.total_users)} label="Tổng users" color="#3b82f6" />
        <KPICard icon="🔥" value={`${highPct}%`} label="High Search Active" color="#22c55e" />
        <KPICard icon="🔍" value={Number(kpi.avg_search_count).toFixed(1)} label="TB lượt tìm kiếm" color="#8b5cf6" />
        <KPICard icon="💡" value={Number(kpi.avg_unique_kw).toFixed(1)} label="TB keyword độc nhất" color="#14b8a6" />
        <KPICard icon="❌" value={`${(Number(kpi.avg_quit_rate) * 100).toFixed(1)}%`} label="Avg Quit Rate" color="#f97316" />
        <KPICard icon="📦" value={`${hasPlanPct}%`} label="Users có gói cước" color="#ec4899" />
      </div>

      {/* Row 1: Interest */}
      <div className="charts-grid">
        <ChartCard title="Phân bổ TopInterest" subtitle="Thể loại quan tâm nhất của mỗi user"
          colClass="col-4" badge={`${topInterest.length} thể loại`}>
          <Doughnut data={interestDonut} options={DONUT_OPTS} />
        </ChartCard>

        <ChartCard title="Tổng lượt tìm kiếm theo thể loại"
          subtitle="Tổng Interest của toàn bộ users"
          colClass="col-5" badge="Tất cả users">
          <Bar data={interestBar} options={BAR_OPTS} />
        </ChartCard>

        <ChartCard title="Gói cước" subtitle="Tỷ lệ users có / không có gói cước" colClass="col-3">
          <Doughnut data={planDonut} options={DONUT_OPTS} />
        </ChartCard>
      </div>

      {/* Row 2: Platform + ISP + Plan */}
      <div className="charts-grid">
        <ChartCard title="Thiết bị sử dụng" subtitle="MainPlatform phân bổ"
          colClass="col-4" badge="Top 10">
          <Bar data={platformChart} options={BAR_OPTS} height={220} />
        </ChartCard>

        <ChartCard title="Nhà mạng (ISP)" subtitle="MainISP phân bổ"
          colClass="col-4" badge="Top 10">
          <Bar data={ispChart} options={BAR_OPTS} height={220} />
        </ChartCard>

        <ChartCard title="Gói cước phổ biến" subtitle="PlanName phân bổ"
          colClass="col-4" badge="Top 10">
          <Bar data={planChart} options={BAR_VERT_OPTS} height={220} />
        </ChartCard>
      </div>

      {/* Row 3: Top users table */}
      <div className="charts-grid">
        <ChartCard title="Top 20 Users tìm kiếm nhiều nhất"
          subtitle="Xếp hạng theo tổng lượt tìm kiếm"
          colClass="col-12" badge="Top 20">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User ID</th>
                  <th>Lượt TK</th>
                  <th>Keyword</th>
                  <th>Ngày TK</th>
                  <th>Quit %</th>
                  <th>Top Interest</th>
                  <th>Platform</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((r, i) => (
                  <tr key={r.user_id}>
                    <td><span className={`rank-num${i < 3 ? ` top${i+1}` : ''}`}>{i + 1}</span></td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontSize: 12 }}>
                      {r.user_id}
                    </td>
                    <td style={{ fontWeight: 700, color: '#60a5fa' }}>{fmt(r.SearchCount)}</td>
                    <td>{fmt(r.UniqueKeyword)}</td>
                    <td>{r.SearchDays}</td>
                    <td>
                      <span style={{
                        color: Number(r.quit_pct) > 30 ? '#f87171' : '#94a3b8',
                        fontWeight: 600,
                      }}>
                        {r.quit_pct}%
                      </span>
                    </td>
                    <td><InterestPill value={r.TopInterest} /></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{r.MainPlatform}</td>
                    <td><ActivePill value={r.SearchActive} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState<'content' | 'search'>('content');
  const [contentData, setContentData] = useState<ContentData | null>(null);
  const [searchData, setSearchData]   = useState<SearchData | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingSearch,  setLoadingSearch]  = useState(false);
  const [errorContent, setErrorContent]     = useState('');
  const [errorSearch,  setErrorSearch]      = useState('');
  const fetchedRef = useRef({ content: false, search: false });

  useEffect(() => {
    if (tab === 'content' && !fetchedRef.current.content) {
      fetchedRef.current.content = true;
      setLoadingContent(true);
      fetch('/api/content-stats')
        .then(r => r.json())
        .then(d => {
          if (d.error) setErrorContent(d.error);
          else setContentData(d);
        })
        .catch(e => setErrorContent(String(e)))
        .finally(() => setLoadingContent(false));
    }
    if (tab === 'search' && !fetchedRef.current.search) {
      fetchedRef.current.search = true;
      setLoadingSearch(true);
      fetch('/api/search-stats')
        .then(r => r.json())
        .then(d => {
          if (d.error) setErrorSearch(d.error);
          else setSearchData(d);
        })
        .catch(e => setErrorSearch(String(e)))
        .finally(() => setLoadingSearch(false));
    }
  }, [tab]);

  return (
    <div className="layout-root">
      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-title">📡 CRM Analytics</div>
          <div className="sidebar-logo-sub">Data Engineering Dashboard</div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">Phân tích</div>
          <button
            id="tab-content"
            className={`sidebar-item ${tab === 'content' ? 'active' : ''}`}
            onClick={() => setTab('content')}
          >
            <span className="sidebar-item-icon">📺</span>
            Content Analytics
          </button>
          <button
            id="tab-search"
            className={`sidebar-item ${tab === 'search' ? 'active' : ''}`}
            onClick={() => setTab('search')}
          >
            <span className="sidebar-item-icon">🔍</span>
            Search Analytics
          </button>

          <div className="sidebar-label" style={{ marginTop: 16 }}>Nguồn dữ liệu</div>
          <div className="sidebar-item" style={{ cursor: 'default', fontSize: 12 }}>
            <span className="sidebar-item-icon">🗄️</span>
            logcontentdb
          </div>
          <div className="sidebar-item" style={{ cursor: 'default', fontSize: 12 }}>
            <span className="sidebar-item-icon">🗄️</span>
            logsearchdb
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-text">
            ETL bởi Apache Spark<br />
            PostgreSQL Local · {new Date().getFullYear()}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main-content">
        {tab === 'content' && (
          <>
            <div className="page-header">
              <div className="page-badge badge-blue">
                <span className="badge-dot" />
                logcontentdb · customer_content_stats
              </div>
              <h1 className="page-title">
                📺 Content <span style={{ color: '#3b82f6' }}>Analytics</span>
              </h1>
              <p className="page-subtitle">
                Phân tích hành vi xem nội dung theo hợp đồng — 5 thể loại: Giải Trí, Phim Truyện, Thể Thao, Thiếu Nhi, Truyền Hình
              </p>
            </div>

            {loadingContent && <Loading />}
            {errorContent && (
              <div className="error-box">
                ⚠️ Lỗi kết nối database: <strong>{errorContent}</strong>
                <br /><small>Kiểm tra PostgreSQL đang chạy và bảng customer_content_stats đã có dữ liệu.</small>
              </div>
            )}
            {contentData && !loadingContent && <ContentTab data={contentData} />}
          </>
        )}

        {tab === 'search' && (
          <>
            <div className="page-header">
              <div className="page-badge badge-violet">
                <span className="badge-dot" />
                logsearchdb · customer_search_stats
              </div>
              <h1 className="page-title">
                🔍 Search <span style={{ color: '#8b5cf6' }}>Analytics</span>
              </h1>
              <p className="page-subtitle">
                Phân tích hành vi tìm kiếm của users — interest, platform, ISP, gói cước và mức độ hoạt động
              </p>
            </div>

            {loadingSearch && <Loading />}
            {errorSearch && (
              <div className="error-box">
                ⚠️ Lỗi kết nối database: <strong>{errorSearch}</strong>
                <br /><small>Kiểm tra PostgreSQL đang chạy và bảng customer_search_stats đã có dữ liệu.</small>
              </div>
            )}
            {searchData && !loadingSearch && <SearchTab data={searchData} />}
          </>
        )}
      </main>
    </div>
  );
}
