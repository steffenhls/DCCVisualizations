import React, { useMemo, useState } from 'react';
import { DashboardTrace, DashboardConstraint } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label, Legend } from 'recharts';
import './TimeView.css';

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
        const constraint = constraintMap.get(detail.constraintId);
        if (!constraint) return;
        
        // Process each result type to find actual violations
        detail.resultTypes.forEach(resultType => {
          // Parse detailed result type that includes activity information
          const parts = resultType.split(':');
          const baseResultType = parts[0]; // 'violation', 'fulfillment', etc.
          const activityName = parts.length > 1 ? parts[1] : '';
          const activityIndex = parts.length > 2 ? parseInt(parts[2]) : -1;
          
          // Only process violations
          if (baseResultType === 'violation' || baseResultType === 'vac. violation') {
            // If we have specific activity information, use it
            if (activityName && activityIndex >= 0) {
              // Find the specific event that violated the constraint
              const violatingEvent = sortedEvents.find((event, index) => 
                event.activity === activityName && index === activityIndex
              );
              
              if (violatingEvent) {
                const eventTime = new Date(violatingEvent.timestamp).getTime();
                const relativeTimeMinutes = (eventTime - traceStartTime) / (1000 * 60);
                
                violationData.push({
                  traceId: trace.caseId,
                  constraintId: detail.constraintId,
                  constraintType: constraint.type,
                  violationType: baseResultType as 'violation' | 'vac. violation',
                  timestamp: violatingEvent.timestamp,
                  relativeTimeMinutes,
                  resource: violatingEvent.resource,
                  activity: violatingEvent.activity,
                  eventIndex: sortedEvents.findIndex(e => e.id === violatingEvent.id),
                  severity: constraint.severity
                });
              }
            } else {
              // Fallback: if no specific activity info, use all matching events
              // This should rarely happen with the updated parsing
              const matchingEvents = sortedEvents.filter(event => 
                constraint.activities.includes(event.activity)
              );
              
              matchingEvents.forEach((event) => {
                const eventTime = new Date(event.timestamp).getTime();
                const relativeTimeMinutes = (eventTime - traceStartTime) / (1000 * 60);
                
                violationData.push({
                  traceId: trace.caseId,
                  constraintId: detail.constraintId,
                  constraintType: constraint.type,
                  violationType: baseResultType as 'violation' | 'vac. violation',
                  timestamp: event.timestamp,
                  relativeTimeMinutes,
                  resource: event.resource,
                  activity: event.activity,
                  eventIndex: sortedEvents.findIndex(e => e.id === event.id),
                  severity: constraint.severity
                });
              });
            }
          }
        });
      });
    }
  });
  
  return violationData;
}

function parseTimeConstraint(constraintId: string): { base: string; time: string } {
  const match = constraintId.match(/^(.*?)\[(\d+,\s*\d+,\s*\w+)\]$/);
  if (match) {
    const timeParts = match[2].split(',');
    const unit = timeParts[2].trim() === 'm' ? 'min' : timeParts[2].trim();
    return {
      base: match[1],
      time: `${timeParts[0]}-${timeParts[1]}${unit}`
    };
  }
  return { base: constraintId, time: '-' };
}

