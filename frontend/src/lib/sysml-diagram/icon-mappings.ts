import type { LucideIcon } from 'lucide-react';
import {
  // Core toolbar actions
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize2,
  // Structural elements
  Box,
  Package,
  CircleDot,
  Boxes,
  List,
  Link,
  Plug,
  GitBranch,
  ExternalLink,
  Calendar,
  Folder,
  Library,
  // Behavioral elements
  Play,
  Zap,
  Send,
  Download,
  Equal,
  HelpCircle,
  Repeat,
  RotateCw,
  Circle,
  Workflow,
  ArrowRight,
  Calculator,
  GitFork,
  GitMerge,
  GitPullRequest,
  // Requirements & Cases
  FileText,
  Shield,
  CheckCircle,
  BarChart,
  Users,
  AlertCircle,
  // Interactions
  User,
  MessageSquare,
  // Metadata
  MessageCircle,
  Tag,
  // Relationships
  TrendingUp,
  Link2,
  GitCommit,
  Activity,
  CheckSquare,
  Edit3,
  CheckCircle2,
  Share2,
  ArrowRightCircle,
  Layers,
  Grid,
  // UI Actions
  Undo,
  Redo,
  Save,
  Trash2,
  Plus,
  Minus,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Settings,
  Info
} from 'lucide-react';

import type { SysMLNodeKind, SysMLEdgeKind } from './types';

/**
 * Icon mappings for SysML node kinds
 */
export const nodeKindIcons: Record<SysMLNodeKind, LucideIcon> = {
  // Structural - Parts
  'part-definition': Box,
  'part-usage': Package,

  // Structural - Attributes
  'attribute-definition': List,
  'attribute-usage': List,

  // Structural - Ports
  'port-definition': CircleDot,
  'port-usage': CircleDot,

  // Structural - Items
  'item-definition': Boxes,
  'item-usage': Boxes,

  // Structural - Connections
  'connection-definition': Link,
  'connection-usage': Link,

  // Structural - Interfaces
  'interface-definition': Plug,
  'interface-usage': Plug,

  // Structural - Allocations
  'allocation-definition': GitBranch,
  'allocation-usage': GitBranch,

  // Structural - References
  'reference-usage': ExternalLink,

  // Structural - Occurrences
  'occurrence-definition': Calendar,
  'occurrence-usage': Calendar,

  // Behavioral - Actions
  'action-definition': Play,
  'action-usage': Play,

  // Behavioral - Activity Control
  'activity-control': GitBranch,

  // Behavioral - Calculations
  'calculation-definition': Calculator,
  'calculation-usage': Calculator,

  // Behavioral - Advanced Actions
  'perform-action': Zap,
  'send-action': Send,
  'accept-action': Download,
  'assignment-action': Equal,
  'if-action': HelpCircle,
  'for-loop-action': Repeat,
  'while-loop-action': RotateCw,

  // Behavioral - States
  'state': Circle,
  'state-machine': Workflow,
  'state-definition': CircleDot,
  'state-usage': CircleDot,
  'transition-usage': ArrowRight,
  'exhibit-state': Circle,

  // Requirements & Constraints
  'requirement-definition': FileText,
  'requirement-usage': FileText,
  'constraint-definition': Shield,
  'constraint-usage': Shield,

  // Verification & Analysis Cases
  'verification-case-definition': CheckCircle,
  'verification-case-usage': CheckCircle,
  'analysis-case-definition': BarChart,
  'analysis-case-usage': BarChart,

  // Use Cases & Concerns
  'use-case-definition': Users,
  'use-case-usage': Users,
  'concern-definition': AlertCircle,
  'concern-usage': AlertCircle,

  // Organizational
  'package': Folder,
  'library-package': Library,

  // Interactions
  'sequence-lifeline': User,
  'interaction': MessageSquare,

  // Metadata
  'metadata-definition': Tag,
  'metadata-usage': Tag,
  'comment': MessageCircle,
  'documentation': FileText
};

/**
 * Icon mappings for SysML edge/relationship kinds
 */
export const edgeKindIcons: Partial<Record<SysMLEdgeKind, LucideIcon>> = {
  // Core relationships
  'specialization': TrendingUp,
  'definition': Link2,
  'dependency': ArrowRight,
  'flow-connection': Workflow,

  // Control & Action flow
  'control-flow': GitCommit,
  'action-flow': Activity,

  // Requirements relationships
  'satisfy': CheckSquare,
  'refine': Edit3,
  'verify': CheckCircle2,
  'allocate': Share2,

  // State machine
  'transition': ArrowRightCircle,
  'message': MessageSquare,

  // Structural relationships
  'composition': Layers,
  'aggregation': Grid,
  'succession': ArrowRight,
  'item-flow': Workflow,
  'binding-connector': Link2
};

/**
 * Icon mappings for toolbar modes and UI actions
 */
export const uiActionIcons = {
  // Toolbar modes
  select: MousePointer2,
  pan: Hand,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
  fitToScreen: Maximize2,

  // Edit actions
  undo: Undo,
  redo: Redo,
  save: Save,
  delete: Trash2,
  add: Plus,
  remove: Minus,
  close: X,

  // UI elements
  search: Search,
  expand: ChevronDown,
  collapse: ChevronRight,
  settings: Settings,
  info: Info
} as const;

/**
 * Get icon for a node kind with fallback
 */
export function getNodeIcon(kind: SysMLNodeKind | string): LucideIcon {
  return nodeKindIcons[kind as SysMLNodeKind] || Box;
}

/**
 * Get icon for an edge kind with fallback
 */
export function getEdgeIcon(kind: SysMLEdgeKind | string): LucideIcon {
  return edgeKindIcons[kind as SysMLEdgeKind] || ArrowRight;
}

/**
 * Get icon for activity control type
 */
export function getActivityControlIcon(controlType?: string): LucideIcon {
  switch (controlType) {
    case 'fork':
      return GitFork;
    case 'join':
      return GitMerge;
    case 'decision':
      return GitBranch;
    case 'merge':
      return GitPullRequest;
    default:
      return GitBranch;
  }
}
