import { RetailerSummary } from '@/types';
import { TrendingUp, DollarSign, PhoneForwarded, Activity } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface TopRetailersViewProps {
  retailers: RetailerSummary[];
  branch: string;
  loading: boolean;
}

export default function TopRetailersView({ retailers, branch, loading }: TopRetailersViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-[#21264E]">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading retailers data...
        </div>
      </div>
    );
  }

  if (!retailers || retailers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">No retailers available in {branch}</p>
        </div>
      </div>
    );
  }

  // Get top retailers by different criteria, excluding those with 0 for the metric
  const topByGA = [...retailers]
    .filter(r => r.ga_cnt > 0)
    .sort((a, b) => b.ga_cnt - a.ga_cnt)
    .slice(0, 5);

  const topByPortIn = [...retailers]
    .filter(r => r.port_in > 0)
    .sort((a, b) => b.port_in - a.port_in)
    .slice(0, 5);

  const topByIncentive = [...retailers]
    .filter(r => r.incentive > 0)
    .sort((a, b) => b.incentive - a.incentive)
    .slice(0, 5);

  const topByRenewalRate = [...retailers]
    .filter(r => r.renewal_rate > 0)
    .sort((a, b) => b.renewal_rate - a.renewal_rate)
    .slice(0, 5);

  // Chart data
  const gaChartData = topByGA.map(r => ({ name: r.retailer_id.slice(-4), value: r.ga_cnt }));
  const portInChartData = topByPortIn.map(r => ({ name: r.retailer_id.slice(-4), value: r.port_in }));
  const incentiveChartData = topByIncentive.map(r => ({ name: r.retailer_id.slice(-4), value: Math.round(r.incentive) }));
  const renewalChartData = topByRenewalRate.map(r => ({ name: r.retailer_id.slice(-4), value: parseFloat(r.renewal_rate.toFixed(1)) }));

  // Summary statistics
  const totalRetailers = retailers.length;
  const totalGA = retailers.reduce((sum, r) => sum + r.ga_cnt, 0);
  const totalIncentive = retailers.reduce((sum, r) => sum + r.incentive, 0);

  const COLORS = ['#245bc1', '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6'];

  const StatCard = ({ 
    icon: Icon, 
    title, 
    retailers: data, 
    formatter 
  }: { 
    icon: any; 
    title: string; 
    retailers: RetailerSummary[]; 
    formatter: (v: number) => string;
  }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className="text-[#245bc1]" />
        <h3 className="font-semibold text-sm text-[#21264E]">{title}</h3>
      </div>
      <div className="space-y-2">
        {data.length > 0 ? (
          data.map((r, idx) => (
            <div key={r.retailer_id} className="flex items-center justify-between pb-2 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${idx === 0 ? 'bg-[#245bc1] text-white' : idx === 1 ? 'bg-gray-200 text-[#21264E]' : idx === 2 ? 'bg-orange-200 text-[#21264E]' : 'bg-gray-100 text-[#21264E]'}`}>
                  #{idx + 1}
                </span>
                <div>
                  <p className="text-xs font-medium text-[#21264E]">{r.retailer_id}</p>
                  <p className="text-xs text-gray-500">{r.zone}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-[#245bc1]">{formatter(
                title.includes('GA') ? r.ga_cnt :
                title.includes('Port-In') ? r.port_in :
                title.includes('Paid') ? r.incentive :
                r.renewal_rate
              )}</p>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-500">No data available</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 overflow-y-auto bg-[#fafafa]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#21264E] mb-2">Retailer Performance Overview</h1>
        <div className="flex items-center gap-4">
          <p className="text-gray-600">Branch: <span className="font-semibold text-[#21264E]">{branch}</span></p>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-600">Total Retailers: </span>
              <span className="font-semibold text-[#245bc1]">{totalRetailers}</span>
            </div>
            <div>
              <span className="text-gray-600">Total GA: </span>
              <span className="font-semibold text-[#245bc1]">{totalGA.toLocaleString('en-IE')}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Incentive: </span>
              <span className="font-semibold text-[#245bc1]">€{totalIncentive.toLocaleString('en-IE', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* GA Activations Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-[#245bc1]" />
            <h3 className="font-semibold text-[#21264E]">Top GA Activations</h3>
          </div>
          {gaChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={gaChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => value.toLocaleString('en-IE')} />
                <Bar dataKey="value" fill="#245bc1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Port-In Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <PhoneForwarded size={18} className="text-[#245bc1]" />
            <h3 className="font-semibold text-[#21264E]">Top Port-In Activations</h3>
          </div>
          {portInChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={portInChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(value) => value.toLocaleString('en-IE')} />
                <Line type="monotone" dataKey="value" stroke="#245bc1" strokeWidth={2} dot={{ fill: '#245bc1', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Incentive Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-[#245bc1]" />
            <h3 className="font-semibold text-[#21264E]">Top Incentive Paid</h3>
          </div>
          {incentiveChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={incentiveChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: €${value.toLocaleString('en-IE')}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {incentiveChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `€${value.toLocaleString('en-IE')}`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>

        {/* Renewal Rate Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#245bc1]" />
            <h3 className="font-semibold text-[#21264E]">Best Renewal Rate</h3>
          </div>
          {renewalChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={renewalChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-gray-500">No data</div>
          )}
        </div>
      </div>

      {/* Detailed Rankings */}
      <h2 className="text-xl font-bold text-[#21264E] mb-4">Detailed Rankings</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          icon={TrendingUp}
          title="Top GA Activations"
          retailers={topByGA}
          formatter={(v) => v.toLocaleString('en-IE')}
        />
        <StatCard
          icon={PhoneForwarded}
          title="Top Port-In Activations"
          retailers={topByPortIn}
          formatter={(v) => v.toLocaleString('en-IE')}
        />
        <StatCard
          icon={DollarSign}
          title="Highest Paid (Incentive)"
          retailers={topByIncentive}
          formatter={(v) => `€${v.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          icon={Activity}
          title="Best Renewal Rate"
          retailers={topByRenewalRate}
          formatter={(v) => `${v.toFixed(1)}%`}
        />
      </div>
    </div>
  );
}