// Time View Component
const TimeView: React.FC<TimeViewProps> = ({ traces, constraints }) => {
  // Binning state for Trace Duration chart
  const [minDuration, setMinDuration] = useState(0);
  const [maxDuration, setMaxDuration] = useState(20);
  const [binSize, setBinSize] = useState(1);
  const [timeUnit, setTimeUnit] = useState<'days' | 'hours' | 'minutes'>('days');

  // Binning state for Heatmap
  const [heatmapTimeUnit, setHeatmapTimeUnit] = useState<'days' | 'hours' | 'minutes'>('days');
  const [heatmapBinSize, setHeatmapBinSize] = useState(1);

  // Extract comprehensive violation data
  const violationData = useMemo(() => extractViolationData(traces, constraints), [traces, constraints]);

  // Calculate trace duration distribution
  const traceDurationData = useMemo(() => {
    const unitMultiplier = timeUnit === 'days' ? 1 : timeUnit === 'hours' ? 24 : 1440;
    
    const durations = traces.map(trace => {
      if (trace.events.length === 0) return null;
      
      // Sort events by timestamp
      const sortedEvents = [...trace.events].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      const startTime = new Date(sortedEvents[0].timestamp);
      const endTime = new Date(sortedEvents[sortedEvents.length - 1].timestamp);
      const durationDays = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60 * 24);
      
      return {
        duration: durationDays * unitMultiplier,
        isConformant: trace.violations === 0
      };
    }).filter(Boolean) as { duration: number; isConformant: boolean }[];
    
    // Bin durations based on UI controls
    const bins: { [key: string]: { conformant: number; nonConformant: number } } = {};
    const numBins = Math.ceil((maxDuration - minDuration) / binSize);

    for (let i = 0; i < numBins; i++) {
      const binStart = minDuration + i * binSize;
      const binEnd = binStart + binSize;
      const binLabel = `${binStart}-${binEnd}`;
      bins[binLabel] = { conformant: 0, nonConformant: 0 };
    }
    
    durations.forEach(({ duration, isConformant }) => {
      if (duration >= minDuration && duration < maxDuration) {
        const binIndex = Math.floor((duration - minDuration) / binSize);
        const binStart = minDuration + binIndex * binSize;
        const binEnd = binStart + binSize;
        const binLabel = `${binStart}-${binEnd}`;
        if (bins[binLabel]) {
          if (isConformant) {
            bins[binLabel].conformant++;
          } else {
            bins[binLabel].nonConformant++;
          }
        }
      }
    });
    
    return Object.entries(bins).map(([dayLabel, counts]) => ({
      dayLabel,
      conformant: counts.conformant,
      nonConformant: counts.nonConformant
    }));
  }, [traces, minDuration, maxDuration, binSize, timeUnit]);

  // Heatmap data for violation timing
  const heatmapData = useMemo(() => {
    if (violationData.length === 0) return { cells: [], timeUnit: 'days', binSizeMinutes: 1440, maxTimeMinutes: 0, timeBins: 0 };
    
    const maxTimeMinutes = Math.max(0, ...violationData.map(v => v.relativeTimeMinutes));

    let binSizeMinutes: number;
    let timeUnitLabel: string = heatmapTimeUnit;
    let binUnitConversion = 1;

    switch (heatmapTimeUnit) {
      case 'hours':
        binSizeMinutes = heatmapBinSize * 60;
        binUnitConversion = 60;
        break;
      case 'minutes':
        binSizeMinutes = heatmapBinSize;
        binUnitConversion = 1; // Already in minutes
        timeUnitLabel = 'mins';
        break;
      case 'days':
      default:
        binSizeMinutes = heatmapBinSize * 1440;
        binUnitConversion = 1440;
        break;
    }

    // Prevent division by zero or negative bins
    if (binSizeMinutes <= 0) {
      binSizeMinutes = 1;
    }

    const timeBins = Math.min(20, Math.ceil(maxTimeMinutes / binSizeMinutes));
    
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
        
        const convertedStart = Math.floor(startTime / binUnitConversion);
        const convertedEnd = Math.ceil(endTime / binUnitConversion);
        
        // Create proper time range labels with overflow indication
        const timeRange = i === timeBins - 1 && maxTimeMinutes > timeBins * binSizeMinutes
          ? `${convertedStart}+ ${timeUnitLabel}`
          : `${convertedStart}–${convertedEnd} ${timeUnitLabel}`;
        
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
    
    return { cells: heatmapCells, timeUnit: timeUnitLabel, binSizeMinutes, maxTimeMinutes, timeBins, binUnitConversion };
  }, [violationData, heatmapTimeUnit, heatmapBinSize]);

  // Dotted chart data - all traces on absolute time
  const dottedChartData = useMemo(() => {
    if (traces.length === 0) return { traces: [], timeRange: { start: new Date(), end: new Date() } };
    
    // Find global time range
    let globalStart = new Date();
    let globalEnd = new Date(0);
    
    traces.forEach(trace => {
      if (trace.events && trace.events.length > 0) {
        const sortedEvents = [...trace.events].sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const traceStart = new Date(sortedEvents[0].timestamp);
        const traceEnd = new Date(sortedEvents[sortedEvents.length - 1].timestamp);
        
        if (traceStart < globalStart) globalStart = traceStart;
        if (traceEnd > globalEnd) globalEnd = traceEnd;
      }
    });
    
    // Create trace data for dotted chart
    const traceData = traces.map(trace => {
      if (!trace.events || trace.events.length === 0) return null;
      
      const sortedEvents = [...trace.events].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      // Find violations for this trace
      const traceViolations = violationData.filter(v => v.traceId === trace.caseId);
      
      return {
        traceId: trace.caseId,
        events: sortedEvents.map((event, index) => ({
          activity: event.activity,
          timestamp: new Date(event.timestamp),
          resource: event.resource,
          position: index,
          hasViolation: traceViolations.some(v => 
            v.activity === event.activity && 
            Math.abs(new Date(v.timestamp).getTime() - new Date(event.timestamp).getTime()) < 60000 // Within 1 minute
          )
        })),
        hasDeviations: trace.violations > 0,
        fitness: trace.fitness,
        violations: trace.violations
      };
    }).filter(Boolean);
    
    return {
      traces: traceData,
      timeRange: { start: globalStart, end: globalEnd }
    };
  }, [traces, violationData]);

  const timeConstraints = useMemo(() => 
    constraints.filter(c => c.isTimeConstraint),
    [constraints]
  );

  const longestTraceDurationDays = useMemo(() => {
    if (traces.length === 0) return 0;

    const durations = traces.map(trace => {
      if (!trace.events || trace.events.length < 2) return 0;
      const sortedEvents = [...trace.events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const first = new Date(sortedEvents[0].timestamp).getTime();
      const last = new Date(sortedEvents[sortedEvents.length - 1].timestamp).getTime();
      if (isNaN(first) || isNaN(last)) return 0;
      return (last - first) / (1000 * 60 * 60 * 24); // duration in days
    });

    return Math.ceil(Math.max(...durations));
  }, [traces]);

  return (
    <div>
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
              <h4>Latest Violation (Days)</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{Math.ceil(Math.max(0, ...violationData.map(v => v.relativeTimeMinutes)) / 1440)}</p>
            </div>
          </div>
        </div>
      </div>

      {timeConstraints.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: 4 }}>Time-Related Constraints Summary</h3>
          <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
            Violations for constraints with time windows.
          </div>
          <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #dee2e6' }}>Constraint</th>
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #dee2e6' }}>Time Window</th>
                  <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #dee2e6' }}>Violations</th>
                </tr>
              </thead>
              <tbody>
                {timeConstraints.map(constraint => {
                  const { base, time } = parseTimeConstraint(constraint.id);
                  return (
                    <tr key={constraint.id}>
                      <td style={{ padding: 8, borderBottom: '1px solid #e9ecef' }}>{base}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #e9ecef' }}>{time}</td>
                      <td style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e9ecef' }}>
                        {constraint.violationCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Trace Duration Distribution</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          Histogram of trace durations, split by conformance.
        </div>
        <div className="binning-controls">
          <div className="control-group">
            <label>Time Unit:</label>
            <select value={timeUnit} onChange={e => setTimeUnit(e.target.value as any)}>
              <option value="days">Days</option>
              <option value="hours">Hours</option>
              <option value="minutes">Minutes</option>
            </select>
          </div>
          <div className="control-group">
            <label>Min Duration ({timeUnit}):</label>
            <input type="number" value={minDuration} onChange={e => setMinDuration(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Max Duration ({timeUnit}):</label>
            <input type="number" value={maxDuration} onChange={e => setMaxDuration(Number(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Bin Size ({timeUnit}):</label>
            <input type="number" value={binSize} onChange={e => setBinSize(Number(e.target.value))} />
          </div>
        </div>
        <div style={{ height: 400, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {traceDurationData.length === 0 ? (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No trace duration data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={traceDurationData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayLabel" angle={-20} textAnchor="end">
                  <Label value={`Trace Duration (${timeUnit})`} offset={20} position="bottom" />
                </XAxis>
                <YAxis allowDecimals={false} label={{ value: 'Number of Traces', angle: -90, position: 'insideLeft', offset: 10 }} />
                <Tooltip formatter={(value: any, name: string) => [value, name === 'conformant' ? 'Conformant' : 'Non-conformant']} />
                <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: 10 }} />
                <Bar dataKey="conformant" fill="#27ae60" name="Conformant" />
                <Bar dataKey="nonConformant" fill="#e74c3c" name="Non-conformant" />
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
        <div className="binning-controls" style={{ justifyContent: 'flex-end', background: 'none', padding: '0 0 1rem 0' }}>
            <div className="control-group">
                <label>Time Unit:</label>
                <select value={heatmapTimeUnit} onChange={e => setHeatmapTimeUnit(e.target.value as any)}>
                    <option value="days">Days</option>
                    <option value="hours">Hours</option>
                    <option value="minutes">Minutes</option>
                </select>
            </div>
            <div className="control-group">
                <label>Bin Size ({heatmapTimeUnit}):</label>
                <input
                    type="number"
                    value={heatmapBinSize}
                    onChange={e => setHeatmapBinSize(Number(e.target.value))}
                    min="1"
                />
            </div>
        </div>
        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {heatmapData.cells?.length === 0 ? (
            <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No violation timing data available.
            </div>
          ) : (
            <div style={{ width: '100%', position: 'relative', display: 'grid',
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
                const binStart = Math.floor((i * heatmapData.binSizeMinutes) / (heatmapData.binUnitConversion || 1));
                const label = isLastBin && hasOverflow ? `${binStart}+` : `${binStart}`;
                
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
                Time Since Trace Start ({heatmapData.timeUnit})
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

      {/* Dotted Chart */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Trace Timeline (Dotted Chart)</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          All traces plotted on absolute time. Red dots indicate deviations/violations.
        </div>
        <div style={{ height: 1400, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {dottedChartData.traces.length === 0 ? (
            <div style={{ height: 560, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No trace data available.
            </div>
          ) : (
            <div style={{ width: '100%', height: 1380, position: 'relative', overflow: 'hidden' }}>
              <svg width="100%" height="100%">
                {/* Background */}
                <rect width="100%" height="100%" fill="#ffffff" />
                
                {/* Y-axis label */}
                <text 
                  x="4%" 
                  y="50%" 
                  textAnchor="middle" 
                  fontSize="12" 
                  fontWeight="bold"
                  fill="#2c3e50"
                  transform="rotate(-90, 2%, 50%)"
                >
                  Trace
                </text>
                
                {/* Grid lines */}
                {(() => {
                  const timeRange = dottedChartData.timeRange.end.getTime() - dottedChartData.timeRange.start.getTime();
                  const gridLines = 10;
                  const lines = [];
                  
                  for (let i = 0; i <= gridLines; i++) {
                    const x = (i / gridLines) * 85 + 10; // 10% margin left, 5% margin right
                    const time = new Date(dottedChartData.timeRange.start.getTime() + (timeRange * i / gridLines));
                    
                    lines.push(
                      <g key={`grid-${i}`}>
                        <line 
                          x1={`${x}%`} y1="5%" x2={`${x}%`} y2="95%" 
                          stroke="#e9ecef" strokeWidth="1" 
                        />
                        <text 
                          x={`${x}%`} y="98%" 
                          textAnchor="middle" 
                          fontSize="10" 
                          fill="#6c757d"
                        >
                          {time.toLocaleDateString()}
                        </text>
                      </g>
                    );
                  }
                  return lines;
                })()}
                
                {/* Traces */}
                {dottedChartData.traces.map((trace, traceIndex) => {
                  if (!trace) return null; // Skip null traces
                  
                  const y = (traceIndex / (dottedChartData.traces.length - 1)) * 80 + 10; // 10% margin top, 10% bottom
                  const timeRange = dottedChartData.timeRange.end.getTime() - dottedChartData.timeRange.start.getTime();
                  
                  return (
                    <g key={trace.traceId}>
                      {/* Events as dots */}
                      {trace.events.map((event, eventIndex) => {
                        const eventTime = event.timestamp.getTime();
                        const x = ((eventTime - dottedChartData.timeRange.start.getTime()) / timeRange) * 85 + 10; // 10% margin left
                        
                        return (
                          <g key={`${trace.traceId}-${eventIndex}`}>
                            {/* Event dot */}
                            <circle 
                              cx={`${x}%`} cy={`${y}%`}
                              r={event.hasViolation ? "2.5" : "2"}
                              fill={event.hasViolation ? "#e74c3c" : "#3498db"}
                              stroke={event.hasViolation ? "#c0392b" : "#2980b9"}
                              strokeWidth="1"
                            />
                            
                            {/* Tooltip data */}
                            <title>
                              {`Trace: ${trace.traceId}
Activity: ${event.activity}
Time: ${event.timestamp.toLocaleString()}
Resource: ${event.resource || 'N/A'}
${event.hasViolation ? '⚠️ Has Violation' : '✓ Normal'}`}
                            </title>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
                
                {/* Legend */}
                <g transform="translate(10, 10)">
                  <rect width="200" height="60" fill="white" stroke="#e9ecef" strokeWidth="1" rx="4" />
                  <text x="10" y="20" fontSize="12" fontWeight="bold" fill="#2c3e50">Legend</text>
                  <circle cx="15" cy="35" r="2" fill="#3498db" stroke="#2980b9" strokeWidth="1" />
                  <text x="25" y="40" fontSize="10" fill="#2c3e50">Normal Event</text>
                  <circle cx="15" cy="50" r="2.5" fill="#e74c3c" stroke="#c0392b" strokeWidth="1" />
                  <text x="25" y="55" fontSize="10" fill="#2c3e50">Violation</text>
                </g>
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeView;