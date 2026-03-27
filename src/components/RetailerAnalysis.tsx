import { useMemo } from 'react';
import type { RetailerSummary, RetailerMonthly } from '@/types';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts';
import {
  Activity, Target, AlertTriangle, BarChart3,
  Zap, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

interface Props {
  summary: RetailerSummary;
  monthlyData: RetailerMonthly[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEAR_COLORS: Record<string, string> = { '2024': '#006AE0', '2025': '#08DC7D', '2026': '#FFD54F' };
const PLAN_COLORS = { pi_l6: '#46286E', pi_g6: '#21264E', np_l6: '#006AE0', np_g6: '#08DC7D' };
const DEDUCTION_RED = '#F04438';

const fmt = (v: number) => `€${v.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtShort = (v: number) => {
  if (Math.abs(v) >= 1000) return `€${(v / 1000).toFixed(1)}k`;
  return `€${v.toFixed(0)}`;
};
const fmtN = (v: number) => v.toLocaleString('en-IE');
const fmtP = (v: number) => `${v.toFixed(1)}%`;

function ChartCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-[#21264E] mb-4 flex items-center gap-2">
        <BarChart3 size={16} className="text-[#245bc1]" />
        {title}
      </h3>
      {children}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function CTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-xl rounded-lg p-3 border border-gray-100 text-xs">
      <p className="font-semibold text-[#21264E] mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex items-center justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-medium">{typeof p.value === 'number' && p.value % 1 !== 0 ? fmt(p.value) : fmtN(p.value)}</span>
        </p>
      ))}
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function RetailerAnalysis({ summary, monthlyData }: Props) {
  const sorted = useMemo(() => [...monthlyData].sort((a, b) => a.month.localeCompare(b.month)), [monthlyData]);
  const years = useMemo(() => [...new Set(sorted.map(m => m.month.substring(0, 4)))].sort(), [sorted]);

  // Yearly totals
  const yearlyTotals = useMemo(() => years.map(yr => {
    const mos = sorted.filter(m => m.month.startsWith(yr));
    const sum = (fn: (m: RetailerMonthly) => number) => mos.reduce((s, m) => s + fn(m), 0);
    return {
      year: yr, monthCount: mos.length,
      incentive: sum(m => m.incentive), ga_cnt: sum(m => m.ga_cnt),
      pi_l6: sum(m => m.pi_l6), pi_g6: sum(m => m.pi_g6),
      np_l6: sum(m => m.np_l6), np_g6: sum(m => m.np_g6),
      port_in: sum(m => m.port_in), port_out: sum(m => m.port_out),
      po_deduction: sum(m => m.po_deduction), clawback: sum(m => m.clawback),
      renewal_impact: sum(m => m.renewal_impact), total_ded: sum(m => m.total_ded),
      pi_raw: sum(m => m.pi_raw), add_gara: sum(m => m.add_gara),
      pi_total: sum(m => m.pi_total),
      renewal_rate: mos.length > 0 ? sum(m => m.renewal_rate) / mos.length : 0,
    };
  }), [years, sorted]);

  // Calendar overlay data (months 1-12 with year columns)
  const calendarOverlay = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const monthNum = idx + 1;
      const point: Record<string, number | string> = { monthName: name };
      years.forEach(yr => {
        const mo = sorted.find(m => m.month === `${yr}-${String(monthNum).padStart(2, '0')}`);
        point[`incentive_${yr}`] = mo?.incentive ?? 0;
        point[`ga_${yr}`] = mo?.ga_cnt ?? 0;
        point[`renewal_${yr}`] = mo?.renewal_rate ?? 0;
        point[`port_in_${yr}`] = mo?.port_in ?? 0;
        point[`gara_${yr}`] = mo?.add_gara ?? 0;
      });
      return point;
    });
  }, [years, sorted]);

  // Full monthly timeline
  const timeline = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      ...m,
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
    };
  }), [sorted]);

  // Plan activation data per month
  const planTrends = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
      pi_l6: m.pi_l6, pi_g6: m.pi_g6,
      np_l6: m.np_l6, np_g6: m.np_g6,
    };
  }), [sorted]);

  // Plan mix by year (for donuts)
  const planMixByYear = useMemo(() => years.map(yr => {
    const mos = sorted.filter(m => m.month.startsWith(yr));
    const sum = (fn: (m: RetailerMonthly) => number) => mos.reduce((s, m) => s + fn(m), 0);
    return {
      year: yr,
      data: [
        { name: 'P-IN ≤€6.99', value: sum(m => m.pi_l6), color: PLAN_COLORS.pi_l6 },
        { name: 'P-IN >€6.99', value: sum(m => m.pi_g6), color: PLAN_COLORS.pi_g6 },
        { name: 'NEW ≤€6.99', value: sum(m => m.np_l6), color: PLAN_COLORS.np_l6 },
        { name: 'NEW >€6.99', value: sum(m => m.np_g6), color: PLAN_COLORS.np_g6 },
      ],
    };
  }), [years, sorted]);

  // Port-In + GARA monthly
  const portInGaraMonthly = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
      port_in: m.port_in,
      add_gara: m.add_gara,
      pi_total: m.pi_total,
    };
  }), [sorted]);

  // Port-In vs Deductions annual
  const piVsDedAnnual = useMemo(() => yearlyTotals.map(yt => ({
    year: yt.year,
    port_in: yt.port_in,
    total_ded: yt.total_ded,
    net: yt.port_in - yt.total_ded,
    fill: YEAR_COLORS[yt.year] || '#006AE0',
  })), [yearlyTotals]);

  // Deductions monthly
  const deductionsMonthly = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
      po_deduction: m.po_deduction,
      clawback: m.clawback,
      renewal_impact: m.renewal_impact,
    };
  }), [sorted]);

  // Deductions by year
  const deductionsByYear = useMemo(() => yearlyTotals.map(yt => ({
    year: yt.year,
    po_deduction: yt.po_deduction,
    clawback: yt.clawback,
    renewal_impact: yt.renewal_impact,
    total: yt.total_ded,
  })), [yearlyTotals]);

  // Renewal rate monthly
  const renewalMonthly = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
      renewal_rate: m.renewal_rate,
      year: yr,
    };
  }), [sorted]);

  // P-IN comparison monthly
  const piComparison = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
      pi_l6: m.pi_l6,
      pi_g6: m.pi_g6,
    };
  }), [sorted]);

  // NEW comparison monthly
  const newComparison = useMemo(() => sorted.map(m => {
    const [yr, mo] = m.month.split('-');
    return {
      label: `${MONTH_NAMES[parseInt(mo) - 1]} ${yr.slice(2)}`,
      np_l6: m.np_l6,
      np_g6: m.np_g6,
    };
  }), [sorted]);

  // Performance insights
  const latestMonth = sorted[sorted.length - 1];
  const prevMonth = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  const incentiveChange = prevMonth ? ((latestMonth.incentive - prevMonth.incentive) / Math.max(prevMonth.incentive, 1)) * 100 : 0;
  const gaChange = prevMonth ? latestMonth.ga_cnt - prevMonth.ga_cnt : 0;

  return (
    <div className="p-6 space-y-6">
      {/* 1. PERFORMANCE INSIGHTS */}
      <div>
        <h2 className="text-lg font-bold text-[#21264E] mb-4 flex items-center gap-2">
          <Zap size={20} className="text-[#FFD54F]" />
          Performance Insights
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Latest Incentive</p>
            <p className="text-xl font-bold text-[#21264E]">{fmt(latestMonth?.incentive ?? 0)}</p>
            {prevMonth && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${incentiveChange >= 0 ? 'text-[#08DC7D]' : 'text-[#F04438]'}`}>
                {incentiveChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(incentiveChange).toFixed(1)}% vs prev month
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Latest GA Count</p>
            <p className="text-xl font-bold text-[#21264E]">{fmtN(latestMonth?.ga_cnt ?? 0)}</p>
            {prevMonth && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${gaChange >= 0 ? 'text-[#08DC7D]' : 'text-[#F04438]'}`}>
                {gaChange >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(gaChange)} vs prev month
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Latest Renewal Rate</p>
            <p className="text-xl font-bold text-[#21264E]">{fmtP(latestMonth?.renewal_rate ?? 0)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Latest Deductions</p>
            <p className="text-xl font-bold text-[#F04438]">{fmt(latestMonth?.total_ded ?? 0)}</p>
          </div>
        </div>
      </div>

      {/* 2. YEAR-BY-YEAR OVERVIEW */}
      <ChartCard title="Year-by-Year Overview">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 px-3 text-[#21264E] font-semibold">Metric</th>
                {yearlyTotals.map(yt => (
                  <th key={yt.year} className="text-right py-2 px-3 font-semibold" style={{ color: YEAR_COLORS[yt.year] || '#21264E' }}>
                    {yt.year} ({yt.monthCount}mo)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-xs">
              {[
                { label: 'Total Incentive', key: 'incentive', format: fmt },
                { label: 'GA Activations', key: 'ga_cnt', format: fmtN },
                { label: 'P-IN ≤€6.99', key: 'pi_l6', format: fmt },
                { label: 'P-IN >€6.99', key: 'pi_g6', format: fmt },
                { label: 'NEW ≤€6.99', key: 'np_l6', format: fmt },
                { label: 'NEW >€6.99', key: 'np_g6', format: fmt },
                { label: 'Port-In', key: 'port_in', format: fmt },
                { label: 'Port-Out', key: 'port_out', format: fmtN },
                { label: 'PO Deduction', key: 'po_deduction', format: fmt },
                { label: 'Clawback', key: 'clawback', format: fmt },
                { label: 'Renewal Impact', key: 'renewal_impact', format: fmt },
                { label: 'Total Deductions', key: 'total_ded', format: fmt },
                { label: 'PI Raw', key: 'pi_raw', format: fmt },
                { label: 'Add GARA', key: 'add_gara', format: fmt },
                { label: 'PI Total', key: 'pi_total', format: fmt },
                { label: 'Avg Renewal Rate', key: 'renewal_rate', format: fmtP },
              ].map(row => (
                <tr key={row.key} className="border-b border-gray-50 hover:bg-[#fff7f2] transition">
                  <td className="py-2 px-3 text-[#21264E] font-medium">{row.label}</td>
                  {yearlyTotals.map(yt => {
                    const val = yt[row.key as keyof typeof yt] as number;
                    const isDeduction = ['po_deduction', 'clawback', 'renewal_impact', 'total_ded'].includes(row.key);
                    return (
                      <td key={yt.year} className={`text-right py-2 px-3 font-mono ${isDeduction ? 'text-[#F04438]' : 'text-[#21264E]'}`}>
                        {row.format(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* 3. ALL-TIME KPI SUMMARY */}
      <div>
        <h2 className="text-lg font-bold text-[#21264E] mb-4 flex items-center gap-2">
          <Target size={20} className="text-[#006AE0]" />
          All-Time KPI Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Incentive', value: fmt(summary.incentive), color: '#006AE0' },
            { label: 'GA Activations', value: fmtN(summary.ga_cnt), color: '#08DC7D' },
            { label: 'Port-In Total', value: fmt(summary.port_in), color: '#00D7FF' },
            { label: 'GARA Bonus', value: fmt(summary.add_gara), color: '#FFD54F' },
            { label: 'Avg Renewal', value: fmtP(summary.renewal_rate), color: '#46286E' },
            { label: 'Total Deductions', value: fmt(summary.total_deductions), color: DEDUCTION_RED },
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: kpi.color }} />
              <p className="text-xs text-gray-500 mb-1 pl-2">{kpi.label}</p>
              <p className="text-lg font-bold pl-2" style={{ color: kpi.color === DEDUCTION_RED ? DEDUCTION_RED : '#21264E' }}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. ANNUAL INCENTIVE YoY */}
      <ChartCard title="Annual Incentive - YoY">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyTotals}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fill: '#21264E', fontSize: 12 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Bar dataKey="incentive" name="Total Incentive" radius={[6, 6, 0, 0]}>
              {yearlyTotals.map(yt => (
                <Cell key={yt.year} fill={YEAR_COLORS[yt.year] || '#006AE0'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 5. MONTHLY INCENTIVE - CALENDAR OVERLAY */}
      <ChartCard title="Monthly Incentive - Calendar Overlay">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={calendarOverlay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="monthName" tick={{ fill: '#21264E', fontSize: 12 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            {years.map(yr => (
              <Line key={yr} type="monotone" dataKey={`incentive_${yr}`} name={yr}
                stroke={YEAR_COLORS[yr] || '#006AE0'} strokeWidth={2.5} dot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 6. FULL MONTHLY INCENTIVE TIMELINE */}
      <ChartCard title="Full Monthly Incentive Timeline">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeline}>
            <defs>
              <linearGradient id="incentiveGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006AE0" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#006AE0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Area type="monotone" dataKey="incentive" name="Incentive" stroke="#006AE0" fill="url(#incentiveGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 7. PLAN ACTIVATION TRENDS */}
      <ChartCard title="Plan Activation Trends">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={planTrends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="pi_l6" name="P-IN ≤€6.99" stackId="a" fill={PLAN_COLORS.pi_l6} />
            <Bar dataKey="pi_g6" name="P-IN >€6.99" stackId="a" fill={PLAN_COLORS.pi_g6} />
            <Bar dataKey="np_l6" name="NEW ≤€6.99" stackId="a" fill={PLAN_COLORS.np_l6} />
            <Bar dataKey="np_g6" name="NEW >€6.99" stackId="a" fill={PLAN_COLORS.np_g6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 8. P-IN ≤€6.99 vs P-IN >€6.99 */}
      <ChartCard title="P-IN ≤€6.99 vs P-IN >€6.99">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={piComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="pi_l6" name="P-IN ≤€6.99" fill={PLAN_COLORS.pi_l6} radius={[4, 4, 0, 0]} />
            <Bar dataKey="pi_g6" name="P-IN >€6.99" fill={PLAN_COLORS.pi_g6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 9. NEW ≤€6.99 vs NEW >€6.99 */}
      <ChartCard title="NEW ≤€6.99 vs NEW >€6.99">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={newComparison}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="np_l6" name="NEW ≤€6.99" fill={PLAN_COLORS.np_l6} radius={[4, 4, 0, 0]} />
            <Bar dataKey="np_g6" name="NEW >€6.99" fill={PLAN_COLORS.np_g6} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 10. PLAN MIX BY YEAR */}
      <ChartCard title="Plan Mix by Year">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {planMixByYear.map(pm => (
            <div key={pm.year} className="text-center">
              <p className="text-sm font-semibold mb-2" style={{ color: YEAR_COLORS[pm.year] || '#21264E' }}>{pm.year}</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pm.data}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pm.data.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {pm.data.map((d, i) => (
                  <span key={i} className="flex items-center gap-1 text-[10px] text-[#21264E]">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* 11. GA ACTIVATIONS - CALENDAR OVERLAY */}
      <ChartCard title="GA Activations - Calendar Overlay">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          {yearlyTotals.map(yt => (
            <div key={yt.year} className="flex items-center gap-3 bg-[#fff7f2] rounded-lg p-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: YEAR_COLORS[yt.year] || '#006AE0' }} />
              <div>
                <p className="text-xs text-gray-500">{yt.year} Total GA</p>
                <p className="text-lg font-bold text-[#21264E]">{fmtN(yt.ga_cnt)}</p>
              </div>
              <div className="ml-auto text-xs text-gray-400">{yt.monthCount} months</div>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={calendarOverlay}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="monthName" tick={{ fill: '#21264E', fontSize: 12 }} />
            <YAxis tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            {years.map(yr => (
              <Line key={yr} type="monotone" dataKey={`ga_${yr}`} name={`GA ${yr}`}
                stroke={YEAR_COLORS[yr] || '#006AE0'} strokeWidth={2.5}
                dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 7, strokeWidth: 2 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 11b. GA ACTIVATIONS - FULL TIMELINE BAR CHART */}
      <ChartCard title="GA Activations - Full Timeline">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={timeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Bar dataKey="ga_cnt" name="GA Activations" radius={[4, 4, 0, 0]}>
              {timeline.map((entry, i) => {
                const yr = entry.month.substring(0, 4);
                return <Cell key={i} fill={YEAR_COLORS[yr] || '#006AE0'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 12. PORT IN INCENTIVE + GARA BONUS MONTHLY */}
      <ChartCard title="PORT IN Incentive + GARA Bonus Monthly">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={portInGaraMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="port_in" name="Port-In Incentive" fill="#006AE0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="add_gara" name="GARA Bonus" fill="#08DC7D" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="pi_total" name="PI Total" stroke="#FFD54F" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 13. PORT-IN INCENTIVE VS DEDUCTIONS - ANNUAL */}
      <ChartCard title="Port-In Incentive vs Deductions - Annual">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={piVsDedAnnual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fill: '#21264E', fontSize: 12 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="port_in" name="Port-In Incentive" fill="#006AE0" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total_ded" name="Total Deductions" fill={DEDUCTION_RED} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 14. DEDUCTIONS ANALYSIS */}
      <div>
        <h2 className="text-lg font-bold text-[#21264E] mb-4 flex items-center gap-2">
          <AlertTriangle size={20} className="text-[#F04438]" />
          Deductions Analysis
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Deductions', value: fmt(summary.total_deductions) },
            { label: 'PO Deductions', value: fmt(summary.po_deduction) },
            { label: 'Clawback', value: fmt(summary.clawback) },
            { label: 'Renewal Impact', value: fmt(summary.renewal_impact) },
          ].map((d, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-[#F04438]/20 p-4">
              <p className="text-xs text-gray-500 mb-1">{d.label}</p>
              <p className="text-xl font-bold text-[#F04438]">{d.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 15. DEDUCTIONS MONTHLY */}
      <ChartCard title="Deductions Monthly">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={deductionsMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} domain={[0, 'auto']} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="po_deduction" name="PO Deduction" stackId="ded" fill="#F04438" />
            <Bar dataKey="clawback" name="Clawback" stackId="ded" fill="#F04438" fillOpacity={0.7} />
            <Bar dataKey="renewal_impact" name="Renewal Impact" stackId="ded" fill="#F04438" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 16. DEDUCTIONS BY YEAR */}
      <ChartCard title="Deductions by Year">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={deductionsByYear}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fill: '#21264E', fontSize: 12 }} />
            <YAxis tickFormatter={fmtShort} tick={{ fill: '#21264E', fontSize: 11 }} domain={[0, 'auto']} />
            <Tooltip content={<CTooltip />} />
            <Legend />
            <Bar dataKey="po_deduction" name="PO Deduction" fill="#F04438" radius={[4, 4, 0, 0]} />
            <Bar dataKey="clawback" name="Clawback" fill="#F04438" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
            <Bar dataKey="renewal_impact" name="Renewal Impact" fill="#F04438" fillOpacity={0.4} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* 17. RENEWAL RATE MONTHLY */}
      <ChartCard title="Renewal Rate Monthly">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={renewalMonthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fill: '#21264E', fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} tick={{ fill: '#21264E', fontSize: 11 }} />
            <Tooltip content={<CTooltip />} />
            <Line type="monotone" dataKey="renewal_rate" name="Renewal Rate %" stroke="#46286E" strokeWidth={2.5}
              dot={/* eslint-disable @typescript-eslint/no-explicit-any */
                ((props: any) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null) return null;
                  return <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={YEAR_COLORS[payload?.year] || '#46286E'} stroke="#fff" strokeWidth={2} />;
                }) as any
              /* eslint-enable @typescript-eslint/no-explicit-any */}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Retailer details footer */}
      <div className="bg-[#21264E] rounded-xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={16} className="text-[#FFD54F]" />
          <h3 className="text-sm font-semibold">Retailer Details</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-white/50">Retailer ID</p>
            <p className="font-semibold">{summary.retailer_id}</p>
          </div>
          <div>
            <p className="text-white/50">Branch</p>
            <p className="font-semibold">{summary.branch}</p>
          </div>
          <div>
            <p className="text-white/50">Zone</p>
            <p className="font-semibold">{summary.zone}</p>
          </div>
          <div>
            <p className="text-white/50">Data Range</p>
            <p className="font-semibold">{sorted[0]?.month} → {sorted[sorted.length - 1]?.month}</p>
          </div>
        </div>
      </div>

      {/* Confidential footer */}
      <p className="text-center text-[10px] text-gray-400 pb-4">
        CONFIDENTIAL — Proprietary retailer performance data. For internal use only. Unauthorised distribution prohibited.
      </p>
    </div>
  );
}
