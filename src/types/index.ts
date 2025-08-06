// Core DECLARE constraint types
export interface DeclareConstraint {
  id: string;
  type: string;
  activities: string[];
  description: string;
  helpText: string;
}

// Constraint statistics from analysis_overview.csv
export interface ConstraintStatistics {
  constraintId: string;
  activations: number;
  fulfilments: number;
  violations: number;
  violationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Trace statistics from replay_overview.csv
export interface TraceStatistics {
  caseId: string;
  fitness: number;
  insertions: number;
  deletions: number;
}

// Combined trace data with analysis and replay statistics
export interface TraceData {
  caseId: string;
  fitness: number;
  insertions: number;
  deletions: number;
  activations: number;
  fulfilments: number;
  violations: number;
  violatedConstraints: string[];
  fulfilledConstraints: string[];
  events: ProcessEvent[];
  alignedEvents: AlignedEvent[];
}

// Process events from XES files
export interface ProcessEvent {
  id: string;
  activity: string;
  timestamp: string;
  resource?: string;
}

export interface ProcessCase {
  caseId: string;
  events: ProcessEvent[];
}

// Aligned events from aligned XES files
export interface AlignedEvent {
  originalActivity?: string;
  alignedActivity?: string;
  type: string;
  timestamp: string;
}

export interface AlignedCase {
  caseId: string;
  events: AlignedEvent[];
}

// Dashboard constraint with statistics and tagging
export interface DashboardConstraint {
  id: string;
  type: string;
  activities: string[];
  description: string;
  helpText: string;
  statistics: ConstraintStatistics;
  violationCount: number;
  fulfilmentCount: number;
  violationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isTimeConstraint?: boolean;
  tag: {
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    quality: boolean;
    efficiency: boolean;
    compliance: boolean;
    group?: string; // New field for grouping
  };
}

// Trace-level constraint analysis detail
export interface TraceConstraintDetail {
  constraintId: string;
  resultTypes: string[]; // 'fulfillment', 'violation', 'vac. fulfillment', 'vac. violation'
  totalActivations: number;
  totalFulfilments: number;
  totalViolations: number;
}

// Dashboard trace with comprehensive statistics
export interface DashboardTrace {
  caseId: string;
  fitness: number;
  insertions: number;
  deletions: number;
  activations: number;
  fulfilments: number;
  violations: number;
  violatedConstraints: string[];
  fulfilledConstraints: string[];
  events: ProcessEvent[];
  alignedEvents: AlignedEvent[];
  constraintDetails: TraceConstraintDetail[]; // New field for detailed constraint analysis
}

// Dashboard overview KPIs
export interface DashboardOverview {
  totalTraces: number;
  totalVariants: number;
  totalConstraints: number;
  overallFitness: number;
  overallConformance: number;
  overallCompliance: number;
  overallQuality: number;
  overallEfficiency: number;
  criticalViolations: number;
  highPriorityViolations: number;
  averageInsertions: number;
  averageDeletions: number;
}

// Model visualization components
export interface ActivityNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: number; // height
  width: number; // width for rectangular nodes
  color: string;
}

export interface ConstraintEdge {
  id: string;
  source: string;
  target: string;
  constraint: DashboardConstraint;
  violationCount: number;
  color: string;
  thickness: number;
  isSelfLoop?: boolean;
}

export interface ModelVisualization {
  activities: ActivityNode[];
  constraints: ConstraintEdge[];
}

