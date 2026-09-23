const statusConfig = {
  submitted: {
    label: 'Submitted',
    color: 'bg-warning/10 text-warning border-warning',
    dot: 'bg-warning',
  },
  pending: {
    label: 'Pending',
    color: 'bg-warning/10 text-warning border-warning',
    dot: 'bg-warning',
  },
  'under-review': {
    label: 'Under Review',
    color: 'bg-blueprint/10 text-blueprint border-blueprint',
    dot: 'bg-blueprint',
  },
  assigned: {
    label: 'Assigned',
    color: 'bg-info/10 text-info border-info',
    dot: 'bg-info',
  },
  'in-progress': {
    label: 'In Progress',
    color: 'bg-info/10 text-info border-info',
    dot: 'bg-info',
  },
  open: {
    label: 'Open',
    color: 'bg-info/10 text-info border-info',
    dot: 'bg-info',
  },
  verified: {
    label: 'Verified',
    color: 'bg-success/10 text-success border-success',
    dot: 'bg-success',
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-success/10 text-success border-success',
    dot: 'bg-success',
  },
  flagged: {
    label: 'Flagged',
    color: 'bg-warning/10 text-warning border-warning',
    dot: 'bg-warning',
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-danger/10 text-danger border-danger',
    dot: 'bg-danger',
  },
}

export default function StatusBadge({ status, size = 'md', showDot = true }) {
  const raw = String(status || '').trim()
  const normalizedKey = raw.toLowerCase().replace(/[\s_]+/g, '-')

  let config = statusConfig[normalizedKey] || statusConfig[raw.toLowerCase()]

  if (!config) {
    if (normalizedKey.includes('resolve')) config = statusConfig.resolved
    else if (normalizedKey.includes('reject')) config = statusConfig.rejected
    else if (normalizedKey.includes('progress')) config = statusConfig['in-progress']
    else if (normalizedKey.includes('review')) config = statusConfig['under-review']
    else if (normalizedKey.includes('assign')) config = statusConfig.assigned
    else if (normalizedKey.includes('submit')) config = statusConfig.submitted
    else if (normalizedKey.includes('pend')) config = statusConfig.pending
    else {
      config = {
        label: raw || 'Submitted',
        color: 'bg-slate-muted/10 text-slate-muted border-slate-muted',
        dot: 'bg-slate-muted',
      }
    }
  }

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 border-2 font-display font-semibold uppercase tracking-wide
        ${config.color} ${sizes[size]}
      `}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} pulse-dot`} />
      )}
      {config.label}
    </span>
  )
}
