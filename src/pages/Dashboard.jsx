import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Map as MapIcon, 
  List, 
  Filter, 
  Search, 
  X, 
  LayoutGrid, 
  Activity, 
  TrendingUp, 
  RefreshCw, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import MapView from '../components/dashboard/MapView';
import IssueDetailModal from '../components/dashboard/IssueDetailModal';
import { Button } from '../components/ui';
import IssueTypeTag from '../components/ui/IssueTypeTag';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { fetchAllReports } from '../services/dataService';
import { CIVIC_CATEGORIES, REPORT_STATUSES } from '../utils/userUtils';
import { useNavigate } from 'react-router-dom';

const CATEGORY_CONFIG = {
  'Damaged concrete structures': { label: 'Damaged Concrete', icon: '🧱' },
  'DamagedElectricalPoles': { label: 'Damaged Electrical Poles', icon: '⚡' },
  'DamagedRoadSigns': { label: 'Damaged Road Signs', icon: '🛑' },
  'DeadAnimalsPollution': { label: 'Dead Animals / Hazard', icon: '⚠️' },
  'FallenTrees': { label: 'Fallen Trees', icon: '🌳' },
  'Garbage': { label: 'Garbage & Waste', icon: '🗑️' },
  'Graffitti': { label: 'Graffiti', icon: '🎨' },
  'IllegalParking': { label: 'Illegal Parking', icon: '🚫' },
  'Potholes and RoadCracks': { label: 'Potholes & Road Cracks', icon: '🕳️' },
  'Waterlogging': { label: 'Waterlogging & Flooding', icon: '🌊' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAuthority, loading: authLoading } = useAuth();

  // Active section tab: 'overview' | 'all' | <category_name>
  const [activeTab, setActiveTab] = useState('overview');
  const [issues, setIssues] = useState([]);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards' | 'map'
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Route protection: Only Authority can access
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login');
      } else if (!isAuthority) {
        navigate('/my-reports');
      }
    }
  }, [user, isAuthority, authLoading, navigate]);

  // Load all reports for Authority
  const loadData = async () => {
    setLoadingIssues(true);
    try {
      const data = await fetchAllReports();
      setIssues(data);
    } catch (err) {
      console.error('Error loading reports in dashboard:', err);
    } finally {
      setLoadingIssues(false);
    }
  };

  useEffect(() => {
    if (user && isAuthority) {
      loadData();
    }
  }, [user, isAuthority]);

  // Filter issues based on active tab, status, and search query
  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      // 1. Tab category filtering
      if (activeTab !== 'overview' && activeTab !== 'all') {
        const cat = issue.category || issue.predictedClass;
        if (cat !== activeTab) return false;
      }

      // 2. Status filter
      if (statusFilter !== 'all' && issue.status !== statusFilter) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (issue.description || '').toLowerCase();
        const cat = (issue.category || issue.predictedClass || '').toLowerCase();
        const addr = (issue.location?.address || '').toLowerCase();
        const reporter = (issue.reporterName || issue.reporterEmail || '').toLowerCase();
        const id = (issue.id || '').toLowerCase();
        if (!desc.includes(q) && !cat.includes(q) && !addr.includes(q) && !reporter.includes(q) && !id.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [issues, activeTab, statusFilter, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = {};
    CIVIC_CATEGORIES.forEach(cat => counts[cat] = 0);
    issues.forEach(issue => {
      const cat = issue.category || issue.predictedClass;
      if (cat && counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [issues]);

  // Global KPIs
  const kpis = useMemo(() => {
    const total = issues.length;
    const submitted = issues.filter(i => i.status === 'Submitted').length;
    const inProgress = issues.filter(i => ['Under Review', 'Assigned', 'In Progress'].includes(i.status)).length;
    const resolved = issues.filter(i => i.status === 'Resolved').length;
    return { total, submitted, inProgress, resolved };
  }, [issues]);

  return (
    <div className="min-h-screen bg-cream pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Authority Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-6 border-b border-cream-muted">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-accent/10 border border-accent/30 text-accent font-display text-[11px] font-bold uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                Municipal Authority Portal
              </span>
              <span className="text-xs text-slate-muted font-body">
                Official City Administration
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate tracking-tight">
              City Authority Dashboard
            </h1>
            <p className="font-body text-slate-muted text-sm mt-1">
              Real-time inspection oversight, 9-category issue routing, and citizen resolution workflow.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loadingIssues}
              className="flex items-center gap-2 px-4 py-2.5 bg-cream border border-cream-muted text-slate hover:border-slate/40 font-display text-xs font-semibold uppercase tracking-wider transition-all shadow-sm"
              title="Refresh Reports"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingIssues ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Overview, All Reports, 9 Categories) */}
        <div className="mb-8 border-b border-cream-muted">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin">
            {/* Overview Tab */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
                activeTab === 'overview'
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-slate-muted hover:text-slate hover:border-cream-muted'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {/* All Reports Tab */}
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
                activeTab === 'all'
                  ? 'border-accent text-accent bg-accent/5'
                  : 'border-transparent text-slate-muted hover:text-slate hover:border-cream-muted'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>All Reports</span>
              <span className="px-1.5 py-0.2 bg-cream-muted text-slate text-[10px] font-bold">
                {issues.length}
              </span>
            </button>

            <div className="h-5 w-px bg-cream-muted mx-1" />

            {/* 9 Category Tabs */}
            {CIVIC_CATEGORIES.map(cat => {
              const cfg = CATEGORY_CONFIG[cat] || { label: cat, icon: '📋' };
              const count = categoryCounts[cat] || 0;
              const isActive = activeTab === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 font-display text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-all ${
                    isActive
                      ? 'border-blueprint text-blueprint bg-blueprint/5'
                      : 'border-transparent text-slate-muted hover:text-slate hover:border-cream-muted'
                  }`}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? 'bg-blueprint text-cream' : 'bg-cream-dark text-slate-muted'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* OVERVIEW TAB CONTENT */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-6 bg-cream border border-cream-muted shadow-sm">
                <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">Total Civic Issues</span>
                <span className="font-display text-4xl font-bold text-slate">{kpis.total}</span>
              </div>
              <div className="p-6 bg-cream border border-cream-muted shadow-sm">
                <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">New / Submitted</span>
                <span className="font-display text-4xl font-bold text-blueprint">{kpis.submitted}</span>
              </div>
              <div className="p-6 bg-cream border border-cream-muted shadow-sm">
                <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">Under Review / Active</span>
                <span className="font-display text-4xl font-bold text-warning">{kpis.inProgress}</span>
              </div>
              <div className="p-6 bg-cream border border-cream-muted shadow-sm">
                <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">Resolved & Closed</span>
                <span className="font-display text-4xl font-bold text-success">{kpis.resolved}</span>
              </div>
            </div>

            {/* 9 Categories Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate">
                    Automated Category Distribution
                  </h2>
                  <p className="font-body text-xs text-slate-muted">
                    Reports automatically routed by our custom MobileNetV3 image-classification model.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs font-display font-semibold uppercase tracking-wider text-accent hover:underline flex items-center gap-1"
                >
                  <span>View All Reports</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {CIVIC_CATEGORIES.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat] || { label: cat, icon: '📋' };
                  const count = categoryCounts[cat] || 0;

                  return (
                    <motion.div
                      key={cat}
                      whileHover={{ y: -2 }}
                      onClick={() => setActiveTab(cat)}
                      className="p-5 bg-cream border border-cream-muted hover:border-blueprint/40 shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-cream-dark flex items-center justify-center text-xl shadow-inner">
                          {cfg.icon}
                        </div>
                        <div>
                          <h3 className="font-display font-bold text-sm text-slate">
                            {cfg.label}
                          </h3>
                          <span className="font-body text-xs text-slate-muted">
                            {count === 1 ? '1 issue reported' : `${count} issues reported`}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-muted" />
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Live City Map View */}
            <div className="p-6 bg-cream border border-cream-muted shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-accent" />
                  <h3 className="font-display text-lg font-bold text-slate">
                    City-Wide Issue Map
                  </h3>
                </div>
                <span className="text-xs font-body text-slate-muted">
                  Interactive GIS representation of all geo-tagged reports
                </span>
              </div>
              <div className="w-full">
                <MapView 
                  issues={issues} 
                  onSelectIssue={(issue) => setSelectedIssue(issue)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ALL REPORTS & CATEGORY SECTIONS */}
        {activeTab !== 'overview' && (
          <div className="space-y-6">
            
            {/* Section Banner */}
            <div className="p-5 bg-cream border border-cream-muted flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="font-display text-xs uppercase tracking-wider text-accent font-semibold">
                  {activeTab === 'all' ? 'Universal Registry' : 'Category Inspection Section'}
                </span>
                <h2 className="font-display text-2xl font-bold text-slate">
                  {activeTab === 'all' ? 'All Submitted Reports' : CATEGORY_CONFIG[activeTab]?.label || activeTab}
                </h2>
                <p className="font-body text-xs text-slate-muted mt-0.5">
                  Showing {filteredIssues.length} report{filteredIssues.length === 1 ? '' : 's'} matching current criteria.
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-cream-dark p-1 border border-cream-muted shrink-0">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 transition-colors ${viewMode === 'table' ? 'bg-slate text-cream' : 'text-slate-muted hover:text-slate'}`}
                  title="Table View"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 transition-colors ${viewMode === 'cards' ? 'bg-slate text-cream' : 'text-slate-muted hover:text-slate'}`}
                  title="Card View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-1.5 transition-colors ${viewMode === 'map' ? 'bg-slate text-cream' : 'text-slate-muted hover:text-slate'}`}
                  title="Map View"
                >
                  <MapIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-muted absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Report ID, Reporter Name, Email, Address, or Description..."
                  className="w-full pl-10 pr-4 py-2.5 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {['all', ...REPORT_STATUSES].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider border whitespace-nowrap transition-colors ${
                      statusFilter === st
                        ? 'bg-slate text-cream border-slate'
                        : 'bg-cream text-slate-muted border-cream-muted hover:border-slate/30'
                    }`}
                  >
                    {st === 'all' ? 'All' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Display */}
            {loadingIssues ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-2 border-slate border-t-accent rounded-full animate-spin mx-auto mb-3" />
                <p className="font-display text-sm uppercase tracking-wider text-slate-muted">Loading reports...</p>
              </div>
            ) : filteredIssues.length === 0 ? (
              <div className="p-12 text-center bg-cream/60 border border-dashed border-cream-muted">
                <AlertCircle className="w-10 h-10 text-slate-muted/40 mx-auto mb-2" />
                <h3 className="font-display text-base font-semibold text-slate mb-1">
                  No reports found
                </h3>
                <p className="font-body text-slate-muted text-xs">
                  There are no submitted reports matching the selected category and filters.
                </p>
              </div>
            ) : viewMode === 'map' ? (
              <div className="w-full">
                <MapView 
                  issues={filteredIssues} 
                  onSelectIssue={(issue) => setSelectedIssue(issue)}
                />
              </div>
            ) : viewMode === 'table' ? (
              /* TABLE VIEW: Shows all required fields */
              <div className="bg-cream border border-cream-muted shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-body">
                  <thead>
                    <tr className="bg-cream-dark/70 border-b border-cream-muted font-display text-[11px] uppercase tracking-wider text-slate">
                      <th className="p-3">Photo</th>
                      <th className="p-3">Report ID / Date</th>
                      <th className="p-3">Citizen Reporter</th>
                      <th className="p-3">Detected Category</th>
                      <th className="p-3">Location & Address</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-muted">
                    {filteredIssues.map((issue) => {
                      const repName = issue.reporterName || `${issue.reporterFirstName || ''} ${issue.reporterLastName || ''}`.trim() || issue.reportedBy || 'Citizen';
                      const repEmail = issue.reporterEmail || issue.userEmail || 'N/A';
                      const repPhone = issue.reporterPhone || '';
                      const dateFormatted = issue.createdAt 
                        ? new Date(issue.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Recent';
                      const conf = issue.classifierConfidence || issue.aiAnalysis?.confidence;

                      return (
                        <tr 
                          key={issue.id}
                          className="hover:bg-cream-dark/30 transition-colors"
                        >
                          {/* Image thumbnail */}
                          <td className="p-3 w-16">
                            <div 
                              onClick={() => setSelectedIssue(issue)}
                              className="w-14 h-14 bg-cream-dark border border-cream-muted overflow-hidden shrink-0 cursor-pointer"
                            >
                              {issue.imageUrl ? (
                                <img
                                  src={issue.imageUrl}
                                  alt={issue.category || 'Issue'}
                                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-muted/40">
                                  N/A
                                </div>
                              )}
                            </div>
                          </td>

                          {/* ID & Date */}
                          <td className="p-3">
                            <span className="font-mono text-[10px] text-slate-muted block">
                              #{issue.id.slice(0, 10)}...
                            </span>
                            <span className="font-semibold text-slate block mt-0.5">
                              {dateFormatted}
                            </span>
                          </td>

                          {/* Citizen Reporter Details */}
                          <td className="p-3">
                            <span className="font-display font-semibold text-slate block">
                              {repName}
                            </span>
                            <span className="text-slate-muted text-[11px] block truncate max-w-[150px]">
                              {repEmail}
                            </span>
                            {repPhone && (
                              <span className="text-slate-muted/80 text-[10px] block">
                                📞 {repPhone}
                              </span>
                            )}
                          </td>

                          {/* Category & Confidence */}
                          <td className="p-3">
                            <IssueTypeTag type={issue.category || issue.manualLabel || 'other'} size="sm" />
                            {conf !== null && conf !== undefined && (
                              <span className="text-[10px] font-display font-bold text-blueprint block mt-1">
                                AI: {(conf * 100).toFixed(0)}% Conf
                              </span>
                            )}
                          </td>

                          {/* Location */}
                          <td className="p-3 max-w-xs">
                            <p className="line-clamp-2 text-slate font-body">
                              {issue.location?.address || 'Location on map'}
                            </p>
                            {issue.location?.lat && (
                              <span className="text-[10px] font-mono text-slate-muted block">
                                {issue.location.lat.toFixed(4)}, {issue.location.lng.toFixed(4)}
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3">
                            <StatusBadge status={issue.status || 'Submitted'} />
                          </td>

                          {/* Action Button */}
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setSelectedIssue(issue)}
                              className="px-3 py-1.5 bg-slate text-cream hover:bg-accent font-display text-[10px] font-semibold uppercase tracking-wider transition-colors shadow-sm"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* CARD VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredIssues.map((issue) => {
                  const repName = issue.reporterName || `${issue.reporterFirstName || ''} ${issue.reporterLastName || ''}`.trim() || issue.reportedBy || 'Citizen';
                  const conf = issue.classifierConfidence || issue.aiAnalysis?.confidence;

                  return (
                    <div
                      key={issue.id}
                      className="bg-cream border border-cream-muted shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden"
                    >
                      {/* Image */}
                      <div className="relative h-44 bg-cream-dark border-b border-cream-muted overflow-hidden">
                        {issue.imageUrl ? (
                          <img
                            src={issue.imageUrl}
                            alt={issue.category || 'Issue'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-muted">
                            No image
                          </div>
                        )}
                        <div className="absolute top-2 left-2">
                          <IssueTypeTag type={issue.category || issue.manualLabel || 'other'} size="sm" />
                        </div>
                        <div className="absolute top-2 right-2">
                          <StatusBadge status={issue.status || 'Submitted'} />
                        </div>
                        {conf !== null && conf !== undefined && (
                          <div className="absolute bottom-2 left-2 bg-slate/90 text-cream px-2 py-0.5 text-[10px] font-display uppercase tracking-wider">
                            {(conf * 100).toFixed(0)}% Conf
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          {/* Reporter Info */}
                          <div className="mb-2 pb-2 border-b border-cream-muted text-xs text-slate">
                            <span className="font-display font-semibold block">{repName}</span>
                            <span className="text-slate-muted text-[11px] truncate block">{issue.reporterEmail || issue.userEmail}</span>
                            {issue.reporterPhone && <span className="text-slate-muted text-[10px] block">📞 {issue.reporterPhone}</span>}
                          </div>

                          <p className="font-body text-xs text-slate-muted line-clamp-3 mb-3 leading-relaxed">
                            {issue.description || 'No description provided.'}
                          </p>

                          {issue.location?.address && (
                            <div className="flex items-start gap-1.5 text-xs text-slate-muted font-body mb-3">
                              <MapPin className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{issue.location.address}</span>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-cream-muted flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-muted">
                            {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : ''}
                          </span>

                          <button
                            onClick={() => setSelectedIssue(issue)}
                            className="px-3 py-1.5 bg-slate text-cream hover:bg-accent font-display text-xs font-semibold uppercase tracking-wider transition-colors"
                          >
                            Manage Status
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Management Modal */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          isOpen={!!selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdated={(updatedIssue) => {
            if (updatedIssue) {
              if (updatedIssue.deleted) {
                setIssues((prev) => prev.filter((i) => i.id !== updatedIssue.id));
              } else {
                setIssues((prev) =>
                  prev.map((i) => (i.id === updatedIssue.id ? { ...i, ...updatedIssue } : i))
                );
                setSelectedIssue((prev) => (prev && prev.id === updatedIssue.id ? { ...prev, ...updatedIssue } : prev));
              }
            }
            loadData();
          }}
        />
      )}
    </div>
  );
}
