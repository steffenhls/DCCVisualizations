import React, { useMemo, useState } from 'react';
import { DashboardTrace } from '../types';

interface ProcessFlowMatrixProps {
  traces: DashboardTrace[];
  onActivityClick?: (activity: string) => void;
  showAllTransitions?: boolean; // New prop for variants
}

interface MatrixData {
  activities: string[];
  originalMatrix: number[][];
  alignedMatrix: number[][];
  maxFrequency: number;
  totalOriginalTransitions: number;
  totalAlignedTransitions: number;
  coveragePercentage: number;
  includedVariantCount: number;
  totalVariantCount: number;
}

const ProcessFlowMatrix: React.FC<ProcessFlowMatrixProps> = ({
  traces,
  onActivityClick,
  showAllTransitions = false
}) => {
  const [minPercentage, setMinPercentage] = useState(5); // Default 5%
  const [showPercentages, setShowPercentages] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'aligned' | 'both'>('both');

  // Compute matrix data from traces
  const matrixData = useMemo((): MatrixData => {
    // First, calculate variants and their frequencies
    const variantCounts = new Map<string, number>();
    
    traces.forEach(trace => {
      // Create variant key from activity sequence
      const activitySequence = trace.events.map(event => event.activity).join('->');
      const variantKey = activitySequence || 'empty';
      
      variantCounts.set(variantKey, (variantCounts.get(variantKey) || 0) + 1);
    });
    
    // Sort variants by frequency (most common first)
    const sortedVariants = Array.from(variantCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Calculate total traces
    const totalTraces = traces.length;
    
    // Determine which variants to include based on coverage percentage
    let cumulativeTraces = 0;
    const includedVariants = new Set<string>();
    
    for (const [variantKey, count] of sortedVariants) {
      cumulativeTraces += count;
      includedVariants.add(variantKey);
      
      // Stop when we reach the coverage percentage
      if ((cumulativeTraces / totalTraces) * 100 >= minPercentage) {
        break;
      }
    }
    
    // Filter traces to only include those from selected variants
    const filteredTraces = traces.filter(trace => {
      const activitySequence = trace.events.map(event => event.activity).join('->');
      const variantKey = activitySequence || 'empty';
      return includedVariants.has(variantKey);
    });
    
    const originalPairCounts = new Map<string, number>();
    const alignedPairCounts = new Map<string, number>();
    const activitySet = new Set<string>();
    let totalOriginalTransitions = 0;
    let totalAlignedTransitions = 0;
    
    filteredTraces.forEach(trace => {
      // Process original events
      const originalEvents = trace.events;
      for (let i = 0; i < originalEvents.length - 1; i++) {
        const from = originalEvents[i].activity;
        const to = originalEvents[i + 1].activity;
        activitySet.add(from);
        activitySet.add(to);
        const key = `${from}|||${to}`;
        originalPairCounts.set(key, (originalPairCounts.get(key) || 0) + 1);
        totalOriginalTransitions++;
      }
      // Add single-activity traces
      if (originalEvents.length === 1) {
        activitySet.add(originalEvents[0].activity);
      }

      // Process aligned events
      const alignedEvents = trace.alignedEvents;
      for (let i = 0; i < alignedEvents.length - 1; i++) {
        const from = alignedEvents[i].alignedActivity || alignedEvents[i].originalActivity;
        const to = alignedEvents[i + 1].alignedActivity || alignedEvents[i + 1].originalActivity;
        if (from && to) {
          activitySet.add(from);
          activitySet.add(to);
          const key = `${from}|||${to}`;
          alignedPairCounts.set(key, (alignedPairCounts.get(key) || 0) + 1);
          totalAlignedTransitions++;
        }
      }
      // Add single-activity aligned traces
      if (alignedEvents.length === 1) {
        const activity = alignedEvents[0].alignedActivity || alignedEvents[0].originalActivity;
        if (activity) {
          activitySet.add(activity);
        }
      }
    });

    // Sort activities alphabetically for consistent ordering
    const activities = Array.from(activitySet).sort();
    
    // Create matrices for both logs
    const originalMatrix: number[][] = activities.map(() => activities.map(() => 0));
    const alignedMatrix: number[][] = activities.map(() => activities.map(() => 0));
    
    // Fill original matrix with transition counts
    originalPairCounts.forEach((count, key) => {
      const [from, to] = key.split('|||');
      const fromIndex = activities.indexOf(from);
      const toIndex = activities.indexOf(to);
      if (fromIndex !== -1 && toIndex !== -1) {
        originalMatrix[fromIndex][toIndex] = count;
      }
    });

    // Fill aligned matrix with transition counts
    alignedPairCounts.forEach((count, key) => {
      const [from, to] = key.split('|||');
      const fromIndex = activities.indexOf(from);
      const toIndex = activities.indexOf(to);
      if (fromIndex !== -1 && toIndex !== -1) {
        alignedMatrix[fromIndex][toIndex] = count;
      }
    });

    // Calculate coverage info for display
    const coveredTraces = filteredTraces.length;
    const coveragePercentage = totalTraces > 0 ? (coveredTraces / totalTraces) * 100 : 0;
    const includedVariantCount = includedVariants.size;
    const totalVariantCount = variantCounts.size;

    return {
      activities,
      originalMatrix,
      alignedMatrix,
      maxFrequency: Math.max(...originalMatrix.flat(), ...alignedMatrix.flat()),
      totalOriginalTransitions,
      totalAlignedTransitions,
      coveragePercentage,
      includedVariantCount,
      totalVariantCount
    };
  }, [traces, minPercentage, showAllTransitions]);

  const getCellColor = (originalCount: number, alignedCount: number, maxCount: number) => {
    if (originalCount === 0 && alignedCount === 0) return '#f8f9fa';
    
    if (viewMode === 'original') {
      if (originalCount === 0) return '#f8f9fa';
      const intensity = originalCount / maxCount;
      const red = Math.round(231 * intensity);
      const green = Math.round(174 * (1 - intensity));
      const blue = Math.round(60 * intensity);
      return `rgb(${red}, ${green}, ${blue})`;
    }
    
    if (viewMode === 'aligned') {
      if (alignedCount === 0) return '#f8f9fa';
      const intensity = alignedCount / maxCount;
      const red = Math.round(231 * intensity);
      const green = Math.round(174 * (1 - intensity));
      const blue = Math.round(60 * intensity);
      return `rgb(${red}, ${green}, ${blue})`;
    }
    
    // Both mode - color coding
    if (originalCount > 0 && alignedCount > 0) {
      return '#6c757d'; // Gray - exists in both (conforming)
    } else if (originalCount > 0 && alignedCount === 0) {
      return '#e74c3c'; // Red - only in original
    } else if (originalCount === 0 && alignedCount > 0) {
      return '#3498db'; // Blue - only in aligned (model insertion)
    }
    
    return '#f8f9fa';
  };

  const getCellTextColor = (originalCount: number, alignedCount: number, maxCount: number) => {
    if (originalCount === 0 && alignedCount === 0) return '#6c757d';
    
    if (viewMode === 'original') {
      if (originalCount === 0) return '#6c757d';
      const intensity = originalCount / maxCount;
      return intensity > 0.5 ? 'white' : 'black';
    }
    
    if (viewMode === 'aligned') {
      if (alignedCount === 0) return '#6c757d';
      const intensity = alignedCount / maxCount;
      return intensity > 0.5 ? 'white' : 'black';
    }
    
    // Both mode
    if (originalCount > 0 && alignedCount > 0) {
      return 'white'; // Green background
    } else if (originalCount > 0 || alignedCount > 0) {
      return 'white'; // Red or orange background
    }
    
    return '#6c757d';
  };

  const formatCellValue = (originalCount: number, alignedCount: number) => {
    if (viewMode === 'original') {
      if (originalCount === 0) return '';
      if (showPercentages) {
        const percentage = ((originalCount / matrixData.totalOriginalTransitions) * 100).toFixed(1);
        return `${percentage}%`;
      }
      return originalCount.toString();
    }
    
    if (viewMode === 'aligned') {
      if (alignedCount === 0) return '';
      if (showPercentages) {
        const percentage = ((alignedCount / matrixData.totalAlignedTransitions) * 100).toFixed(1);
        return `${percentage}%`;
      }
      return alignedCount.toString();
    }
    
    // Both mode - show both values
    if (originalCount === 0 && alignedCount === 0) return '';
    
    let displayText = '';
    if (originalCount > 0) {
      displayText += showPercentages 
        ? `${((originalCount / matrixData.totalOriginalTransitions) * 100).toFixed(1)}%`
        : originalCount.toString();
    }
    
    if (alignedCount > 0) {
      if (displayText) displayText += '/';
      displayText += showPercentages 
        ? `${((alignedCount / matrixData.totalAlignedTransitions) * 100).toFixed(1)}%`
        : alignedCount.toString();
    }
    
    return displayText;
  };

  return (
    <div className="process-flow-matrix">
      <div style={{ 
        fontSize: '12px', 
        color: '#666', 
        marginBottom: '12px',
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e9ecef'
      }}>
        <strong>Process Flow Matrix:</strong> Heatmap showing transition frequencies between activities. 
        {viewMode === 'both' ? 'Gray indicates conforming behavior (present in both logs), red shows original-only deviations, blue shows model insertions.' :
         viewMode === 'original' ? 'Shows original event log transitions.' :
         'Shows aligned log transitions.'}
        Use the slider to filter by variant coverage (most common sequences first).
      </div>
      
      <div className="matrix-controls" style={{ marginBottom: 16, marginTop: 16 }}>
        {!showAllTransitions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ fontSize: '14px', fontWeight: 500, minWidth: '120px' }}>
              Variant Coverage: {minPercentage}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={minPercentage}
              onChange={(e) => setMinPercentage(Number(e.target.value))}
              style={{ flex: 1, maxWidth: '200px' }}
            />
            <span style={{ fontSize: '12px', color: '#666', minWidth: '120px' }}>
              {matrixData.includedVariantCount}/{matrixData.totalVariantCount} variants
            </span>
          </div>
        )}
        
        <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
          {minPercentage === 0 ? 'Showing all variants' : `Showing ${matrixData.coveragePercentage.toFixed(1)}% of traces (${matrixData.includedVariantCount} most common variants)`}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '12px', color: '#666' }}>View:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'original' | 'aligned' | 'both')}
              style={{ fontSize: '12px', padding: '2px 4px' }}
            >
              <option value="original">Original Log</option>
              <option value="aligned">Aligned Log</option>
              <option value="both">Both Logs</option>
            </select>
          </div>
          
          <label style={{ fontSize: '12px', color: '#666' }}>
            <input
              type="checkbox"
              checked={showPercentages}
              onChange={(e) => setShowPercentages(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            Show percentages
          </label>
          <span style={{ fontSize: '12px', color: '#666' }}>
            Max frequency: {matrixData.maxFrequency}
          </span>
        </div>
      </div>

      <div style={{ 
        overflow: 'auto', 
        maxHeight: '600px',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        backgroundColor: 'white'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `120px repeat(${matrixData.activities.length}, 80px)`,
          gap: '1px',
          backgroundColor: '#e9ecef',
          padding: '1px'
        }}>
          {/* Header row */}
          <div style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '8px', 
            fontWeight: 'bold',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #e9ecef'
          }}>
            To →
          </div>
          {matrixData.activities.map(activity => (
            <div
              key={`header-${activity}`}
              style={{
                backgroundColor: '#f8f9fa',
                padding: '8px',
                fontWeight: 'bold',
                fontSize: '10px',
                textAlign: 'center',
                border: '1px solid #e9ecef',
                cursor: onActivityClick ? 'pointer' : 'default',
                userSelect: 'none'
              }}
              onClick={() => onActivityClick?.(activity)}
              title={`Click to focus on ${activity}`}
            >
              {activity.length > 8 ? activity.substring(0, 8) + '...' : activity}
            </div>
          ))}

          {/* Matrix rows */}
          {matrixData.activities.map((fromActivity, rowIndex) => (
            <React.Fragment key={fromActivity}>
              {/* Row header */}
              <div
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '8px',
                  fontWeight: 'bold',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid #e9ecef',
                  cursor: onActivityClick ? 'pointer' : 'default',
                  userSelect: 'none'
                }}
                onClick={() => onActivityClick?.(fromActivity)}
                title={`Click to focus on ${fromActivity}`}
              >
                {fromActivity.length > 8 ? fromActivity.substring(0, 8) + '...' : fromActivity}
              </div>
              
              {/* Matrix cells */}
              {matrixData.originalMatrix[rowIndex].map((originalCount, colIndex) => {
                const toActivity = matrixData.activities[colIndex];
                const alignedCount = matrixData.alignedMatrix[rowIndex][colIndex];
                const isSelfLoop = fromActivity === toActivity;
                
                return (
                  <div
                    key={`${fromActivity}-${toActivity}`}
                    style={{
                      backgroundColor: getCellColor(originalCount, alignedCount, matrixData.maxFrequency),
                      padding: '8px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: getCellTextColor(originalCount, alignedCount, matrixData.maxFrequency),
                      border: '1px solid #e9ecef',
                      minHeight: '40px',
                      cursor: originalCount > 0 || alignedCount > 0 ? 'pointer' : 'default',
                      position: 'relative'
                    }}
                    title={`${fromActivity} → ${toActivity}: ${formatCellValue(originalCount, alignedCount)}${isSelfLoop ? ' (self-loop)' : ''}`}
                  >
                    {formatCellValue(originalCount, alignedCount)}
                    {isSelfLoop && (originalCount > 0 || alignedCount > 0) && (
                      <div style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#e74c3c',
                        border: '1px solid white'
                      }} />
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginTop: 12, 
        fontSize: '12px',
        color: '#666',
        justifyContent: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ 
            width: 20, 
            height: 20, 
            backgroundColor: '#f8f9fa',
            border: '1px solid #e9ecef'
          }}></div>
          <span>No transitions</span>
        </div>
        {viewMode === 'both' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                backgroundColor: '#6c757d',
                border: '1px solid #e9ecef'
              }}></div>
              <span>Conforming</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                backgroundColor: '#e74c3c',
                border: '1px solid #e9ecef'
              }}></div>
              <span>Original only</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                backgroundColor: '#3498db',
                border: '1px solid #e9ecef'
              }}></div>
              <span>Model insertion</span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                backgroundColor: 'rgb(231, 174, 60)',
                border: '1px solid #e9ecef'
              }}></div>
              <span>Low frequency</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 20, 
                height: 20, 
                backgroundColor: 'rgb(231, 87, 60)',
                border: '1px solid #e9ecef'
              }}></div>
              <span>High frequency</span>
            </div>
          </>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ 
            width: 6, 
            height: 6, 
            borderRadius: '50%',
            backgroundColor: '#e74c3c',
            border: '1px solid white'
          }}></div>
          <span>Self-loop</span>
        </div>
      </div>
    </div>
  );
};

export default ProcessFlowMatrix; 