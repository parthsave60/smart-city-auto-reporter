import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Clock4, 
  ArrowRight, 
  Plus, 
  Filter, 
  Search,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchUserReports } from '../services/dataService';
import IssueTypeTag from '../components/ui/IssueTypeTag';

const STATUS_CONFIG = {
  'Submitted': {
    color: 'bg-blueprint/15 text-blueprint border-blueprint/30',
    icon: Clock4,
    step: 1
  },
  'Under Review': {
    color: 'bg-warning/15 text-warning border-warning/30',
    icon: Clock,
    step: 2
  },
  'Assigned': {
    color: 'bg-accent/15 text-accent border-accent/30',
    icon: ShieldCheck,
    step: 3
  },
  'In Progress': {
    color: 'bg-accent/20 text-accent border-accent/40',
    icon: AlertCircle,
    step: 4
  },
  'Resolved': {
    color: 'bg-success/15 text-success border-success/30',
    icon: CheckCircle2,
    step: 5
  },
  'Rejected': {
    color: 'bg-danger/15 text-danger border-danger/30',
    icon: AlertCircle,
    step: 0
  }
};

const WORKFLOW_STEPS = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];

export default function CitizenReports() {
  const { user, userProfile } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTimeline, setExpandedTimeline] = useState({});

  useEffect(() => {
    if (!user) return;
    loadReports();
  }, [user]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchUserReports(user.uid);
      setReports(data);
    } catch (err) {
      console.error('Error fetching citizen reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTimeline = (id) => {
    setExpandedTimeline(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter(item => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesSearch = !searchQuery || 
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.location?.address || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [reports, statusFilter, searchQuery]);

  // Summary counts
  const stats = useMemo(() => {
    const total = reports.length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    const inProgress = reports.filter(r => ['Under Review', 'Assigned', 'In Progress'].includes(r.status)).length;
    const submitted = reports.filter(r => r.status === 'Submitted').length;
    return { total, resolved, inProgress, submitted };
  }, [reports]);

  return (
    <div className="min-h-screen bg-cream pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 pb-6 border-b border-cream-muted">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-display text-xs uppercase tracking-[0.25em] text-accent font-semibold">
                Citizen Portal
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate tracking-tight">
              My Submitted Reports
            </h1>
            <p className="font-body text-slate-muted text-sm mt-1">
              Track the real-time municipal inspection and resolution status of your civic complaints.
            </p>
          </div>

          <Link
            to="/report"
            className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-cream font-display text-sm font-semibold uppercase tracking-wider hover:bg-accent-hover transition-colors shadow-md shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Issue</span>
          </Link>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 bg-cream/90 border border-cream-muted shadow-sm">
            <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">Total Reports</span>
            <span className="font-display text-3xl font-bold text-slate">{stats.total}</span>
          </div>
          <div className="p-5 bg-cream/90 border border-cream-muted shadow-sm">
            <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">Submitted</span>
            <span className="font-display text-3xl font-bold text-blueprint">{stats.submitted}</span>
          </div>
          <div className="p-5 bg-cream/90 border border-cream-muted shadow-sm">
            <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">In Progress</span>
            <span className="font-display text-3xl font-bold text-warning">{stats.inProgress}</span>
          </div>
          <div className="p-5 bg-cream/90 border border-cream-muted shadow-sm">
            <span className="block font-body text-xs text-slate-muted uppercase tracking-wider mb-1">Resolved</span>
            <span className="font-display text-3xl font-bold text-success">{stats.resolved}</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-muted absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your reports by description, category, or address..."
              className="w-full pl-10 pr-4 py-2.5 bg-cream border border-cream-muted focus:border-blueprint outline-none font-body text-slate text-sm placeholder:text-slate-muted/50"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'Submitted', 'In Progress', 'Resolved'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-2 font-display text-xs font-semibold uppercase tracking-wider border whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-slate text-cream border-slate'
                    : 'bg-cream text-slate-muted border-cream-muted hover:border-slate/30'
                }`}
              >
                {st === 'all' ? 'All Statuses' : st}
              </button>
            ))}
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 border-2 border-slate border-t-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="font-display text-sm uppercase tracking-wider text-slate-muted">Loading your reports...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center bg-cream/60 border border-dashed border-cream-muted">
            <FileText className="w-12 h-12 text-slate-muted/40 mx-auto mb-3" />
            <h3 className="font-display text-lg font-semibold text-slate mb-1">
              {reports.length === 0 ? 'No reports submitted yet' : 'No matching reports found'}
            </h3>
            <p className="font-body text-slate-muted text-sm max-w-sm mx-auto mb-6">
              {reports.length === 0 
                ? 'Help improve your city by reporting potholes, garbage, or road hazards in your area.'
                : 'Try adjusting your search query or status filter.'}
            </p>
            {reports.length === 0 && (
              <Link
                to="/report"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-cream font-display text-xs font-semibold uppercase tracking-wider hover:bg-accent-hover transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Submit Your First Report</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReports.map((report) => {
              const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG['Submitted'];
              const StatusIcon = statusCfg.icon;
              const isExpanded = !!expandedTimeline[report.id];
              const dateStr = report.createdAt 
                ? new Date(report.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Recent';

              return (
                <div 
                  key={report.id}
                  className="bg-cream border border-cream-muted shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      
                      {/* Image Thumbnail */}
                      <div className="w-full lg:w-56 h-48 lg:h-44 bg-cream-dark shrink-0 relative overflow-hidden border border-cream-muted">
                        {report.imageUrl ? (
                          <img
                            src={report.imageUrl}
                            alt={report.category || 'Civic Issue'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-muted">
                            <FileText className="w-8 h-8 opacity-30" />
                          </div>
                        )}
                        {report.predictedClass && (
                          <div className="absolute bottom-2 left-2 right-2 bg-slate/90 backdrop-blur-sm text-cream px-2 py-1 text-[10px] font-display uppercase tracking-wider truncate">
                            AI: {report.predictedClass}
                          </div>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <IssueTypeTag type={report.category || report.manualLabel || 'other'} />
                            <span className="text-xs text-slate-muted font-body flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {dateStr}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div className={`flex items-center gap-1.5 px-3 py-1 border text-xs font-display font-semibold uppercase tracking-wider ${statusCfg.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{report.status || 'Submitted'}</span>
                          </div>
                        </div>

                        {/* Description */}
                        <h4 className="font-display text-base font-semibold text-slate mb-1">
                          {report.category || 'Civic Issue'}
                        </h4>
                        <p className="font-body text-slate-muted text-sm mb-4 line-clamp-3 leading-relaxed">
                          {report.description}
                        </p>

                        {/* Location */}
                        {report.location?.address && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-muted font-body mb-4">
                            <MapPin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{report.location.address}</span>
                          </div>
                        )}

                        {/* Workflow Stepper Bar */}
                        <div className="pt-3 border-t border-cream-muted">
                          <div className="grid grid-cols-4 gap-1 text-center mb-1">
                            {WORKFLOW_STEPS.map((step, idx) => {
                              const stepIdx = idx + 1;
                              const currentStepIdx = statusCfg.step || 1;
                              const isCompleted = currentStepIdx >= stepIdx;
                              const isCurrent = currentStepIdx === stepIdx;

                              return (
                                <div key={step} className="flex flex-col items-center">
                                  <div 
                                    className={`w-full h-1.5 mb-1.5 transition-colors ${
                                      isCompleted 
                                        ? 'bg-accent' 
                                        : 'bg-cream-dark'
                                    }`} 
                                  />
                                  <span className={`text-[10px] font-display uppercase tracking-wider ${
                                    isCurrent ? 'font-bold text-accent' : isCompleted ? 'text-slate font-medium' : 'text-slate-muted/50'
                                  }`}>
                                    {step}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline toggle */}
                    {report.statusHistory && report.statusHistory.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-cream-muted flex justify-between items-center">
                        <button
                          onClick={() => toggleTimeline(report.id)}
                          className="flex items-center gap-1 text-xs font-display font-semibold uppercase tracking-wider text-slate-muted hover:text-slate transition-colors"
                        >
                          <span>Status History ({report.statusHistory.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <span className="text-[11px] font-body text-slate-muted">
                          Report ID: <span className="font-mono">{report.id.slice(0, 12)}...</span>
                        </span>
                      </div>
                    )}

                    {/* Expanded status history timeline */}
                    <AnimatePresence>
                      {isExpanded && report.statusHistory && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 pt-3 border-t border-cream-muted space-y-2 overflow-hidden"
                        >
                          {report.statusHistory.map((hist, hIdx) => (
                            <div key={hIdx} className="flex items-start gap-3 text-xs font-body pl-2">
                              <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />
                              <div className="flex-1">
                                <span className="font-display font-semibold text-slate uppercase tracking-wider">
                                  {hist.status}
                                </span>
                                {hist.notes && (
                                  <p className="text-slate-muted mt-0.5">{hist.notes}</p>
                                )}
                              </div>
                              <span className="text-slate-muted/70 text-[11px] shrink-0">
                                {hist.timestamp ? new Date(hist.timestamp).toLocaleString() : ''}
                              </span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
