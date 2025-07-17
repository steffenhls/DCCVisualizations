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
import './AnalysisDashboard.css';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'constraints' | 'traces' | 'resource' | 'time'>('overview');
  const [selectedTrace, setSelectedTrace] = useState<DashboardTrace | null>(null);
  const [traceFilter, setTraceFilter] = useState<TraceFilter>({});
  const [traceSort, setTraceSort] = useState<TraceSort>({ field: 'caseId', direction: 'asc' });
  const [showTraceDetail, setShowTraceDetail] = useState(false);
  const [initialConstraintFilter, setInitialConstraintFilter] = useState<string | null>(null);

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
          console.log('AnalysisDashboard - DECLARE model file:', {
            fileName: uploadedFiles.declarativeModel.name,
            fileSize: uploadedFiles.declarativeModel.size,
            contentLength: modelText.length,
            sampleContent: modelText.substring(0, 200)
          });
        }

        // Read analysis overview
        if (uploadedFiles.analysisOverview) {
          analysisOverviewText = await readFileAsText(uploadedFiles.analysisOverview);
          console.log('AnalysisDashboard - Analysis overview file:', {
            fileName: uploadedFiles.analysisOverview.name,
            fileSize: uploadedFiles.analysisOverview.size,
            contentLength: analysisOverviewText.length,
            sampleContent: analysisOverviewText.substring(0, 200)
          });
        }

        // Read analysis detail
        if (uploadedFiles.analysisDetail) {
          analysisDetailText = await readFileAsText(uploadedFiles.analysisDetail);
          console.log('AnalysisDashboard - Analysis detail file:', {
            fileName: uploadedFiles.analysisDetail.name,
            fileSize: uploadedFiles.analysisDetail.size,
            contentLength: analysisDetailText.length,
            sampleContent: analysisDetailText.substring(0, 200)
          });
        }

        // Read replay overview
        if (uploadedFiles.replayOverview) {
          replayOverviewText = await readFileAsText(uploadedFiles.replayOverview);
          console.log('AnalysisDashboard - Replay overview file:', {
            fileName: uploadedFiles.replayOverview.name,
            fileSize: uploadedFiles.replayOverview.size,
            contentLength: replayOverviewText.length,
            sampleContent: replayOverviewText.substring(0, 200)
          });
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

        console.log('AnalysisDashboard - Parsing results:', {
          constraints: constraints.length,
          analysisOverview: analysisOverview.length,
          analysisDetailTraces: analysisDetail.size,
          replayOverview: replayOverview.length,
          eventLog: eventLog.length,
          alignedLog: alignedLog.length
        });

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

        console.log('AnalysisDashboard - Processing results:', {
          dashboardConstraints: processed.dashboardConstraints.length,
          dashboardTraces: processed.dashboardTraces.length,
          overview: processed.overview
        });

        setOverview(processed.overview);
        setTraces(processed.dashboardTraces);
        setModelVisualization(processed.modelVisualization);
        setProcessedConstraints(processed.dashboardConstraints);

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
              onConstraintClick={handleConstraintClick}
              onNavigateToTraces={handleNavigateToTraces}
              onNavigateToConstraints={handleNavigateToConstraints}
              onNavigateToTracesWithFitnessSort={handleNavigateToTracesWithFitnessSort}
              onNavigateToConstraintsWithCompliance={handleNavigateToConstraintsWithCompliance}
              onNavigateToConstraintsWithQuality={handleNavigateToConstraintsWithQuality}
              onNavigateToConstraintsWithEfficiency={handleNavigateToConstraintsWithEfficiency}
              onNavigateToConstraintsWithCriticalPriority={handleNavigateToConstraintsWithCriticalPriority}
              onNavigateToConstraintsWithHighPriority={handleNavigateToConstraintsWithHighPriority}
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
  onConstraintClick?: (constraintId: string) => void;
  onNavigateToTraces?: () => void;
  onNavigateToConstraints?: () => void;
  onNavigateToTracesWithFitnessSort?: () => void;
  onNavigateToConstraintsWithCompliance?: () => void;
  onNavigateToConstraintsWithQuality?: () => void;
  onNavigateToConstraintsWithEfficiency?: () => void;
  onNavigateToConstraintsWithCriticalPriority?: () => void;
  onNavigateToConstraintsWithHighPriority?: () => void;
}> = ({ overview, modelVisualization, onConstraintClick, onNavigateToTraces, onNavigateToConstraints, onNavigateToTracesWithFitnessSort, onNavigateToConstraintsWithCompliance, onNavigateToConstraintsWithQuality, onNavigateToConstraintsWithEfficiency, onNavigateToConstraintsWithCriticalPriority, onNavigateToConstraintsWithHighPriority }) => {
  
  // Animated counter states
  const [animatedValues, setAnimatedValues] = useState({
    totalTraces: 0,
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

      {/* Model Visualization */}
      {modelVisualization && (
        <div className="model-visualization">
          <h3>Process Model</h3>
          <CytoscapeModel 
            modelVisualization={modelVisualization} 
            onConstraintClick={onConstraintClick}
          />
        </div>
      )}
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
}> = ({ constraints, modelVisualization, onConstraintClick, initialFilter, onFilterSet, onNavigateToTracesWithVisibleConstraints }) => {
  const [constraintFilter, setConstraintFilter] = useState({
    priority: '',
    categories: [] as string[],
    minRate: '',
    maxRate: '',
    hasViolations: false,
    group: ''
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
      {/* Action Button */}
      <div className="constraints-action-bar">
        <button 
          className="show-traces-button"
          onClick={handleShowTracesForVisibleConstraints}
        >
          Show Traces for Visible Constraints ({filteredAndSortedConstraints().length})
        </button>
      </div>

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
              {constraint.tag && (
                <div className="tag-categories">
                  {constraint.tag.quality && (
                    <span className="category quality">Quality</span>
                  )}
                  {constraint.tag.efficiency && (
                    <span className="category efficiency">Efficiency</span>
                  )}
                  {constraint.tag.compliance && (
                    <span className="category compliance">Compliance</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
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
              <th>Case ID</th>
              <th>Fitness</th>
              <th>Violations</th>
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

// Trace Detail Modal Component
const TraceDetailModal: React.FC<{
  trace: DashboardTrace;
  onClose: () => void;
}> = ({ trace, onClose }) => {
  console.log('TraceDetailModal - Trace data:', {
    caseId: trace.caseId,
    eventsCount: trace.events.length,
    events: trace.events,
    alignedEventsCount: trace.alignedEvents.length,
    alignedEvents: trace.alignedEvents
  });

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
                  <span className="stat-value violated">{trace.constraintDetails.filter(d => d.totalViolations > 0 || d.totalVacuousViolations > 0).length}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Fulfilled:</span>
                  <span className="stat-value fulfilled">{trace.constraintDetails.filter(d => d.totalFulfilments > 0 || d.totalVacuousFulfilments > 0).length}</span>
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
                      <th>Vacuous Fulfilments</th>
                      <th>Vacuous Violations</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trace.constraintDetails.map((detail, index) => {
                      const hasViolations = detail.totalViolations > 0 || detail.totalVacuousViolations > 0;
                      const hasFulfilments = detail.totalFulfilments > 0 || detail.totalVacuousFulfilments > 0;
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
                          <td className="vacuous-fulfilments-cell">
                            {detail.totalVacuousFulfilments}
                          </td>
                          <td className="vacuous-violations-cell">
                            {detail.totalVacuousViolations}
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

          <div className="trace-events">
            <h3>Events</h3>
            {trace.events.length > 0 ? (
              <div className="events-timeline">
                {trace.events.map((event, index) => (
                  <div key={event.id} className="event-item">
                    <span className="event-position">{index + 1}</span>
                    <span className="event-activity">{event.activity}</span>
                    <span className="event-timestamp">{new Date(event.timestamp).toLocaleString()}</span>
                    {event.resource && (
                      <span className="event-resource">{event.resource}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center', color: '#6c757d' }}>
                <p>No events found for this trace.</p>
                <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  This could be because:
                </p>
                <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '0.5rem' }}>
                  <li>No event log file was uploaded</li>
                  <li>The case ID doesn't match between event log and analysis files</li>
                  <li>The event log file format is not supported</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard; 