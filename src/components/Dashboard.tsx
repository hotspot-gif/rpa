import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { RetailerSummary, RetailerMonthly } from '@/types';
import RetailerAnalysis from '@/components/RetailerAnalysis';
import TopRetailersView from '@/components/TopRetailersView';
import DataImport from '@/components/DataImport';
import UserManagement from '@/components/UserManagement';
import {
  LayoutDashboard, Upload, LogOut, Search, User, Building2, Shield, FileDown, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import { generatePDF } from '@/utils/pdfExport';
import { BRANCH_TO_ZONES, normalizeBranch } from '@/data/mockData';

const VIEWS = { DASHBOARD: 'dashboard', IMPORT: 'import', USERS: 'users' } as const;
type View = (typeof VIEWS)[keyof typeof VIEWS];

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [view, setView] = useState<View>(VIEWS.DASHBOARD);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [zones, setZones] = useState<string[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [retailers, setRetailers] = useState<RetailerSummary[]>([]);
  const [selectedRetailerId, setSelectedRetailerId] = useState('');
  const [retailerSearch, setRetailerSearch] = useState('');
  const [monthlyData, setMonthlyData] = useState<RetailerMonthly[]>([]);
  const [loadingRetailers, setLoadingRetailers] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [showRetailerDropdown, setShowRetailerDropdown] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Determine available branches based on role
  useEffect(() => {
    if (!user) return;
    
    // Fetch branches that actually have retailers in the database
    supabase
      .from('retailer_summary')
      .select('branch', { count: 'exact' })
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('Error fetching branches:', error);
          return;
        }
        
        if (data) {
          // Get unique branches from database
          const uniqueBranches = [...new Set(data.map((r: any) => r.branch))];
          
          // Filter based on user role
          let availableBranches: string[] = [];
          if (user.role === 'HS-ADMIN') {
            // Admin can see all branches that have data
            availableBranches = (uniqueBranches as string[]);
          } else {
            // Other roles only see their assigned branches that have data
            const userBranches = (user.branches || []).map(normalizeBranch);
            availableBranches = (uniqueBranches as string[]).filter((b: string) => 
              userBranches.includes(normalizeBranch(b))
            );
          }
          
          setBranches(availableBranches);
          if (availableBranches.length > 0 && !selectedBranch) {
            setSelectedBranch(availableBranches[0]);
          }
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Update zones when branch changes
  useEffect(() => {
    if (!selectedBranch) return;

    // First try the hardcoded mapping for known branches
    if (BRANCH_TO_ZONES[selectedBranch]) {
      const branchZones = BRANCH_TO_ZONES[selectedBranch];
      setZones(branchZones);
      setSelectedZone(branchZones[0] || '');
      return;
    }

    // If not in hardcoded mapping, fetch zones from database for this branch
    setLoadingRetailers(true);
    supabase
      .from('retailer_summary')
      .select('zone')
      .eq('branch', selectedBranch)
      .then(({ data, error }) => {
        if (!error && data) {
          const uniqueZones = [...new Set(data.map((r: any) => r.zone))];
          setZones(uniqueZones);
          if (uniqueZones.length > 0) {
            setSelectedZone(uniqueZones[0]);
          }
        }
        setLoadingRetailers(false);
      });
  }, [selectedBranch]);

  // Fetch retailers when branch or zone changes
  const fetchRetailers = useCallback(async () => {
    if (!selectedBranch || !selectedZone) return;
    setLoadingRetailers(true);
    const { data, error } = await supabase
      .from('retailer_summary')
      .select('*')
      .eq('branch', selectedBranch)
      .eq('zone', selectedZone)
      .order('retailer_id');
    if (!error && data) setRetailers(data as RetailerSummary[]);
    setLoadingRetailers(false);
  }, [selectedBranch, selectedZone]);

  useEffect(() => {
    fetchRetailers();
    setSelectedRetailerId('');
    setRetailerSearch('');
    setMonthlyData([]);
  }, [fetchRetailers]);

  // Fetch monthly data when retailer changes
  useEffect(() => {
    if (!selectedRetailerId) { setMonthlyData([]); return; }
    setLoadingMonthly(true);
    supabase
      .from('retailer_monthly')
      .select('*')
      .eq('retailer_id', selectedRetailerId)
      .order('month')
      .then(({ data, error }: { data: any; error: any }) => {
        if (!error && data) setMonthlyData(data as RetailerMonthly[]);
        setLoadingMonthly(false);
      });
  }, [selectedRetailerId]);

  const selectedSummary = retailers.find((r: RetailerSummary) => r.retailer_id === selectedRetailerId);
  const filteredRetailers = retailers.filter((r: RetailerSummary) =>
    r.retailer_id.toLowerCase().includes(retailerSearch.toLowerCase())
  );

  const handleExportPDF = async () => {
    if (!selectedSummary || monthlyData.length === 0 || !user) return;
    setExportingPdf(true);
    try {
      await generatePDF(selectedSummary, monthlyData, user);
    } catch (e) {
      console.error('PDF export failed:', e);
    }
    setExportingPdf(false);
  };

  const roleLabel = user?.role === 'HS-ADMIN' ? 'Admin' : user?.role === 'RSM' ? 'Regional Manager' : 'Area Manager';
  const roleBadgeColor = user?.role === 'HS-ADMIN' ? 'bg-[#46286E]' : user?.role === 'RSM' ? 'bg-[#006AE0]' : 'bg-[#08DC7D]';

  return (
    <div className="flex h-screen bg-[#fff7f2] overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-[72px]' : 'w-64'} bg-[#21264E] text-white flex flex-col transition-all duration-300 flex-shrink-0`}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10 flex items-center justify-center gap-3">
          <img
            src="https://cms-assets.ldsvcplatform.com/IT/s3fs-public/2023-09/MicrosoftTeams-image%20%2813%29.png"
            alt="Logo"
            className={`flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'h-8 w-8' : 'h-10 w-10'}`}
          />
          {!sidebarCollapsed && <span className="font-bold text-sm leading-tight">Retailer<br/>Analytics</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setView(VIEWS.DASHBOARD)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
              view === VIEWS.DASHBOARD ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            {!sidebarCollapsed && 'Dashboard'}
          </button>
          {user?.role === 'HS-ADMIN' && (
            <button
              onClick={() => setView(VIEWS.IMPORT)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                view === VIEWS.IMPORT ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Upload size={20} />
              {!sidebarCollapsed && 'Data Import'}
            </button>
          )}
          {user?.role === 'HS-ADMIN' && (
            <button
              onClick={() => setView(VIEWS.USERS)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                view === VIEWS.USERS ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Users size={20} />
              {!sidebarCollapsed && 'User Management'}
            </button>
          )}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          {!sidebarCollapsed && (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.full_name}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${roleBadgeColor} text-white mt-0.5`}>
                    {roleLabel}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-white/50 text-xs mb-3">
                <Building2 size={12} />
                <span className="truncate">{user?.branches?.join(', ')}</span>
              </div>
            </>
          )}
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            <LogOut size={16} />
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-2.5 text-white/40 hover:text-white text-center border-t border-white/10 flex items-center justify-center"
        >
          {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        {view === VIEWS.DASHBOARD && (
          <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
            {/* Branch selector */}
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-[#21264E]" />
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-[#21264E] focus:ring-2 focus:ring-[#245bc1] outline-none"
              >
                {branches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Zone selector */}
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-[#21264E]" />
              <select
                value={selectedZone}
                onChange={e => setSelectedZone(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-[#21264E] focus:ring-2 focus:ring-[#245bc1] outline-none"
              >
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>

            {/* Retailer selector */}
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={retailerSearch}
                onChange={e => { setRetailerSearch(e.target.value); setShowRetailerDropdown(true); }}
                onFocus={() => setShowRetailerDropdown(true)}
                placeholder={loadingRetailers ? 'Loading retailers...' : `Search retailers in ${selectedBranch}...`}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg text-[#21264E] placeholder:text-gray-400 focus:ring-2 focus:ring-[#245bc1] outline-none"
              />
              {showRetailerDropdown && filteredRetailers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                  {filteredRetailers.map(r => (
                    <button
                      key={r.retailer_id}
                      onClick={() => {
                        setSelectedRetailerId(r.retailer_id);
                        setRetailerSearch(r.retailer_id);
                        setShowRetailerDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[#fff7f2] transition flex items-center justify-between ${
                        r.retailer_id === selectedRetailerId ? 'bg-[#fff7f2] font-medium' : ''
                      }`}
                    >
                      <span className="text-[#21264E]">{r.retailer_id}</span>
                      <span className="text-xs text-gray-400">{r.zone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected retailer info */}
            {selectedSummary && (
              <div className="flex items-center gap-3 text-sm">
                <span className="bg-[#21264E] text-white px-3 py-1 rounded-full text-xs font-medium">
                  {selectedSummary.retailer_id}
                </span>
                <span className="text-gray-500">{selectedSummary.zone}</span>
              </div>
            )}

            {/* PDF Export */}
            {selectedSummary && monthlyData.length > 0 && (
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="flex items-center gap-2 px-4 py-2 bg-[#21264E] hover:bg-[#245bc1] text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                <FileDown size={16} />
                {exportingPdf ? 'Exporting...' : 'Export PDF'}
              </button>
            )}
          </header>
        )}

        {/* Click-away listener for dropdown */}
        {showRetailerDropdown && (
          <div className="fixed inset-0 z-40" onClick={() => setShowRetailerDropdown(false)} />
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {view === VIEWS.USERS && user?.role === 'HS-ADMIN' ? (
            <UserManagement />
          ) : view === VIEWS.IMPORT && user?.role === 'HS-ADMIN' ? (
            <DataImport />
          ) : !selectedRetailerId ? (
            <TopRetailersView 
              retailers={retailers}
              branch={selectedBranch}
              loading={loadingRetailers}
            />
          ) : loadingMonthly ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3 text-[#21264E]">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading retailer data...
              </div>
            </div>
          ) : selectedSummary ? (
            <RetailerAnalysis
              summary={selectedSummary}
              monthlyData={monthlyData}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
