import React, { useMemo } from 'react';
import { DashboardTrace, DashboardConstraint } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label, Legend } from 'recharts';

interface TimeViewProps {
  traces: DashboardTrace[];
  constraints: DashboardConstraint[];
}

// Comprehensive violation data extraction
interface ViolationData {
  traceId: string;
  constraintId: string;
  constraintType: string;
  violationType: 'violation' | 'vac. violation';
  timestamp: string;
  relativeTimeMinutes: number; // Time from trace start
  resource?: string;
  activity: string;
  eventIndex: number; // Position in trace
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Helper to extract violation data from traces and constraints
function extractViolationData(traces: DashboardTrace[], constraints: DashboardConstraint[]): ViolationData[] {
  const violationData: ViolationData[] = [];
  
  // Create constraint lookup map
  const constraintMap = new Map<string, DashboardConstraint>();
  constraints.forEach(constraint => {
    constraintMap.set(constraint.id, constraint);
  });
  
  traces.forEach(trace => {
    if (!trace.events || trace.events.length === 0) return;
    
    // Sort events by timestamp to ensure proper ordering
    const sortedEvents = [...trace.events].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const traceStartTime = new Date(sortedEvents[0].timestamp).getTime();
    
    // Extract violations from constraint details
    if (trace.constraintDetails) {
      trace.constraintDetails.forEach(detail => {
        // Find violations in this constraint
        const violationCount = detail.totalViolations + detail.totalVacuousViolations;
        
        if (violationCount > 0) {
          const constraint = constraintMap.get(detail.constraintId);
          if (!constraint) return;
          
          // Find events that match the constraint activities
          const matchingEvents = sortedEvents.filter(event => 
            constraint.activities.includes(event.activity)
          );
          
          // For each violation, create a data point
          // Note: We don't have exact violation timestamps, so we'll use the event timestamps
          matchingEvents.forEach((event, index) => {
            const eventTime = new Date(event.timestamp).getTime();
            const relativeTimeMinutes = (eventTime - traceStartTime) / (1000 * 60);
            
            // Create violation data points
            if (detail.totalViolations > 0) {
              violationData.push({
                traceId: trace.caseId,
                constraintId: detail.constraintId,
                constraintType: constraint.type,
                violationType: 'violation',
                timestamp: event.timestamp,
                relativeTimeMinutes,
                resource: event.resource,
                activity: event.activity,
                eventIndex: sortedEvents.findIndex(e => e.id === event.id),
                severity: constraint.severity
              });
            }
            
            if (detail.totalVacuousViolations > 0) {
              violationData.push({
                traceId: trace.caseId,
                constraintId: detail.constraintId,
                constraintType: constraint.type,
                violationType: 'vac. violation',
                timestamp: event.timestamp,
                relativeTimeMinutes,
                resource: event.resource,
                activity: event.activity,
                eventIndex: sortedEvents.findIndex(e => e.id === event.id),
                severity: constraint.severity
              });
            }
          });
        }
      });
    }
  });
  
  return violationData;
}

// Helper to parse ISO timestamps and compute duration in minutes
function getTraceDurationMinutes(trace: DashboardTrace): number | null {
  if (!trace.events || trace.events.length < 2) return null;
  // Sort events by timestamp (ascending)
  const sortedEvents = [...trace.events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const first = new Date(sortedEvents[0].timestamp).getTime();
  const last = new Date(sortedEvents[sortedEvents.length - 1].timestamp).getTime();
  if (isNaN(first) || isNaN(last)) return null;
  return (last - first) / 60000; // minutes
}

const BIN_SIZE = 60 * 24; // 1 day in minutes
const MAX_BINS = 20;

// Time View Component
const TimeView: React.FC<TimeViewProps> = ({ traces, constraints }) => {
  // Extract comprehensive violation data
  const violationData = useMemo(() => extractViolationData(traces, constraints), [traces, constraints]);
  
  // Compute histogram data (conformant vs non-conformant)
  const histogramData = useMemo(() => {
    const durations = traces
      .map(trace => {
        const duration = getTraceDurationMinutes(trace);
        if (duration === null || !isFinite(duration) || duration < 0) return null;
        return {
          duration,
          isConformant: (trace.violations + trace.vacuousViolations) === 0
        };
      })
      .filter((d): d is { duration: number; isConformant: boolean } => d !== null);
    if (durations.length === 0) return [];
    
    const max = Math.max(...durations.map(d => d.duration));
    const binSize = BIN_SIZE; // 1 day in minutes
    const binCount = Math.min(MAX_BINS, Math.ceil(max / binSize));
    
    // Create bins with proper labels
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: i === binCount - 1 && max > binCount * binSize 
        ? `${i * binSize / 1440}+ days` // Last bin shows "+" for overflow
        : `${i * binSize / 1440}–${(i + 1) * binSize / 1440} days`,
      conformant: 0,
      nonconformant: 0
    }));
    
    durations.forEach(({ duration, isConformant }) => {
      const binIdx = Math.min(Math.floor(duration / binSize), binCount - 1);
      if (isConformant) {
        bins[binIdx].conformant++;
      } else {
        bins[binIdx].nonconformant++;
      }
    });
    
    return bins;
  }, [traces]);

  // Heatmap data for violation timing
  const heatmapData = useMemo(() => {
    if (violationData.length === 0) return { cells: [], timeUnit: 'days', binSizeMinutes: 1440, maxTimeMinutes: 0, timeBins: 0 };
    
    // Use same bins as Trace Duration Distribution (1 day = 1440 minutes)
    const maxTimeMinutes = Math.max(...violationData.map(v => v.relativeTimeMinutes));
    const binSizeMinutes = 1440; // 1 day in minutes
    const timeBins = Math.min(20, Math.ceil(maxTimeMinutes / binSizeMinutes)); // Max 20 bins, 1 day each
    const timeUnit = 'days';
    
    // Get unique constraints
    const constraints = Array.from(new Set(violationData.map(v => v.constraintId)));
    
    // Create heatmap data structure
    const heatmapCells: Array<{
      constraintId: string;
      timeBin: number;
      timeRange: string;
      violationCount: number;
      x: number;
      y: number;
      maxViolations: number;
    }> = [];
    
    // Find max violations for color scaling
    const maxViolations = Math.max(...violationData.map(v => 
      violationData.filter(v2 => 
        v2.constraintId === v.constraintId && 
        Math.floor(v2.relativeTimeMinutes / binSizeMinutes) === Math.floor(v.relativeTimeMinutes / binSizeMinutes)
      ).length
    ));
    
    constraints.forEach((constraintId, yIndex) => {
      for (let i = 0; i < timeBins; i++) {
        const startTime = i * binSizeMinutes;
        const endTime = (i + 1) * binSizeMinutes;
        
        // Create proper time range labels with overflow indication
        const timeRange = i === timeBins - 1 && maxTimeMinutes > timeBins * binSizeMinutes
          ? `${i}+ days` // Last bin shows "+" for overflow
          : `${i}–${i + 1} days`;
        
        // Count violations in this time bin for this constraint
        const violationsInBin = violationData.filter(v => 
          v.constraintId === constraintId && 
          v.relativeTimeMinutes >= startTime && 
          (i === timeBins - 1 && maxTimeMinutes > timeBins * binSizeMinutes
            ? v.relativeTimeMinutes >= startTime // Last bin includes all remaining violations
            : v.relativeTimeMinutes < endTime)
        ).length;
        
        heatmapCells.push({
          constraintId,
          timeBin: i,
          timeRange,
          violationCount: violationsInBin,
          x: i,
          y: yIndex,
          maxViolations
        });
      }
    });
    
    return { cells: heatmapCells, timeUnit, binSizeMinutes, maxTimeMinutes, timeBins };
  }, [violationData]);

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Time Data Summary</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          Key metrics for time-related conformance.
        </div>
        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Total Violations</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e74c3c' }}>{violationData.length}</p>
            </div>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Traces with Violations</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>{new Set(violationData.map(v => v.traceId)).size}</p>
            </div>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Constraints Violated</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>{new Set(violationData.map(v => v.constraintId)).size}</p>
            </div>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Time Range (Days)</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{Math.ceil(Math.max(...violationData.map(v => v.relativeTimeMinutes)) / 1440)}</p>
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Trace Duration Distribution</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          Histogram of trace durations, split by conformance.
        </div>
        <div style={{ height: 400, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {histogramData.length === 0 ? (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No trace duration data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bin" angle={-20} textAnchor="end">
                  <Label value="Trace Duration (days)" offset={20} position="bottom" />
                </XAxis>
                <YAxis allowDecimals={false} label={{ value: 'Number of Traces', angle: -90, position: 'insideLeft', offset: 10 }} />
                <Tooltip formatter={(value: any, name: string) => [value, name === 'conformant' ? 'Conformant' : 'Non-conformant']} />
                <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: 10 }} />
                <Bar dataKey="conformant" fill="#27ae60" name="Conformant" />
                <Bar dataKey="nonconformant" fill="#e74c3c" name="Non-conformant" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Violation Timing Heatmap</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          When violations occur, by constraint and time bin.
        </div>
        <div style={{ height: 650, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {heatmapData.cells?.length === 0 ? (
            <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No violation timing data available.
            </div>
          ) : (
            <div style={{ width: '100%', height: 480, position: 'relative', display: 'grid',
              gridTemplateColumns: `170px repeat(${heatmapData.timeBins}, 1fr)`,
              gridTemplateRows: `repeat(${Array.from(new Set(violationData.map(v => v.constraintId))).length}, 1fr) 28px 32px`,
              background: '#e9ecef', borderRadius: 8, marginTop: 24 }}>
              {/* Y-axis labels (constraint IDs) */}
              {Array.from(new Set(violationData.map(v => v.constraintId))).map((constraintId, index) => (
                <div key={constraintId} style={{
                  gridColumn: 1,
                  gridRow: index + 1,
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  paddingLeft: '10px',
                  background: '#f8f9fa',
                  borderRight: '1px solid #e9ecef',
                  borderBottom: '1px solid #e9ecef',
                  borderTopLeftRadius: index === 0 ? 8 : 0,
                  borderBottomLeftRadius: index === Array.from(new Set(violationData.map(v => v.constraintId))).length - 1 ? 8 : 0
                }}>
                  {constraintId}
                </div>
              ))}
              
              {/* Heatmap grid */}
              {heatmapData.cells.map((cell, index) => {
                // Color gradient from green (0) to red (max)
                const intensity = cell.maxViolations > 0 ? cell.violationCount / cell.maxViolations : 0;
                const red = Math.round(231 * intensity); // 231 is the red component of #e74c3c
                const green = Math.round(174 * (1 - intensity)); // 174 is the green component of #27ae60
                const blue = Math.round(60 * intensity); // 60 is the blue component of #e74c3c
                
                return (
                  <div
                    key={index}
                    style={{
                      gridColumn: cell.x + 2,
                      gridRow: cell.y + 1,
                      background: cell.violationCount === 0 
                        ? '#27ae60' // Green for no violations
                        : `rgb(${red}, ${green}, ${blue})`,
                      border: '1px solid #fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      color: intensity > 0.5 ? 'white' : 'black',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      aspectRatio: '1', // Make cells square
                      minHeight: '40px'
                    }}
                    title={`${cell.constraintId}: ${cell.violationCount} violations at ${cell.timeRange}`}
                  >
                    {cell.violationCount > 0 ? cell.violationCount : ''}
                  </div>
                );
              })}
              
              {/* X-axis labels */}
              {Array.from({ length: heatmapData.timeBins }, (_, i) => {
                const isLastBin = i === heatmapData.timeBins - 1;
                const hasOverflow = heatmapData.maxTimeMinutes > heatmapData.timeBins * heatmapData.binSizeMinutes;
                const label = isLastBin && hasOverflow ? `${i}+` : `${i + 1}`;
                
                return (
                  <div key={i} style={{
                    gridColumn: i + 2,
                    gridRow: Array.from(new Set(violationData.map(v => v.constraintId))).length + 1,
                    fontSize: '11px',
                    fontWeight: 'bold',
                    color: '#2c3e50',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    background: '#f8f9fa',
                    borderTop: '1px solid #e9ecef',
                    borderLeft: '1px solid #e9ecef',
                    borderTopRightRadius: i === heatmapData.timeBins - 1 ? 8 : 0
                  }}>
                    {label}
                  </div>
                );
              })}
              
              {/* X-axis main label */}
              <div style={{
                gridColumn: `2 / span ${heatmapData.timeBins}`,
                gridRow: Array.from(new Set(violationData.map(v => v.constraintId))).length + 2,
                textAlign: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#2c3e50',
                background: '#f8f9fa',
                borderBottomRightRadius: 8,
                borderBottomLeftRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}>
                Time in Days
              </div>
              
              {/* Background for bottom left corner */}
              <div style={{
                gridColumn: 1,
                gridRow: `${Array.from(new Set(violationData.map(v => v.constraintId))).length + 1} / span 2`,
                background: '#f8f9fa',
                borderBottomLeftRadius: 8
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeView; 