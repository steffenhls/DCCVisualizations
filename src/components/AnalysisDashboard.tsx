import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DashboardOverview, 
  DashboardConstraint, 
  DashboardTrace, 
  ModelVisualization,
  TraceFilter,
  TraceSort
} from '../types';
import { DataProcessor } from '../utils/dataProcessor';
import CytoscapeModel from './CytoscapeModel';
import ResourceView from './ResourceView';
import TimeView from './TimeView';
import ProcessModelView from './ProcessModelView';
import ConstraintInterdependencyView from './ConstraintInterdependencyView';
import './AnalysisDashboard.css';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Label, ResponsiveContainer } from 'recharts';

interface AnalysisDashboardProps {
  uploadedFiles: any;
  taggedConstraints: DashboardConstraint[];
  onBack: () => void;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
  uploadedFiles,
  taggedConstraints,
  onBack
}) => {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [traces, setTraces] = useState<DashboardTrace[]>([]);
  const [modelVisualization, setModelVisualization] = useState<ModelVisualization | null>(null);
  const [processedConstraints, setProcessedConstraints] = useState<DashboardConstraint[]>([]);
  const [coViolationMatrix, setCoViolationMatrix] = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'constraints' | 'traces' | 'variants' | 'resource' | 'time' | 'model'>('overview');
  const [selectedTrace, setSelectedTrace] = useState<DashboardTrace | null>(null);
  const [traceFilter, setTraceFilter] = useState<TraceFilter>({});
  const [traceSort, setTraceSort] = useState<TraceSort>({ field: 'caseId', direction: 'asc' });
  const [showTraceDetail, setShowTraceDetail] = useState(false);
  const [initialConstraintFilter, setInitialConstraintFilter] = useState<string | null>(null);
  const [alignmentTab, setAlignmentTab] = useState<'table' | 'graph'>('table');

  // Process uploaded files
  useEffect(() => {
    const processFiles = async () => {
      try {
        setLoading(true);
        setError(null);

        // Read and parse files
        let modelText = '';
        let analysisOverviewText = '';
        let analysisDetailText = '';
        let replayOverviewText = '';
        let eventLogText = '';
        let alignedLogText = '';

        // Read DECLARE model
        if (uploadedFiles.declarativeModel) {
          modelText = await readFileAsText(uploadedFiles.declarativeModel);
        }

        // Read analysis overview
        if (uploadedFiles.analysisOverview) {
          analysisOverviewText = await readFileAsText(uploadedFiles.analysisOverview);
        }

        // Read analysis detail
        if (uploadedFiles.analysisDetail) {
          analysisDetailText = await readFileAsText(uploadedFiles.analysisDetail);
        }

        // Read replay overview
        if (uploadedFiles.replayOverview) {
          replayOverviewText = await readFileAsText(uploadedFiles.replayOverview);
        }

        // Read event log
        if (uploadedFiles.eventLog) {
          eventLogText = await readFileAsText(uploadedFiles.eventLog);
        }

        // Read aligned log
        if (uploadedFiles.alignedLog) {
          alignedLogText = await readFileAsText(uploadedFiles.alignedLog);
        }

        if (!modelText) {
          throw new Error('DECLARE model file is required');
        }

        // Parse data
        const constraints = DataProcessor.parseDeclareModel(modelText);
        const analysisOverview = analysisOverviewText ? DataProcessor.parseAnalysisOverview(analysisOverviewText) : [];
        const analysisDetail = analysisDetailText ? DataProcessor.parseAnalysisDetail(analysisDetailText) : new Map();
        const replayOverview = replayOverviewText ? DataProcessor.parseReplayOverview(replayOverviewText) : [];
        const eventLog = eventLogText ? DataProcessor.parseEventLog(eventLogText) : [];
        const alignedLog = alignedLogText ? DataProcessor.parseAlignedLog(alignedLogText) : [];

        // Process all data together
        const processed = DataProcessor.processData(
          constraints,
          analysisOverview,
          replayOverview,
          analysisDetail,
          eventLog,
          alignedLog,
          taggedConstraints
        );
        
        setOverview(processed.overview);
        setTraces(processed.dashboardTraces);
        setModelVisualization(processed.modelVisualization);
        setProcessedConstraints(processed.dashboardConstraints);
        setCoViolationMatrix(processed.coViolationMatrix);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process files');
      } finally {
        setLoading(false);
      }
    };

    if (uploadedFiles) {
      processFiles();
    }
  }, [uploadedFiles, taggedConstraints]);

  // Reset trace filtering when leaving traces view
  useEffect(() => {
    if (activeView !== 'traces') {
      setTraceFilter({});
      setTraceSort({ field: 'caseId', direction: 'asc' });
    }
  }, [activeView]);

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeView]);

  // Helper function to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  // Filter and sort traces
  const filteredAndSortedTraces = useCallback(() => {
    let filtered = traces.filter(trace => {
      if (traceFilter.minFitness !== undefined && trace.fitness < traceFilter.minFitness) return false;
      if (traceFilter.maxFitness !== undefined && trace.fitness > traceFilter.maxFitness) return false;
      if (traceFilter.hasViolations && trace.violations === 0) return false;
      if (traceFilter.hasFulfilments && trace.fulfilments === 0) return false;
      if (traceFilter.hasInsertions && trace.insertions === 0) return false;
      if (traceFilter.hasDeletions && trace.deletions === 0) return false;
      if (traceFilter.sequence) {
        // Filter by activity sequence
        const traceSequence = trace.events.map(e => e.activity).join(' → ');
        if (traceSequence !== traceFilter.sequence) {
          return false;
        }
      }
      if (traceFilter.constraintTypes && traceFilter.constraintTypes.length > 0) {
        // Check if constraintTypes contains constraint IDs (for direct constraint filtering)
        const constraintIds = traceFilter.constraintTypes.filter(id => 
          processedConstraints.some(c => c.id === id)
        );
        
        if (constraintIds.length > 0) {
          // Filter by specific constraint IDs
          const traceViolatedConstraints = trace.violatedConstraints;
          if (!constraintIds.some(id => traceViolatedConstraints.includes(id))) {
            return false;
          }
        } else {
          // Filter by constraint types (existing logic)
        const traceConstraintTypes = [...trace.violatedConstraints, ...trace.fulfilledConstraints]
            .map(id => processedConstraints.find(c => c.id === id)?.type)
          .filter(Boolean);
          if (!traceFilter.constraintTypes.some(type => traceConstraintTypes.includes(type))) {
            return false;
          }
        }
      }
      return true;
    });

    // Sort traces
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (traceSort.field) {
        case 'fitness':
          aValue = a.fitness;
          bValue = b.fitness;
          break;
        case 'violations':
          aValue = a.violations;
          bValue = b.violations;
          break;
        case 'insertions':
          aValue = a.insertions;
          bValue = b.insertions;
          break;
        case 'deletions':
          aValue = a.deletions;
          bValue = b.deletions;
          break;
        default:
          aValue = a.caseId;
          bValue = b.caseId;
      }

      if (traceSort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [traces, traceFilter, traceSort, processedConstraints]);

  const handleTraceClick = useCallback((trace: DashboardTrace) => {
    setSelectedTrace(trace);
    setShowTraceDetail(true);
  }, []);

  const handleCloseTraceDetail = useCallback(() => {
    setShowTraceDetail(false);
    setSelectedTrace(null);
  }, []);

  const handleConstraintClick = useCallback((constraintId: string) => {
    // Filter traces that violate this constraint
    setTraceFilter({
      ...traceFilter,
      constraintTypes: [constraintId]
    });
    // Navigate to traces view
    setActiveView('traces');
  }, [traceFilter]);

  const handleNavigateToTraces = useCallback(() => {
    // Navigate to traces view
    setActiveView('traces');
  }, []);

  const handleNavigateToConstraints = useCallback(() => {
    // Navigate to constraints view
    setActiveView('constraints');
  }, []);

  const handleNavigateToTracesWithFitnessSort = useCallback(() => {
    // Set trace sort to fitness low to high
    setTraceSort({ field: 'fitness', direction: 'asc' });
    // Navigate to traces view
    setActiveView('traces');
  }, []);

  const handleNavigateToConstraintsWithCompliance = useCallback(() => {
    // Navigate to constraints view with compliance filter
    setInitialConstraintFilter('compliance');
    setActiveView('constraints');
  }, []);

  const handleNavigateToConstraintsWithQuality = useCallback(() => {
    // Navigate to constraints view with quality filter
    setInitialConstraintFilter('quality');
    setActiveView('constraints');
  }, []);

  const handleNavigateToConstraintsWithEfficiency = useCallback(() => {
    // Navigate to constraints view with efficiency filter
    setInitialConstraintFilter('efficiency');
    setActiveView('constraints');
  }, []);

  const handleNavigateToConstraintsWithCriticalPriority = useCallback(() => {
    // Navigate to constraints view with critical priority filter
    setInitialConstraintFilter('critical');
    setActiveView('constraints');
  }, []);

  const handleNavigateToConstraintsWithHighPriority = useCallback(() => {
    // Navigate to constraints view with high priority filter
    setInitialConstraintFilter('high');
    setActiveView('constraints');
  }, []);

  const handleNavigateToTracesWithVisibleConstraints = useCallback((visibleConstraintIds: string[]) => {
    // Navigate to traces view with constraint filtering based on visible constraints
    setTraceFilter({
      ...traceFilter,
      constraintTypes: visibleConstraintIds
    });
    setActiveView('traces');
  }, [traceFilter]);

  const handleNavigateToTracesWithSequenceFilter = useCallback((sequence: string) => {
    // Navigate to traces view with sequence filtering
    setTraceFilter({
      ...traceFilter,
      sequence: sequence
    });
    setActiveView('traces');
  }, [traceFilter]);

  const handleNavigateToVariants = useCallback(() => {  
    // Navigate to variants view
    setActiveView('variants');
  }, []);

  if (loading) {
    return (
      <div className="analysis-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Processing analysis data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis-dashboard">
        <div className="error-container">
          <h2>Error Processing Files</h2>
          <p>{error}</p>
          <button onClick={onBack} className="back-button">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <button onClick={onBack} className="back-button">
          ← Back to Tagging
        </button>
      </div>

      {/* Content with Integrated Tabs */}
      <div className="dashboard-content">
        {/* Tab Navigation */}
        <div className="view-tabs">
          <button
            className={`tab ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            Overview
          </button>
          <button
            className={`tab ${activeView === 'model' ? 'active' : ''}`}
            onClick={() => setActiveView('model')}
          >
            Model
          </button>
          <button
            className={`tab ${activeView === 'constraints' ? 'active' : ''}`}
            onClick={() => setActiveView('constraints')}
          >
            Constraints
          </button>
          <button
            className={`tab ${activeView === 'traces' ? 'active' : ''}`}
            onClick={() => setActiveView('traces')}
          >
            Traces
          </button>
          <button
            className={`tab ${activeView === 'variants' ? 'active' : ''}`}
            onClick={() => setActiveView('variants')}
          >
            Variants
          </button>
          <button
            className={`tab ${activeView === 'resource' ? 'active' : ''}`}
            onClick={() => setActiveView('resource')}
          >
            Resource
          </button>
          <button
            className={`tab ${activeView === 'time' ? 'active' : ''}`}
            onClick={() => setActiveView('time')}
          >
            Time
          </button>
      </div>

        {/* View Content */}
        <div className="view-content">
        {activeView === 'overview' && overview && (
            <OverviewView 
              overview={overview} 
              modelVisualization={modelVisualization} 
              traces={traces}
              onConstraintClick={handleConstraintClick}
              onNavigateToTraces={handleNavigateToTraces}
              onNavigateToConstraints={handleNavigateToConstraints}
              onNavigateToTracesWithFitnessSort={handleNavigateToTracesWithFitnessSort}
              onNavigateToConstraintsWithCompliance={handleNavigateToConstraintsWithCompliance}
              onNavigateToConstraintsWithQuality={handleNavigateToConstraintsWithQuality}
              onNavigateToConstraintsWithEfficiency={handleNavigateToConstraintsWithEfficiency}
              onNavigateToConstraintsWithCriticalPriority={handleNavigateToConstraintsWithCriticalPriority}
              onNavigateToConstraintsWithHighPriority={handleNavigateToConstraintsWithHighPriority}
              onNavigateToVariants={handleNavigateToVariants}
            />
        )}

        {activeView === 'constraints' && (
          <ConstraintsView 
              constraints={processedConstraints} 
            modelVisualization={modelVisualization}
              onConstraintClick={handleConstraintClick}
              initialFilter={initialConstraintFilter}
              onFilterSet={() => setInitialConstraintFilter(null)}
              onNavigateToTracesWithVisibleConstraints={handleNavigateToTracesWithVisibleConstraints}
              coViolationMatrix={coViolationMatrix}
          />
        )}

        {activeView === 'traces' && (
          <TracesView
            traces={filteredAndSortedTraces()}
            traceFilter={traceFilter}
            setTraceFilter={setTraceFilter}
            traceSort={traceSort}
            setTraceSort={setTraceSort}
            onTraceClick={handleTraceClick}
              processedConstraints={processedConstraints}
              totalTraces={traces.length}
          />
        )}

          {activeView === 'variants' && (
            <VariantsView
              traces={traces}
              processedConstraints={processedConstraints}
              modelVisualization={modelVisualization}
              setSelectedTrace={setSelectedTrace}
              setShowTraceDetail={setShowTraceDetail}
              onNavigateToTracesWithSequenceFilter={handleNavigateToTracesWithSequenceFilter}
            />
          )}

          {activeView === 'resource' && (
            <ResourceView 
              traces={traces}
              constraints={processedConstraints}
            />
          )}

          {activeView === 'time' && (
            <TimeView 
              traces={traces}
              constraints={processedConstraints}
            />
          )}

          {activeView === 'model' && (
            <ProcessModelView 
              modelVisualization={modelVisualization}
              traces={traces}
              onConstraintClick={handleConstraintClick}
            />
          )}
        </div>
      </div>

      {/* Trace Detail Modal */}
      {showTraceDetail && selectedTrace && (
        <TraceDetailModal
          trace={selectedTrace}
          onClose={handleCloseTraceDetail}
        />
      )}
    </div>
  );
};

// Overview View Component
const OverviewView: React.FC<{
  overview: DashboardOverview;
  modelVisualization: ModelVisualization | null;
  traces: DashboardTrace[];
  onConstraintClick?: (constraintId: string) => void;
  onNavigateToTraces?: () => void;
  onNavigateToConstraints?: () => void;
  onNavigateToTracesWithFitnessSort?: () => void;
  onNavigateToConstraintsWithCompliance?: () => void;
  onNavigateToConstraintsWithQuality?: () => void;
  onNavigateToConstraintsWithEfficiency?: () => void;
  onNavigateToConstraintsWithCriticalPriority?: () => void;
  onNavigateToConstraintsWithHighPriority?: () => void;
  onNavigateToVariants?: () => void;
}> = ({ overview, modelVisualization, traces, onConstraintClick, onNavigateToTraces, onNavigateToConstraints, onNavigateToTracesWithFitnessSort, onNavigateToConstraintsWithCompliance, onNavigateToConstraintsWithQuality, onNavigateToConstraintsWithEfficiency, onNavigateToConstraintsWithCriticalPriority, onNavigateToConstraintsWithHighPriority, onNavigateToVariants }) => {
  
  // Animated counter states
  const [animatedValues, setAnimatedValues] = useState({
    totalTraces: 0,
    totalVariants: 0,
    totalConstraints: 0,
    overallFitness: 0,
    overallConformance: 0,
    overallCompliance: 0,
    overallQuality: 0,
    overallEfficiency: 0,
    criticalViolations: 0,
    highPriorityViolations: 0
  });

  // Animate values when component mounts
  useEffect(() => {
    const duration = 1500; // 1.5 seconds
    const steps = 60; // 60 steps for smooth animation
    const stepDuration = duration / steps;

    const animateValue = (start: number, end: number, setter: (value: number) => void) => {
      const increment = (end - start) / steps;
      let current = start;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
          setter(end);
          clearInterval(timer);
        } else {
          setter(current);
        }
      }, stepDuration);
    };

    // Start animations
    animateValue(0, overview.totalTraces, (value) => setAnimatedValues(prev => ({ ...prev, totalTraces: Math.floor(value) })));
    animateValue(0, overview.totalVariants, (value) => setAnimatedValues(prev => ({ ...prev, totalVariants: Math.floor(value) })));
    animateValue(0, overview.totalConstraints, (value) => setAnimatedValues(prev => ({ ...prev, totalConstraints: Math.floor(value) })));
    animateValue(0, overview.overallFitness, (value) => setAnimatedValues(prev => ({ ...prev, overallFitness: value })));
    animateValue(0, overview.overallConformance, (value) => setAnimatedValues(prev => ({ ...prev, overallConformance: value })));
    animateValue(0, overview.overallCompliance, (value) => setAnimatedValues(prev => ({ ...prev, overallCompliance: value })));
    animateValue(0, overview.overallQuality, (value) => setAnimatedValues(prev => ({ ...prev, overallQuality: value })));
    animateValue(0, overview.overallEfficiency, (value) => setAnimatedValues(prev => ({ ...prev, overallEfficiency: value })));
    animateValue(0, overview.criticalViolations, (value) => setAnimatedValues(prev => ({ ...prev, criticalViolations: Math.floor(value) })));
    animateValue(0, overview.highPriorityViolations, (value) => setAnimatedValues(prev => ({ ...prev, highPriorityViolations: Math.floor(value) })));
  }, [overview]);

  const handleMouseEnter = (event: React.MouseEvent, tooltip: string) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Remove any existing tooltip first
    const existingTooltip = document.getElementById('custom-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // Create tooltip element
    const tooltipEl = document.createElement('div');
    tooltipEl.textContent = tooltip;
    tooltipEl.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      max-width: 250px;
      text-align: center;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      white-space: normal;
      word-wrap: break-word;
    `;
    
    // Position tooltip above the card
    tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
    tooltipEl.style.top = `${rect.top - 10}px`;
    tooltipEl.style.transform = 'translateX(-50%) translateY(-100%)';
    
    tooltipEl.id = 'custom-tooltip';
    document.body.appendChild(tooltipEl);
  };

  const handleMouseLeave = () => {
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  };

  const handleClick = (onClickHandler: (() => void) | undefined) => {
    // Remove tooltip when clicking
    const tooltip = document.getElementById('custom-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
    
    // Call the original click handler if it exists
    if (onClickHandler) {
      onClickHandler();
    }
  };

  // Helper function to render circular progress
  const renderCircularProgress = (percentage: number, size: number = 80) => {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="6"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth="6"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '0.9rem',
          fontWeight: 'bold',
          color: 'white'
        }}>
          {percentage === 100 ? '100%' : percentage.toFixed(1) + '%'}
        </div>
      </div>
    );
  };

  return (
    <div className="overview-view">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToTraces ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Total number of process traces analyzed. Click to view all traces.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToTraces)}
        >
          <h3>Total Traces</h3>
          <div className="kpi-value" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 0, marginTop: '1rem' }}>{animatedValues.totalTraces}</div>
        </div>
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToTraces ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Total number of unique activity sequences (variants) in the process. Click to view all traces.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToVariants)}
        >
          <h3>Total Variants</h3>
          <div className="kpi-value" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 0, marginTop: '1rem' }}>{animatedValues.totalVariants}</div>
        </div>
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToConstraints ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Total number of DECLARE constraints in the process model. Click to view all constraints.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToConstraints)}
        >
          <h3>Total Constraints</h3>
          <div className="kpi-value" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 0, marginTop: '1rem' }}>{animatedValues.totalConstraints}</div>
        </div>
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToTracesWithFitnessSort ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Average fitness across all traces. Click to view traces sorted by fitness (low to high).")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToTracesWithFitnessSort)}
        >
          <h3>Overall Fitness</h3>
          <div className="kpi-value-with-progress">
            {renderCircularProgress(animatedValues.overallFitness * 100)}
        </div>
        </div>
        <div 
          className="kpi-card"
          onMouseEnter={(e) => handleMouseEnter(e, "Percentage of traces that have no constraint violations.")}
          onMouseLeave={handleMouseLeave}
        >
          <h3>Overall Conformance</h3>
          <div className="kpi-value-with-progress">
            {renderCircularProgress(animatedValues.overallConformance * 100)}
        </div>
        </div>
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToConstraintsWithCompliance ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Percentage of traces that do not violate compliance constraints. Click to view compliance constraints.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToConstraintsWithCompliance)}
        >
          <h3>Overall Compliance</h3>
          <div className="kpi-value-with-progress">
            {renderCircularProgress(animatedValues.overallCompliance * 100)}
        </div>
        </div>
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToConstraintsWithQuality ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Percentage of traces that do not violate quality constraints. Click to view quality constraints.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToConstraintsWithQuality)}
        >
          <h3>Overall Quality</h3>
          <div className="kpi-value-with-progress">
            {renderCircularProgress(animatedValues.overallQuality * 100)}
        </div>
        </div>
        <div 
          className="kpi-card clickable" 
          style={{ cursor: onNavigateToConstraintsWithEfficiency ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Percentage of traces that do not violate efficiency constraints. Click to view efficiency constraints.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToConstraintsWithEfficiency)}
        >
          <h3>Overall Efficiency</h3>
          <div className="kpi-value-with-progress">
            {renderCircularProgress(animatedValues.overallEfficiency * 100)}
        </div>
        </div>
        <div 
          className="kpi-card critical clickable" 
          style={{ cursor: onNavigateToConstraintsWithCriticalPriority ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Number of critical priority constraints with violations. Click to view critical constraints.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToConstraintsWithCriticalPriority)}
        >
          <h3>Critical Violations</h3>
          <div className="kpi-value" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 0, marginTop: '1rem' }}>{animatedValues.criticalViolations}</div>
        </div>
        <div 
          className="kpi-card warning clickable" 
          style={{ cursor: onNavigateToConstraintsWithHighPriority ? 'pointer' : 'default' }}
          onMouseEnter={(e) => handleMouseEnter(e, "Number of high priority constraints with violations. Click to view high priority constraints.")}
          onMouseLeave={handleMouseLeave}
          onClick={() => handleClick(onNavigateToConstraintsWithHighPriority)}
        >
          <h3>High Priority Violations</h3>
          <div className="kpi-value" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 0, marginTop: '1rem' }}>{animatedValues.highPriorityViolations}</div>
        </div>
      </div>
      
      {/* Fitness Distribution Chart 
      <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', color: '#2c3e50' }}>Fitness Distribution</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: '1rem' }}>
          Distribution of trace fitness scores across all traces.
        </div>
        <div style={{ height: 400, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {traces.length === 0 ? (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No trace data available for fitness distribution.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={(() => {
                // Create fitness distribution bins
                const bins: { [key: string]: number } = {
                  '0.0-0.1': 0,
                  '0.1-0.2': 0,
                  '0.2-0.3': 0,
                  '0.3-0.4': 0,
                  '0.4-0.5': 0,
                  '0.5-0.6': 0,
                  '0.6-0.7': 0,
                  '0.7-0.8': 0,
                  '0.8-0.9': 0,
                  '0.9-1.0': 0
                };
                
                traces.forEach(trace => {
                  const fitness = trace.fitness;
                  if (fitness >= 0.0 && fitness < 0.1) bins['0.0-0.1']++;
                  else if (fitness >= 0.1 && fitness < 0.2) bins['0.1-0.2']++;
                  else if (fitness >= 0.2 && fitness < 0.3) bins['0.2-0.3']++;
                  else if (fitness >= 0.3 && fitness < 0.4) bins['0.3-0.4']++;
                  else if (fitness >= 0.4 && fitness < 0.5) bins['0.4-0.5']++;
                  else if (fitness >= 0.5 && fitness < 0.6) bins['0.5-0.6']++;
                  else if (fitness >= 0.6 && fitness < 0.7) bins['0.6-0.7']++;
                  else if (fitness >= 0.7 && fitness < 0.8) bins['0.7-0.8']++;
                  else if (fitness >= 0.8 && fitness < 0.9) bins['0.8-0.9']++;
                  else if (fitness >= 0.9 && fitness <= 1.0) bins['0.9-1.0']++;
                });
                
                return Object.entries(bins).map(([range, count]) => ({
                  range,
                  count,
                  percentage: (count / traces.length) * 100
                }));
              })()} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="range" 
                  angle={-45} 
                  textAnchor="end" 
                  height={60}
                  tick={{ fontSize: 12 }}
                >
                  <Label value="Fitness Range" offset={20} position="bottom" />
                </XAxis>
                <YAxis 
                  allowDecimals={false}
                  label={{ value: 'Number of Traces', angle: -90, position: 'insideLeft'}}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => [
                    `${value} traces (${((value / traces.length) * 100).toFixed(1)}%)`, 
                    'Count'
                  ]}
                  labelFormatter={(label) => `Fitness: ${label}`}
                />
                <Bar dataKey="count" fill="#667eea" name="Trace Count" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>*/}
    </div>
  );
};

// Constraints View Component
const ConstraintsView: React.FC<{
  constraints: DashboardConstraint[];
  modelVisualization: ModelVisualization | null;
  onConstraintClick: (constraintId: string) => void;
  initialFilter: string | null;
  onFilterSet: () => void;
  onNavigateToTracesWithVisibleConstraints: (visibleConstraintIds: string[]) => void;
  coViolationMatrix: number[][];
}> = ({ constraints, modelVisualization, onConstraintClick, initialFilter, onFilterSet, onNavigateToTracesWithVisibleConstraints, coViolationMatrix }) => {
  const [constraintFilter, setConstraintFilter] = useState({
    priority: '',
    categories: [] as string[],
    minRate: '',
    maxRate: '',
    hasViolations: false,
    group: '',
    isTimeConstraint: false
  });
  const [constraintSort, setConstraintSort] = useState({
    field: 'id' as 'id' | 'violationCount' | 'fulfilmentCount' | 'violationRate' | 'priority',
    direction: 'asc' as 'asc' | 'desc'
  });

  // Handle initial filter
  useEffect(() => {
    if (initialFilter) {
      if (initialFilter === 'critical' || initialFilter === 'high') {
        // Set priority filter
        setConstraintFilter(prev => ({
          ...prev,
          priority: initialFilter.toUpperCase()
        }));
      } else {
        // Set category filter
        setConstraintFilter(prev => ({
          ...prev,
          categories: [initialFilter]
        }));
      }
      onFilterSet(); // Clear the initial filter after setting it
    }
  }, [initialFilter, onFilterSet]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return '#e74c3c';
      case 'HIGH': return '#f39c12';
      case 'MEDIUM': return '#f1c40f';
      case 'LOW': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  // Filter and sort constraints
  const filteredAndSortedConstraints = useCallback(() => {
    let filtered = constraints.filter(constraint => {
      // Priority filter
      if (constraintFilter.priority && constraint.tag?.priority !== constraintFilter.priority) {
        return false;
      }
      
      // Categories filter
      if (constraintFilter.categories.length > 0) {
        const constraintCategories: string[] = [];
        if (constraint.tag?.quality) constraintCategories.push('quality');
        if (constraint.tag?.efficiency) constraintCategories.push('efficiency');
        if (constraint.tag?.compliance) constraintCategories.push('compliance');
        
        if (!constraintFilter.categories.some(cat => constraintCategories.includes(cat))) {
          return false;
        }
      }
      
      // Group filter
      if (constraintFilter.group) {
        if (constraintFilter.group === 'Ungrouped') {
          // For "Ungrouped" filter, show constraints that have no group
          if (constraint.tag?.group) {
            return false;
          }
        } else {
          // For specific group filter, show constraints that match the group
          if (constraint.tag?.group !== constraintFilter.group) {
            return false;
          }
        }
      }
      
      // Rate filters
      if (constraintFilter.minRate && constraint.violationRate < parseFloat(constraintFilter.minRate) / 100) {
        return false;
      }
      if (constraintFilter.maxRate && constraint.violationRate > parseFloat(constraintFilter.maxRate) / 100) {
        return false;
      }
      
      // Violations filter
      if (constraintFilter.hasViolations && constraint.violationCount === 0) {
        return false;
      }
      
      // Time-related filter
      if (constraintFilter.isTimeConstraint && !constraint.isTimeConstraint) {
        return false;
      }
      
      return true;
    });

    // Sort constraints
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (constraintSort.field) {
        case 'violationCount':
          aValue = a.violationCount;
          bValue = b.violationCount;
          break;
        case 'fulfilmentCount':
          aValue = a.fulfilmentCount;
          bValue = b.fulfilmentCount;
          break;
        case 'violationRate':
          aValue = a.violationRate;
          bValue = b.violationRate;
          break;
        case 'priority':
          const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
          aValue = priorityOrder[a.tag?.priority || 'MEDIUM'];
          bValue = priorityOrder[b.tag?.priority || 'MEDIUM'];
          break;
        default:
          aValue = a.id;
          bValue = b.id;
      }

      if (constraintSort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [constraints, constraintFilter, constraintSort]);

  // Group-based aggregation
  const constraintGroups = useMemo(() => {
    const groups = new Map<string, {
      id: string;
      name: string;
      constraints: DashboardConstraint[];
      totalViolations: number;
      totalFulfilments: number;
      averageViolationRate: number;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }>();

    // Group constraints by their assigned group
    constraints.forEach(constraint => {
      const groupName = constraint.tag?.group || 'Ungrouped';
      
      if (!groups.has(groupName)) {
        groups.set(groupName, {
          id: groupName,
          name: groupName,
          constraints: [],
          totalViolations: 0,
          totalFulfilments: 0,
          averageViolationRate: 0,
          severity: 'MEDIUM'
        });
      }
      
      const group = groups.get(groupName)!;
      group.constraints.push(constraint);
      group.totalViolations += constraint.violationCount;
      group.totalFulfilments += constraint.fulfilmentCount;
    });

    // Calculate group statistics
    groups.forEach(group => {
      if (group.constraints.length > 0) {
        // Calculate average violation rate correctly: violations / (violations + fulfilments)
        const totalActivations = group.totalViolations + group.totalFulfilments;
        group.averageViolationRate = totalActivations > 0 ? group.totalViolations / totalActivations : 0;
        
        // Determine group severity based on highest priority constraint
        const priorities = group.constraints.map(c => c.tag?.priority || 'MEDIUM');
        const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        const maxPriority = priorities.reduce((max, priority) => 
          priorityOrder[priority] > priorityOrder[max] ? priority : max, 'MEDIUM'
        );
        group.severity = maxPriority;
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [constraints]);

  const handleShowTracesForVisibleConstraints = useCallback(() => {
    const visibleConstraints = filteredAndSortedConstraints();
    const visibleConstraintIds = visibleConstraints.map(constraint => constraint.id);
    onNavigateToTracesWithVisibleConstraints(visibleConstraintIds);
  }, [filteredAndSortedConstraints, onNavigateToTracesWithVisibleConstraints]);

  return (
    <div className="constraints-view">
      {/* Group Summary (if groups exist) */}
      {constraintGroups.length > 1 && (
        <div className="group-summary-section">
          <h3>Group Summary</h3>
          <div className="group-summary-grid">
            {constraintGroups.map(group => (
              <div key={group.id} className="group-summary-card">
                <div className="group-summary-header">
                  <h4>{group.name}</h4>
                  <span className={`group-severity-badge ${group.severity.toLowerCase()}`}>
                    {group.severity}
                  </span>
                </div>
                <div className="group-summary-stats">
                  <div className="group-stat">
                    <span className="stat-label">Constraints:</span>
                    <span className="stat-value">{group.constraints.length}</span>
                  </div>
                  <div className="group-stat">
                    <span className="stat-label">Violations:</span>
                    <span className="stat-value">{group.totalViolations}</span>
                  </div>
                  <div className="group-stat">
                    <span className="stat-label">Fulfilments:</span>
                    <span className="stat-value">{group.totalFulfilments}</span>
                  </div>
                  <div className="group-stat">
                    <span className="stat-label">Avg Rate:</span>
                    <span className="stat-value">{(group.averageViolationRate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="constraint-filters">
        <div className="filter-group">
          <label>Priority:</label>
          <select
            value={constraintFilter.priority}
            onChange={(e) => setConstraintFilter({
              ...constraintFilter,
              priority: e.target.value
            })}
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Categories:</label>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={constraintFilter.categories.includes('quality')}
                onChange={(e) => setConstraintFilter({
                  ...constraintFilter,
                  categories: e.target.checked 
                    ? [...constraintFilter.categories, 'quality']
                    : constraintFilter.categories.filter(cat => cat !== 'quality')
                })}
              />
              Quality
            </label>
            <label>
              <input
                type="checkbox"
                checked={constraintFilter.categories.includes('efficiency')}
                onChange={(e) => setConstraintFilter({
                  ...constraintFilter,
                  categories: e.target.checked 
                    ? [...constraintFilter.categories, 'efficiency']
                    : constraintFilter.categories.filter(cat => cat !== 'efficiency')
                })}
              />
              Efficiency
            </label>
            <label>
              <input
                type="checkbox"
                checked={constraintFilter.categories.includes('compliance')}
                onChange={(e) => setConstraintFilter({
                  ...constraintFilter,
                  categories: e.target.checked 
                    ? [...constraintFilter.categories, 'compliance']
                    : constraintFilter.categories.filter(cat => cat !== 'compliance')
                })}
              />
              Compliance
            </label>
          </div>
        </div>

        <div className="filter-group">
          <label>Group:</label>
          <select
            value={constraintFilter.group}
            onChange={(e) => setConstraintFilter({
              ...constraintFilter,
              group: e.target.value
            })}
          >
            <option value="">All Groups</option>
            {constraintGroups.map(group => (
              <option key={group.id} value={group.name}>{group.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Min Violation Rate (%):</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={constraintFilter.minRate}
            onChange={(e) => setConstraintFilter({
              ...constraintFilter,
              minRate: e.target.value
            })}
            placeholder="0"
          />
        </div>

        <div className="filter-group">
          <label>Max Violation Rate (%):</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={constraintFilter.maxRate}
            onChange={(e) => setConstraintFilter({
              ...constraintFilter,
              maxRate: e.target.value
            })}
            placeholder="100"
          />
        </div>

        <div className="filter-group">
          <label>
            <input
              type="checkbox"
              checked={constraintFilter.hasViolations}
              onChange={(e) => setConstraintFilter({
                ...constraintFilter,
                hasViolations: e.target.checked
              })}
            />
            Has Violations
          </label>
        </div>

        <div className="filter-group">
          <label>
            <input
              type="checkbox"
              checked={constraintFilter.isTimeConstraint}
              onChange={(e) => setConstraintFilter({
                ...constraintFilter,
                isTimeConstraint: e.target.checked
              })}
            />
            Time-Related Only
          </label>
        </div>

        {/* Show Traces for Visible Constraints Button */}
        <div className="filter-group">
          <button 
            className="show-traces-button"
            onClick={handleShowTracesForVisibleConstraints}
            style={{
              padding: '8px 16px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              marginTop: '8px'
            }}
          >
            Show Traces for Visible Constraints ({filteredAndSortedConstraints().length})
          </button>
        </div>
      </div>

      {/* Sort */}
      <div className="constraint-sort">
        <label>Sort by:</label>
        <select
          value={`${constraintSort.field}-${constraintSort.direction}`}
          onChange={(e) => {
            const [field, direction] = e.target.value.split('-');
            setConstraintSort({ 
              field: field as any, 
              direction: direction as 'asc' | 'desc' 
            });
          }}
        >
          <option value="id-asc">ID (A-Z)</option>
          <option value="id-desc">ID (Z-A)</option>
          <option value="violationCount-asc">Violations (Low-High)</option>
          <option value="violationCount-desc">Violations (High-Low)</option>
          <option value="fulfilmentCount-asc">Fulfilments (Low-High)</option>
          <option value="fulfilmentCount-desc">Fulfilments (High-Low)</option>
          <option value="violationRate-asc">Rate (Low-High)</option>
          <option value="violationRate-desc">Rate (High-Low)</option>
          <option value="priority-asc">Priority (Low-High)</option>
          <option value="priority-desc">Priority (High-Low)</option>
        </select>
      </div>

      {/* Results count */}
      <div className="constraints-results">
        <p>Showing {filteredAndSortedConstraints().length} of {constraints.length} constraints</p>
      </div>

      <div className="constraints-grid">
        {filteredAndSortedConstraints().map(constraint => (
          <div 
            key={constraint.id} 
            className="constraint-card"
            onClick={() => onConstraintClick(constraint.id)}
            style={{ cursor: 'pointer' }}
          >
            <div className="constraint-header">
              <h4 className="constraint-id-code">{constraint.id}</h4>
              {constraint.tag && (
                <span 
                  className="priority-badge"
                  style={{ 
                    backgroundColor: getPriorityColor(constraint.tag.priority),
                    color: 'white'
                  }}
                >
                  {constraint.tag.priority}
                </span>
              )}
            </div>
            <div className="constraint-content">
              <p className="constraint-description">{constraint.helpText}</p>
              <div className="constraint-activities">
                <strong>Activities:</strong> {constraint.description}
              </div>
              {constraint.tag?.group && (
                <div className="constraint-group">
                  <strong>Group:</strong> {constraint.tag.group}
                </div>
              )}
              {constraint.isTimeConstraint && (
                  <span className="category time">
                    <i className="fas fa-clock" style={{ marginRight: 4 }}></i>
                    Time
                  </span>
                )}
              <div className="constraint-stats">
                <div className="stat">
                  <span className="stat-label">Violations:</span>
                  <span className="stat-value">{constraint.violationCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Fulfilments:</span>
                  <span className="stat-value">{constraint.fulfilmentCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Rate:</span>
                  <span className="stat-value">{(constraint.violationRate * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="tag-categories">
                {constraint.tag?.quality && (
                  <span className="category quality">Quality</span>
                )}
                {constraint.tag?.efficiency && (
                  <span className="category efficiency">Efficiency</span>
                )}
                {constraint.tag?.compliance && (
                  <span className="category compliance">Compliance</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConstraintInterdependencyView
        constraints={constraints}
        coViolationMatrix={coViolationMatrix}
      />
    </div>
  );
};

// Traces View Component
const TracesView: React.FC<{
  traces: DashboardTrace[];
  traceFilter: TraceFilter;
  setTraceFilter: (filter: TraceFilter) => void;
  traceSort: TraceSort;
  setTraceSort: (sort: TraceSort) => void;
  onTraceClick: (trace: DashboardTrace) => void;
  processedConstraints: DashboardConstraint[];
  totalTraces: number;
}> = ({ traces, traceFilter, setTraceFilter, traceSort, setTraceSort, onTraceClick, processedConstraints, totalTraces }) => {
  const [traceIdSearch, setTraceIdSearch] = React.useState('');

  // Filter traces by Trace ID search in addition to other filters
  const filteredTraces = React.useMemo(() => {
    if (!traceIdSearch) return traces;
    return traces.filter(trace => trace.caseId.toLowerCase().includes(traceIdSearch.toLowerCase()));
  }, [traces, traceIdSearch]);

  return (
    <div className="traces-view">
      {/* Filters */}
      <div className="trace-filters">
        <div className="filter-group">
          <label>Case ID:</label>
          <input
            type="text"
            placeholder="Search Case ID..."
            value={traceIdSearch}
            onChange={e => setTraceIdSearch(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: '1rem', width: 140, height: 36, boxSizing: 'border-box' }}
          />
        </div>
        <div className="filter-group">
          <label>Min Fitness:</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={traceFilter.minFitness || ''}
            onChange={(e) => setTraceFilter({
              ...traceFilter,
              minFitness: e.target.value ? parseFloat(e.target.value) : undefined
            })}
          />
        </div>
        <div className="filter-group">
          <label>Max Fitness:</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={traceFilter.maxFitness || ''}
            onChange={(e) => setTraceFilter({
              ...traceFilter,
              maxFitness: e.target.value ? parseFloat(e.target.value) : undefined
            })}
          />
        </div>
        <div className="filter-group">
          <label>Has:</label>
          <select
            value={traceFilter.hasViolations ? 'violations' : traceFilter.hasFulfilments ? 'fulfilments' : traceFilter.hasInsertions ? 'insertions' : traceFilter.hasDeletions ? 'deletions' : ''}
            onChange={(e) => {
              const value = e.target.value;
              setTraceFilter({
                ...traceFilter,
                hasViolations: value === 'violations',
                hasFulfilments: value === 'fulfilments',
                hasInsertions: value === 'insertions',
                hasDeletions: value === 'deletions'
              });
            }}
          >
            <option value="">Any</option>
            <option value="violations">Violations</option>
            <option value="fulfilments">Fulfilments</option>
            <option value="insertions">Insertions</option>
            <option value="deletions">Deletions</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Add Constraint Filter:</label>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                const newConstraintId = e.target.value;
                const currentConstraints = traceFilter.constraintTypes || [];
                if (!currentConstraints.includes(newConstraintId)) {
                  setTraceFilter({
                    ...traceFilter,
                    constraintTypes: [...currentConstraints, newConstraintId]
                  });
                }
                e.target.value = ''; // Reset selection
              }
            }}
            style={{ width: 140, height: 36, borderRadius: 4, border: '1px solid #ccc', fontSize: '1rem', boxSizing: 'border-box' }}
          >
            <option value="">Select a constraint...</option>
            {processedConstraints
              .filter(constraint => !traceFilter.constraintTypes?.includes(constraint.id))
              .map(constraint => (
                <option key={constraint.id} value={constraint.id}>
                  {constraint.id}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Constraint Filter */}
      {traceFilter.constraintTypes && traceFilter.constraintTypes.length > 0 && (
        <div className="constraint-filter-section">
          <h4>Filtered by Constraints:</h4>
          <div className="constraint-filter-tags">
            {traceFilter.constraintTypes.map(constraintId => {
              const constraint = processedConstraints.find(c => c.id === constraintId);
              return (
                <div key={constraintId} className="constraint-filter-tag">
                  <span className="constraint-name">
                    {constraintId}
                  </span>
                  <button
                    className="remove-constraint-filter"
                    onClick={() => setTraceFilter({
                      ...traceFilter,
                      constraintTypes: traceFilter.constraintTypes?.filter(id => id !== constraintId) || []
                    })}
                  >
                    ×
                  </button>
        </div>
              );
            })}
            <button
              className="clear-all-constraints"
              onClick={() => setTraceFilter({
                ...traceFilter,
                constraintTypes: []
              })}
            >
              Clear All
            </button>
      </div>
        </div>
      )}

      {/* Sequence Filter */}
      {traceFilter.sequence && (
        <div className="constraint-filter-section">
          <h4>Filtered by Sequence:</h4>
          <div className="constraint-filter-tags">
            <div className="constraint-filter-tag">
              <span className="constraint-name">
                {traceFilter.sequence.length > 50 ? traceFilter.sequence.substring(0, 50) + '...' : traceFilter.sequence}
              </span>
              <button
                className="remove-constraint-filter"
                onClick={() => setTraceFilter({
                  ...traceFilter,
                  sequence: undefined
                })}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort */}
      <div className="trace-sort">
        <label>Sort by:</label>
        <select
          value={`${traceSort.field}-${traceSort.direction}`}
          onChange={(e) => {
            const [field, direction] = e.target.value.split('-');
            setTraceSort({ field: field as any, direction: direction as 'asc' | 'desc' });
          }}
        >
          <option value="caseId-asc">Case ID (A-Z)</option>
          <option value="caseId-desc">Case ID (Z-A)</option>
          <option value="fitness-asc">Fitness (Low-High)</option>
          <option value="fitness-desc">Fitness (High-Low)</option>
          <option value="violations-asc">Violations (Low-High)</option>
          <option value="violations-desc">Violations (High-Low)</option>
        </select>
      </div>

      {/* Results count */}
      <div className="traces-results">
        <p>Showing {filteredTraces.length} of {totalTraces} traces</p>
      </div>

      {/* Traces Table */}
      <div className="traces-table">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => setTraceSort({ field: 'caseId', direction: traceSort.field === 'caseId' && traceSort.direction === 'asc' ? 'desc' : 'asc' })}>
                <span className="sort-indicator">{traceSort.field === 'caseId' ? (traceSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Case ID
              </th>
              <th className="sortable" onClick={() => setTraceSort({ field: 'fitness', direction: traceSort.field === 'fitness' && traceSort.direction === 'asc' ? 'desc' : 'asc' })}>
                <span className="sort-indicator">{traceSort.field === 'fitness' ? (traceSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Fitness
              </th>
              <th className="sortable" onClick={() => setTraceSort({ field: 'violations', direction: traceSort.field === 'violations' && traceSort.direction === 'asc' ? 'desc' : 'asc' })}>
                <span className="sort-indicator">{traceSort.field === 'violations' ? (traceSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Violations
              </th>
              <th>Fulfilments</th>
              <th>Insertions</th>
              <th>Deletions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTraces.map(trace => (
              <tr key={trace.caseId}>
                <td>{trace.caseId}</td>
                <td className={`fitness-cell ${trace.fitness < 0.5 ? 'low' : trace.fitness < 0.8 ? 'medium' : 'high'}`}>
                  {(trace.fitness * 100).toFixed(1)}%
                </td>
                <td className={`violations-cell ${trace.violations > 0 ? 'has-violations' : ''}`}>
                  {trace.violations}
                </td>
                <td>{trace.fulfilments}</td>
                <td>{trace.insertions}</td>
                <td>{trace.deletions}</td>
                <td>
                  <button
                    className="detail-button"
                    onClick={() => onTraceClick(trace)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Variants View Component
const VariantsView: React.FC<{
  traces: DashboardTrace[];
  processedConstraints: DashboardConstraint[];
  modelVisualization: ModelVisualization | null;
  setSelectedTrace: React.Dispatch<React.SetStateAction<DashboardTrace | null>>;
  setShowTraceDetail: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigateToTracesWithSequenceFilter: (sequence: string) => void;
}> = ({ traces, processedConstraints, modelVisualization, setSelectedTrace, setShowTraceDetail, onNavigateToTracesWithSequenceFilter }) => {
  const [variantFilter, setVariantFilter] = useState({
    minLength: '',
    maxLength: '',
    hasViolations: false,
    hasFulfilments: false,
    hasInsertions: false,
    hasDeletions: false,
    constraintTypes: [] as string[]
  });
  const [showProcessFlow, setShowProcessFlow] = useState(false);
  const [selectedVariantForFlow, setSelectedVariantForFlow] = useState<{
    sequence: string;
    traces: DashboardTrace[];
  } | null>(null);
  
  type VariantSortField = 'sequence' | 'count' | 'length' | 'fitness' | 'violations' | 'fulfilments' | 'alignmentCosts';
  const [variantSort, setVariantSort] = useState<{ field: VariantSortField; direction: 'asc' | 'desc' }>({
    field: 'length',
    direction: 'desc'
  });
  const [expandedSequences, setExpandedSequences] = useState<Set<string>>(new Set());

  const toggleSequenceExpansion = (sequence: string) => {
    const newExpanded = new Set(expandedSequences);
    if (newExpanded.has(sequence)) {
      newExpanded.delete(sequence);
    } else {
      newExpanded.add(sequence);
    }
    setExpandedSequences(newExpanded);
  };

  // Group traces by activity sequence
  const activitySequences = useMemo(() => {
    const sequences = new Map<string, {
      sequence: string;
      traces: DashboardTrace[];
      totalViolations: number;
      totalFulfilments: number;
      totalInsertions: number;
      totalDeletions: number;
      averageFitness: number;
    }>();

    traces.forEach(trace => {
      const activitySequence = trace.events.map(e => e.activity).join(' → ');
      
      if (!sequences.has(activitySequence)) {
        sequences.set(activitySequence, {
          sequence: activitySequence,
          traces: [],
          totalViolations: 0,
          totalFulfilments: 0,
          totalInsertions: 0,
          totalDeletions: 0,
          averageFitness: 0
        });
      }
      
      const sequence = sequences.get(activitySequence)!;
      sequence.traces.push(trace);
      sequence.totalViolations += trace.violations;
      sequence.totalFulfilments += trace.fulfilments;
      sequence.totalInsertions += trace.insertions;
      sequence.totalDeletions += trace.deletions;
      sequence.averageFitness += trace.fitness;
    });

    // Calculate average statistics for each sequence
    sequences.forEach(sequence => {
      if (sequence.traces.length > 0) {
        sequence.averageFitness /= sequence.traces.length;
      }
    });

    return Array.from(sequences.values()).sort((a, b) => {
      let aValue: any, bValue: any;
      switch (variantSort.field) {
        case 'length':
          aValue = a.sequence.split(' → ').length;
          bValue = b.sequence.split(' → ').length;
          break;
        case 'fitness':
          aValue = a.averageFitness;
          bValue = b.averageFitness;
          break;
        case 'violations':
          aValue = a.totalViolations;
          bValue = b.totalViolations;
          break;
        case 'fulfilments':
          aValue = a.totalFulfilments;
          bValue = b.totalFulfilments;
          break;
        case 'alignmentCosts':
          aValue = a.totalInsertions + a.totalDeletions;
          bValue = b.totalInsertions + b.totalDeletions;
          break;
        default:
          aValue = a.sequence;
          bValue = b.sequence;
      }

      if (variantSort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [traces, variantSort]);

  // Filter and sort variants
  const filteredAndSortedVariants = useCallback(() => {
    let filtered = activitySequences.filter(variant => {
      const sequenceLength = variant.sequence.split(' → ').length;
      
      if (variantFilter.minLength && sequenceLength < parseInt(variantFilter.minLength)) return false;
      if (variantFilter.maxLength && sequenceLength > parseInt(variantFilter.maxLength)) return false;
      if (variantFilter.hasViolations && (variant.totalViolations / variant.traces.length) === 0) return false;
      if (variantFilter.hasFulfilments && (variant.totalFulfilments / variant.traces.length) === 0) return false;
      if (variantFilter.hasInsertions && ((variant.totalInsertions + variant.totalDeletions) / variant.traces.length) === 0) return false;
      if (variantFilter.constraintTypes.length > 0) {
        // Check if any trace in this variant has the specified constraint violations
        const hasMatchingConstraint = variant.traces.some(trace => {
          const constraintIds = variantFilter.constraintTypes.filter(id => 
            processedConstraints.some(c => c.id === id)
          );
          
          if (constraintIds.length > 0) {
            // Filter by specific constraint IDs
            return constraintIds.some(id => trace.violatedConstraints.includes(id));
          } else {
            // Filter by constraint types
            const traceConstraintTypes = [...trace.violatedConstraints, ...trace.fulfilledConstraints]
              .map(id => processedConstraints.find(c => c.id === id)?.type)
              .filter(Boolean);
            return variantFilter.constraintTypes.some(type => traceConstraintTypes.includes(type));
          }
        });
        
        if (!hasMatchingConstraint) return false;
      }
      return true;
    });

    // Sort variants
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (variantSort.field) {
        case 'sequence':
          aValue = a.sequence;
          bValue = b.sequence;
          break;
        case 'count':
          aValue = a.traces.length;
          bValue = b.traces.length;
          break;
        case 'length':
          aValue = a.sequence.split(' → ').length;
          bValue = b.sequence.split(' → ').length;
          break;
        case 'fitness':
          aValue = a.averageFitness;
          bValue = b.averageFitness;
          break;
        case 'violations':
          aValue = a.totalViolations / a.traces.length;
          bValue = b.totalViolations / b.traces.length;
          break;
        case 'fulfilments':
          aValue = a.totalFulfilments / a.traces.length;
          bValue = b.totalFulfilments / b.traces.length;
          break;
        case 'alignmentCosts':
          aValue = (a.totalInsertions + a.totalDeletions) / a.traces.length;
          bValue = (b.totalInsertions + b.totalDeletions) / b.traces.length;
          break;
        default:
          aValue = a.sequence;
          bValue = b.sequence;
      }

      if (variantSort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [activitySequences, variantFilter, variantSort, processedConstraints]);

  const handleShowTracesForVisibleConstraints = useCallback((visibleConstraintIds: string[]) => {
    setVariantFilter(prev => ({
      ...prev,
      constraintTypes: visibleConstraintIds
    }));
  }, []);

  // Add 'count' and 'sequence' to sort logic
  const handleSort = (field: VariantSortField) => {
    setVariantSort(prev => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        return { field, direction: 'desc' };
      }
    });
  };

  return (
    <div className="variants-view">
      {/* Filters */}
      <div className="variant-filters">
        <div className="filter-group">
          <label>Min Length:</label>
          <input
            type="number"
            min="0"
            value={variantFilter.minLength}
            onChange={(e) => setVariantFilter({
              ...variantFilter,
              minLength: e.target.value
            })}
            placeholder="0"
          />
        </div>
        <div className="filter-group">
          <label>Max Length:</label>
          <input
            type="number"
            min="0"
            value={variantFilter.maxLength}
            onChange={(e) => setVariantFilter({
              ...variantFilter,
              maxLength: e.target.value
            })}
            placeholder="100"
          />
        </div>
        <div className="filter-group">
          <label>Has:</label>
          <select
            value={variantFilter.hasViolations ? 'violations' : variantFilter.hasFulfilments ? 'fulfilments' : variantFilter.hasInsertions ? 'insertions' : variantFilter.hasDeletions ? 'deletions' : ''}
            onChange={(e) => {
              const value = e.target.value;
              setVariantFilter({
                ...variantFilter,
                hasViolations: value === 'violations',
                hasFulfilments: value === 'fulfilments',
                hasInsertions: value === 'insertions',
                hasDeletions: value === 'deletions'
              });
            }}
          >
            <option value="">Any</option>
            <option value="violations">Violations</option>
            <option value="fulfilments">Fulfilments</option>
            <option value="insertions">Alignment Costs</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Add Constraint Filter:</label>
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) {
                const newConstraintId = e.target.value;
                const currentConstraints = variantFilter.constraintTypes || [];
                if (!currentConstraints.includes(newConstraintId)) {
                  setVariantFilter({
                    ...variantFilter,
                    constraintTypes: [...currentConstraints, newConstraintId]
                  });
                }
                e.target.value = ''; // Reset selection
              }
            }}
          >
            <option value="">Select a constraint...</option>
            {processedConstraints
              .filter(constraint => !variantFilter.constraintTypes?.includes(constraint.id))
              .map(constraint => (
                <option key={constraint.id} value={constraint.id}>
                  {constraint.id}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Constraint Filter */}
      {variantFilter.constraintTypes && variantFilter.constraintTypes.length > 0 && (
        <div className="constraint-filter-section">
          <h4>Filtered by Constraints:</h4>
          <div className="constraint-filter-tags">
            {variantFilter.constraintTypes.map(constraintId => {
              const constraint = processedConstraints.find(c => c.id === constraintId);
              return (
                <div key={constraintId} className="constraint-filter-tag">
                  <span className="constraint-name">
                    {constraintId}
                  </span>
                  <button
                    className="remove-constraint-filter"
                    onClick={() => setVariantFilter({
                      ...variantFilter,
                      constraintTypes: variantFilter.constraintTypes?.filter(id => id !== constraintId) || []
                    })}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            <button
              className="clear-all-constraints"
              onClick={() => setVariantFilter({
                ...variantFilter,
                constraintTypes: []
              })}
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="variants-results">
        <p>Showing {filteredAndSortedVariants().length} variants</p>
      </div>

      {/* Variants Table */}
      <div className="variants-table">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('sequence')}>
                <span className="sort-indicator">{variantSort.field === 'sequence' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Sequence
              </th>
              <th className="sortable" onClick={() => handleSort('count')}>
                <span className="sort-indicator">{variantSort.field === 'count' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Count
              </th>
              <th className="sortable" onClick={() => handleSort('length')}>
                <span className="sort-indicator">{variantSort.field === 'length' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Length
              </th>
              <th className="sortable" onClick={() => handleSort('fitness')}>
                <span className="sort-indicator">{variantSort.field === 'fitness' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Fitness
              </th>
              <th className="sortable" onClick={() => handleSort('violations')}>
                <span className="sort-indicator">{variantSort.field === 'violations' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Violations
              </th>
              <th className="sortable" onClick={() => handleSort('fulfilments')}>
                <span className="sort-indicator">{variantSort.field === 'fulfilments' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Fulfilments
              </th>
              <th className="sortable" onClick={() => handleSort('alignmentCosts')}>
                <span className="sort-indicator">{variantSort.field === 'alignmentCosts' ? (variantSort.direction === 'asc' ? '▲' : '▼') : ''}</span>
                Alignment Costs
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedVariants().map(variant => (
              <tr key={variant.sequence}>
                <td className="sequence-cell">
                  <div className="sequence-display">
                    <button 
                      className="sequence-toggle"
                      onClick={() => toggleSequenceExpansion(variant.sequence)}
                    >
                      <span className={`chevron ${expandedSequences.has(variant.sequence) ? 'expanded' : ''}`}>
                        ▶
                      </span>
                    </button>
                    <div className="sequence-content">
                      {expandedSequences.has(variant.sequence) ? (
                        <code className="full-sequence">{variant.sequence}</code>
                      ) : (
                        <code className="truncated-sequence">
                          {variant.sequence.length > 50 ? variant.sequence.substring(0, 50) + '...' : variant.sequence}
                        </code>
                      )}
                    </div>
                  </div>
                </td>
                <td className="count-cell">{variant.traces.length}</td>
                <td>{variant.sequence.split(' → ').length}</td>
                <td className={`fitness-cell ${variant.averageFitness < 0.5 ? 'low' : variant.averageFitness < 0.8 ? 'medium' : 'high'}`}>
                  {Math.round(variant.averageFitness * 100)}%
                </td>
                <td className={`violations-cell ${(variant.totalViolations / variant.traces.length) > 0 ? 'has-violations' : ''}`}>
                  {Math.round(variant.totalViolations / variant.traces.length)}
                </td>
                <td>{Math.round(variant.totalFulfilments / variant.traces.length)}</td>
                <td>{Math.round((variant.totalInsertions + variant.totalDeletions) / variant.traces.length)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button
                      className="detail-button"
                      onClick={() => {
                        // Navigate to traces view with sequence filtering
                        onNavigateToTracesWithSequenceFilter(variant.sequence);
                      }}
                    >
                      View Traces
                    </button>
                    <button
                      className="detail-button"
                      style={{ backgroundColor: '#667eea', color: 'white' }}
                      onClick={() => {
                        setSelectedVariantForFlow({
                          sequence: variant.sequence,
                          traces: variant.traces
                        });
                        setShowProcessFlow(true);
                      }}
                    >
                      Show Graph
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Process Flow Modal */}
      {showProcessFlow && selectedVariantForFlow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '20px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #e9ecef',
              paddingBottom: '10px'
            }}>
              <h2>Process Flow for Variant ({selectedVariantForFlow.traces.length} traces)</h2>
              <button
                onClick={() => {
                  setShowProcessFlow(false);
                  setSelectedVariantForFlow(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            <ProcessModelView 
              modelVisualization={null}
              traces={selectedVariantForFlow.traces}
              onConstraintClick={(constraintId) => {
                // Handle constraint click - could navigate to constraints view
                console.log('Constraint clicked:', constraintId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Trace Detail Modal Component
const TraceDetailModal: React.FC<{
  trace: DashboardTrace;
  onClose: () => void;
}> = ({ trace, onClose }) => {
  const [alignmentTab, setAlignmentTab] = useState<'table' | 'graph'>('table');

  // Dynamic programming algorithm to find optimal alignment
  const findOptimalAlignment = (seq1: string[], seq2: string[]) => {
    const m = seq1.length;
    const n = seq2.length;
    
    // Create DP table
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i; // Cost of deleting i elements
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j; // Cost of inserting j elements
    }
    
    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (seq1[i - 1] === seq2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]; // Match
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // Delete from seq1
            dp[i][j - 1] + 1,     // Insert into seq1
            dp[i - 1][j - 1] + 1  // Substitute
          );
        }
      }
    }
    
    // Backtrack to find the alignment
    const alignment: Array<{type: 'match' | 'insert' | 'delete'}> = [];
    let i = m, j = n;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && seq1[i - 1] === seq2[j - 1]) {
        alignment.unshift({ type: 'match' });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
        alignment.unshift({ type: 'insert' });
        j--;
      } else {
        alignment.unshift({ type: 'delete' });
        i--;
      }
    }
    
    return alignment;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Trace Details: {trace.caseId}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="trace-summary">
            <div className="summary-item">
              <strong>Fitness:</strong> {(trace.fitness * 100).toFixed(1)}%
            </div>
            <div className="summary-item">
              <strong>Violations:</strong> {trace.violations}
            </div>
            <div className="summary-item">
              <strong>Fulfilments:</strong> {trace.fulfilments}
            </div>
            <div className="summary-item">
              <strong>Insertions:</strong> {trace.insertions}
            </div>
            <div className="summary-item">
              <strong>Deletions:</strong> {trace.deletions}
            </div>
            <div className="summary-item">
              <strong>Events:</strong> {trace.events.length}
            </div>
          </div>

          {/* Constraint Analysis Section */}
          {trace.constraintDetails && trace.constraintDetails.length > 0 && (
            <div className="trace-constraints">
              <h3>Constraint Analysis</h3>
              <div className="constraints-summary">
                <div className="summary-stat">
                  <span className="stat-label">Total Constraints:</span>
                  <span className="stat-value">{trace.constraintDetails.length}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Violated:</span>
                  <span className="stat-value violated">{trace.constraintDetails.filter(d => d.totalViolations > 0).length}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Fulfilled:</span>
                  <span className="stat-value fulfilled">{trace.constraintDetails.filter(d => d.totalFulfilments > 0).length}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">No Activity:</span>
                  <span className="stat-value inactive">{trace.constraintDetails.filter(d => d.totalActivations === 0).length}</span>
                </div>
              </div>
              <div className="constraints-table">
                <table>
                  <thead>
                    <tr>
                      <th>Constraint ID</th>
                      <th>Activations</th>
                      <th>Fulfilments</th>
                      <th>Violations</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.constraintDetails.map((detail, index) => {
                      const hasViolations = detail.totalViolations > 0;
                      const hasFulfilments = detail.totalFulfilments > 0;
                      let status = 'No Activity';
                      if (hasViolations && hasFulfilments) {
                        status = 'Mixed';
                      } else if (hasViolations) {
                        status = 'Violated';
                      } else if (hasFulfilments) {
                        status = 'Fulfilled';
                      }
                      
                      return (
                        <tr key={index} className={hasViolations ? 'has-violations' : hasFulfilments ? 'has-fulfilments' : ''}>
                          <td className="constraint-id">
                            <code>{detail.constraintId}</code>
                          </td>
                          <td className="activations-cell">
                            {detail.totalActivations}
                          </td>
                          <td className="fulfilments-cell">
                            {detail.totalFulfilments}
                          </td>
                          <td className="violations-cell">
                            {detail.totalViolations}
                          </td>
                          <td className={`status-cell ${status.toLowerCase().replace(' ', '-')}`}>
                            {status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {trace.alignedEvents.length > 0 && (
            <div className="trace-alignment">
              <h3>Alignment Analysis</h3>
              <div className="alignment-description">
                <p>This shows how the actual trace aligns with the process model. Differences indicate where the real process deviates from the expected model.</p>
              </div>
              
              {/* Alignment Analysis Tabs */}
              <div className="alignment-tabs">
                <button
                  className={`tab-button ${alignmentTab === 'table' ? 'active' : ''}`}
                  onClick={() => setAlignmentTab('table')}
                >
                  Log & Model Moves
                </button>
                <button
                  className={`tab-button ${alignmentTab === 'graph' ? 'active' : ''}`}
                  onClick={() => setAlignmentTab('graph')}
                >
                  Process Flow Graph
                </button>
              </div>

              {alignmentTab === 'table' && (
                <div className="alignment-timeline">
                  <div className="alignment-header">
                    <span className="header-type">Type</span>
                    <span className="header-original">Original Event</span>
                    <span className="header-aligned">Aligned to Model</span>
                    <span className="header-difference">Difference</span>
                  </div>
                  {(() => {
                    // Advanced alignment algorithm
                    const originalEvents = trace.events;
                    const alignedEvents = trace.alignedEvents;
                    
                    // Create activity sequences for comparison
                    const originalSequence = originalEvents.map(e => e.activity);
                    const alignedSequence = alignedEvents.map(e => e.alignedActivity || e.originalActivity || '');
                    
                    // Find the optimal alignment using dynamic programming
                    const alignment = findOptimalAlignment(originalSequence, alignedSequence);
                    
                    // Convert alignment to display format
                    const alignmentComparison = [];
                    let originalIndex = 0;
                    let alignedIndex = 0;
                    
                    for (const operation of alignment) {
                      switch (operation.type) {
                        case 'match':
                          alignmentComparison.push({
                            type: 'synchronous',
                            originalActivity: originalEvents[originalIndex]?.activity || null,
                            alignedActivity: alignedEvents[alignedIndex]?.alignedActivity || alignedEvents[alignedIndex]?.originalActivity || null,
                            timestamp: originalEvents[originalIndex]?.timestamp || alignedEvents[alignedIndex]?.timestamp || null,
                            hasDifference: false
                          });
                          originalIndex++;
                          alignedIndex++;
                          break;
                        case 'insert':
                          alignmentComparison.push({
                            type: 'insertion',
                            originalActivity: null,
                            alignedActivity: alignedEvents[alignedIndex]?.alignedActivity || alignedEvents[alignedIndex]?.originalActivity || null,
                            timestamp: alignedEvents[alignedIndex]?.timestamp || null,
                            hasDifference: true
                          });
                          alignedIndex++;
                          break;
                        case 'delete':
                          alignmentComparison.push({
                            type: 'deletion',
                            originalActivity: originalEvents[originalIndex]?.activity || null,
                            alignedActivity: null,
                            timestamp: originalEvents[originalIndex]?.timestamp || null,
                            hasDifference: true
                          });
                          originalIndex++;
                          break;
                      }
                    }
                    
                    return alignmentComparison.map((comparison, index) => {
                      const isInsertion = comparison.type === 'insertion';
                      const isDeletion = comparison.type === 'deletion';
                      const isSynchronous = comparison.type === 'synchronous';
                      
                      return (
                        <div key={index} className={`alignment-item ${comparison.type} ${comparison.hasDifference ? 'has-difference' : ''}`}>
                          <span className={`alignment-type ${comparison.type}`}>
                            {isInsertion ? '➕ Model' :
                             isDeletion ? '➖ Log' :
                             isSynchronous ? '✓ Sync' : comparison.type}
                          </span>
                          <span className={`alignment-original ${isDeletion ? 'deleted' : ''}`}>
                            {comparison.originalActivity || '-'}
                          </span>
                          <span className={`alignment-aligned ${isInsertion ? 'inserted' : ''}`}>
                            {comparison.alignedActivity || '-'}
                          </span>
                          <span className="alignment-difference">
                            {comparison.hasDifference ? (
                              isInsertion ? 'Model expects this event' :
                              isDeletion ? 'Log has unexpected event' :
                              'No difference'
                            ) : 'No difference'}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {alignmentTab === 'graph' && (
                <div className="alignment-graph">
                  <ProcessModelView 
                    modelVisualization={null}
                    traces={[trace]}
                    onConstraintClick={() => {}}
                  />
                </div>
              )}

              <div className="alignment-summary">
                <div className="summary-item">
                  <span className="summary-label">Synchronous Events:</span>
                  <span className="summary-value">
                    {trace.alignedEvents.filter(e => e.type === 'synchronous' || e.type === 'complete').length}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Model Insertions:</span>
                  <span className="summary-value insertion">
                    {trace.insertions}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Log Deletions:</span>
                  <span className="summary-value deletion">
                    {trace.deletions}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Alignment Cost:</span>
                  <span className="summary-value">
                    {trace.insertions + trace.deletions}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard; 