// Constraint grouping
export interface ConstraintGroup {
  id: string;
  name: string;
  constraints: DashboardConstraint[];
  totalViolations: number;
  totalFulfilments: number;
  averageViolationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// File upload types
export interface UploadedFiles {
  declarativeModel?: File;
  analysisOverview?: File;
  analysisDetail?: File;
  replayOverview?: File;
  replayDetail?: File;
  eventLog?: File;
  alignedLog?: File;
}

// Filter and sort types
export interface TraceFilter {
  minFitness?: number;
  maxFitness?: number;
  hasViolations?: boolean;
  hasFulfilments?: boolean;
  hasInsertions?: boolean;
  hasDeletions?: boolean;
  constraintTypes?: string[];
  sequence?: string;
  traceId?: string;
  caseIds?: string; // Comma-separated case IDs for multiple filtering
}

export interface TraceSort {
  field: 'caseId' | 'fitness' | 'violations' | 'insertions' | 'deletions';
  direction: 'asc' | 'desc';
}

// Legacy types for backward compatibility
export interface TraceRecord {
  caseId: string;
  fitness: number;
  violations: string[];
  fulfilments: string[];
  totalEvents: number;
  duration?: number;
  resources?: string[];
  qualityScore: number;
  efficiencyScore: number;
  complianceScore: number;
  conformanceScore: number;
  weightedConformanceScore: number;
}

export interface TraceAnalysis {
  caseId: string;
  events: TraceEvent[];
  constraintViolations: ConstraintViolation[];
  constraintFulfilments: ConstraintFulfilment[];
  fitness: number;
  duration: number;
  resourceUtilization: ResourceUtilization[];
  performanceMetrics: PerformanceMetrics;
}

export interface TraceEvent {
  id: string;
  activity: string;
  timestamp: string;
  resource?: string;
  attributes?: Record<string, any>;
  position: number;
}

export interface ConstraintViolation {
  constraintId: string;
  constraintType: string;
  activities: string[];
  violationType: 'ACTIVATION' | 'FULFILMENT';
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
}

export interface ConstraintFulfilment {
  constraintId: string;
  constraintType: string;
  activities: string[];
  fulfilmentType: 'NORMAL';
  timestamp: string;
  description: string;
}

export interface ResourceUtilization {
  resource: string;
  utilization: number;
  efficiency: number;
  bottlenecks: string[];
}

export interface PerformanceMetrics {
  throughput: number;
  cycleTime: number;
  waitTime: number;
  processingTime: number;
}

export interface ConstraintVisualization {
  id: string;
  type: string;
  activities: string[];
  violationFrequency: number;
  fulfilmentFrequency: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  color: string;
  position: { x: number; y: number };
  connections: string[];
}

export interface ReportData {
  summary: ReportSummary;
  traceAnalysis: TraceAnalysis[];
  constraintAnalysis: ConstraintAnalysis[];
  recommendations: Recommendation[];
}

export interface ReportSummary {
  totalCases: number;
  totalEvents: number;
  averageFitness: number;
  constraintViolations: number;
  constraintFulfilments: number;
  criticalIssues: number;
  performanceScore: number;
}

export interface ConstraintAnalysis {
  constraintId: string;
  type: string;
  activities: string[];
  totalViolations: number;
  totalFulfilments: number;
  violationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact: number;
  recommendations: string[];
}

export interface Recommendation {
  id: string;
  type: 'CONSTRAINT' | 'PROCESS' | 'RESOURCE' | 'PERFORMANCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  impact: number;
  effort: number;
  priority: number;
}

export interface GroupingOptions {
  byConstraint: boolean;
  byResource: boolean;
  byActivity: boolean;
  bySeverity: boolean;
  byTimePeriod: boolean;
}

export interface AnalysisDashboard {
  overview: DashboardOverview;
  constraintAnalysis: ConstraintAnalysisView;
  traceAnalysis: TraceAnalysisView;
  visualizations: DashboardVisualizations;
}

export interface ConstraintAnalysisView {
  constraints: DeclareConstraint[];
  violationSummary: ViolationSummary;
  constraintTypes: ConstraintTypeSummary[];
  recommendations: Recommendation[];
}

export interface TraceAnalysisView {
  traces: TraceRecord[];
  traceDetails: TraceDetail[];
  performanceMetrics: PerformanceMetrics;
  resourceUtilization: ResourceUtilization[];
}

export interface DashboardVisualizations {
  constraintNetwork: ConstraintNetworkNode[];
  traceTimeline: TraceTimelineEvent[];
  violationHeatmap: ViolationHeatmapCell[];
  performanceCharts: PerformanceChart[];
}

export interface ConstraintNetworkNode {
  id: string;
  type: string;
  activities: string[];
  position: { x: number; y: number };
  size: number;
  color: string;
  connections: string[];
  violationRate: number;
}

export interface TraceTimelineEvent {
  traceId: string;
  events: TimelineEvent[];
  violations: TimelineViolation[];
  fitness: number;
  duration: number;
}

export interface TimelineEvent {
  id: string;
  activity: string;
  timestamp: string;
  position: number;
  resource?: string;
}

export interface TimelineViolation {
  constraintId: string;
  constraintType: string;
  timestamp: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  position: number;
}

export interface ViolationHeatmapCell {
  constraintId: string;
  traceId: string;
  violationCount: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  x: number;
  y: number;
}

export interface PerformanceChart {
  type: 'fitness' | 'violations' | 'throughput' | 'cycleTime';
  data: PerformanceDataPoint[];
  title: string;
  description: string;
}

export interface PerformanceDataPoint {
  label: string;
  value: number;
  category: string;
  color: string;
}

export interface ViolationSummary {
  totalViolations: number;
  violationsBySeverity: Record<string, number>;
  violationsByConstraint: Record<string, number>;
  violationsByTrace: Record<string, number>;
  averageViolationRate: number;
}

export interface ConstraintTypeSummary {
  type: string;
  count: number;
  totalViolations: number;
  averageViolationRate: number;
  examples: string[];
}

export interface TraceDetail {
  caseId: string;
  events: ProcessEvent[];
  violations: ConstraintViolation[];
  fulfilments: ConstraintFulfilment[];
  fitness: number;
  duration: number;
  resources: string[];
  performance: PerformanceMetrics;
} 