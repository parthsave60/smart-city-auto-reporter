const issueTypes = [
  { id: 'pothole', label: 'Potholes and RoadCracks', icon: '🕳️', color: 'accent' },
  { id: 'damaged-concrete', label: 'Damaged Concrete', icon: '🧱', color: 'warning' },
  { id: 'electrical-pole', label: 'Damaged Electrical Pole', icon: '⚡', color: 'danger' },
  { id: 'damaged-road-sign', label: 'Damaged Road Sign', icon: '🛑', color: 'danger' },
  { id: 'dead-animal-pollution', label: 'Dead Animal / Pollution', icon: '⚠️', color: 'warning' },
  { id: 'fallen-tree', label: 'Fallen Tree', icon: '🌳', color: 'success' },
  { id: 'garbage', label: 'Garbage / Litter', icon: '🗑️', color: 'success' },
  { id: 'graffiti', label: 'Graffiti', icon: '🎨', color: 'info' },
  { id: 'illegal-parking', label: 'Illegal Parking', icon: '🚫', color: 'accent' },
  { id: 'waterlogging', label: 'Waterlogging & Flooding', icon: '🌊', color: 'info' },
  { id: 'other', label: 'Other Civic Issue', icon: '📍', color: 'muted' },
]

const MODEL_CLASS_MAP = {
  'potholes and roadcracks': 'pothole',
  'potholes & road cracks': 'pothole',
  'pothole / road crack': 'pothole',
  'pothole': 'pothole',
  'potholes': 'pothole',
  'roadcrack': 'pothole',
  'roadcracks': 'pothole',
  'garbage': 'garbage',
  'garbage / litter': 'garbage',
  'garbage & waste': 'garbage',
  'damaged concrete structures': 'damaged-concrete',
  'damaged concrete': 'damaged-concrete',
  'damaged-concrete': 'damaged-concrete',
  'damagedelectricalpoles': 'electrical-pole',
  'damaged electrical poles': 'electrical-pole',
  'damaged electrical pole': 'electrical-pole',
  'electrical-pole': 'electrical-pole',
  'damagedroadsigns': 'damaged-road-sign',
  'damaged road signs': 'damaged-road-sign',
  'damaged road sign': 'damaged-road-sign',
  'damaged-road-sign': 'damaged-road-sign',
  'deadanimalspollution': 'dead-animal-pollution',
  'dead animals / hazard': 'dead-animal-pollution',
  'dead animal / pollution': 'dead-animal-pollution',
  'dead-animal-pollution': 'dead-animal-pollution',
  'fallentrees': 'fallen-tree',
  'fallen trees': 'fallen-tree',
  'fallen tree': 'fallen-tree',
  'fallen-tree': 'fallen-tree',
  'graffitti': 'graffiti',
  'graffiti': 'graffiti',
  'illegalparking': 'illegal-parking',
  'illegal parking': 'illegal-parking',
  'illegal-parking': 'illegal-parking',
  'waterlogging': 'waterlogging',
  'waterlogging & flooding': 'waterlogging',
}

function resolveIssueType(rawType) {
  if (!rawType) return null
  const norm = String(rawType).toLowerCase().trim()

  const mappedId = MODEL_CLASS_MAP[norm]
  if (mappedId) {
    const found = issueTypes.find((t) => t.id === mappedId)
    if (found) return found
  }

  const direct = issueTypes.find(
    (t) => t.id.toLowerCase() === norm || t.label.toLowerCase() === norm
  )
  if (direct) return direct

  if (norm.includes('pothole') || norm.includes('roadcrack') || norm.includes('road crack')) {
    return issueTypes.find((t) => t.id === 'pothole')
  }
  if (norm.includes('garbage') || norm.includes('litter') || norm.includes('trash') || norm.includes('waste')) {
    return issueTypes.find((t) => t.id === 'garbage')
  }
  if (norm.includes('waterlog') || norm.includes('flood')) {
    return issueTypes.find((t) => t.id === 'waterlogging')
  }
  if (norm.includes('pole') || norm.includes('electrical')) {
    return issueTypes.find((t) => t.id === 'electrical-pole')
  }
  if (norm.includes('concrete')) {
    return issueTypes.find((t) => t.id === 'damaged-concrete')
  }
  if (norm.includes('tree')) {
    return issueTypes.find((t) => t.id === 'fallen-tree')
  }
  if (norm.includes('sign')) {
    return issueTypes.find((t) => t.id === 'damaged-road-sign')
  }
  if (norm.includes('graffiti') || norm.includes('graffitti')) {
    return issueTypes.find((t) => t.id === 'graffiti')
  }
  if (norm.includes('parking')) {
    return issueTypes.find((t) => t.id === 'illegal-parking')
  }
  if (norm.includes('animal') || norm.includes('pollution')) {
    return issueTypes.find((t) => t.id === 'dead-animal-pollution')
  }

  return null
}

export default function IssueTypeTag({ type, size = 'md' }) {
  const rawType = typeof type === 'object' && type !== null 
    ? (type.id || type.label || '') 
    : (type || '')

  const matched = resolveIssueType(rawType)

  const defaultFallback = issueTypes[issueTypes.length - 1]
  const isGenericOrEmpty = !rawType || ['other', 'unspecified', 'none'].includes(String(rawType).toLowerCase().trim())

  const issueType = matched || (
    !isGenericOrEmpty
      ? {
          id: 'custom',
          label: String(rawType),
          icon: '📍',
          color: 'muted',
        }
      : defaultFallback
  )

  const colorClasses = {
    accent: 'bg-accent/10 text-accent border-accent',
    warning: 'bg-warning/10 text-warning border-warning',
    info: 'bg-info/10 text-info border-info',
    success: 'bg-success/10 text-success border-success',
    danger: 'bg-danger/10 text-danger border-danger',
    muted: 'bg-slate-muted/10 text-slate-muted border-slate-muted',
  }

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }

  const colorClass = colorClasses[issueType?.color] || colorClasses.muted
  const sizeClass = sizes[size] || sizes.md
  const icon = issueType?.icon || '📍'
  const label = issueType?.label || (typeof rawType === 'string' && rawType ? rawType : 'Civic Issue')

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 border font-display font-medium uppercase tracking-wide
        ${colorClass} ${sizeClass}
      `}
    >
      <span>{icon}</span>
      {label}
    </span>
  )
}

export { issueTypes }
