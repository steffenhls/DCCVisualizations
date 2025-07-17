import React, { useMemo } from 'react';
import { DashboardTrace, DashboardConstraint } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label, Legend } from 'recharts';

interface ResourceViewProps {
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
        const violationCount = detail.totalViolations;
        
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
          });
        }
      });
    }
  });
  
  return violationData;
}

// Resource View Component
const ResourceView: React.FC<ResourceViewProps> = ({ traces, constraints }) => {
  // Extract comprehensive violation data
  const violationData = useMemo(() => extractViolationData(traces, constraints), [traces, constraints]);

  // Activity-Resource heatmap data (only for activities with violations)
  const activityResourceHeatmap = useMemo(() => {
    // Get unique activities and resources from violation data (not from all events)
    const activities = Array.from(new Set(violationData.map(v => v.activity)));
    const resources = Array.from(new Set(violationData.map(v => v.resource || 'Unassigned')));
    
    // Build matrix: activity (y) x resource (x) - only count violation events
    const matrix: number[][] = activities.map(() => resources.map(() => 0));
    
    // Count only events that are directly involved in violations
    violationData.forEach(violation => {
      const y = activities.indexOf(violation.activity);
      const x = resources.indexOf(violation.resource || 'Unassigned');
      if (y !== -1 && x !== -1) matrix[y][x]++;
    });
    
    // Find max for color scaling
    const max = Math.max(1, ...matrix.flat());
    return { activities, resources, matrix, max };
  }, [violationData]);

  // Resource violation analysis
  const resourceViolations = useMemo(() => {
    const resourceViolations = new Map<string, {
      resource: string;
      violations: number;
      uniqueTraces: Set<string>;
      uniqueActivities: Set<string>;
      activities: Set<string>;
    }>();

    // Use violation data to build resource statistics
    violationData.forEach(violation => {
      const resource = violation.resource || 'Unassigned';
      
      if (!resourceViolations.has(resource)) {
        resourceViolations.set(resource, {
          resource,
          violations: 0,
          uniqueTraces: new Set(),
          uniqueActivities: new Set(),
          activities: new Set()
        });
      }
      
      const resourceStats = resourceViolations.get(resource)!;
      resourceStats.violations += 1; // Each violation entry represents one violation
      resourceStats.uniqueTraces.add(violation.traceId);
      resourceStats.uniqueActivities.add(violation.activity);
      resourceStats.activities.add(violation.activity);
    });
    
    // Convert to array and sort by violations
    return Array.from(resourceViolations.values())
      .map(stats => ({
        resource: stats.resource,
        violations: stats.violations,
        uniqueTraces: stats.uniqueTraces.size,
        uniqueActivities: stats.uniqueActivities.size,
        activities: Array.from(stats.activities)
      }))
      .sort((a, b) => b.violations - a.violations);
  }, [violationData]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalResources = resourceViolations.length;
    const totalViolations = resourceViolations.reduce((sum, r) => sum + r.violations, 0);
    const totalTraces = traces.length;
    const tracesWithViolations = traces.filter(trace => trace.violations > 0).length;
    
    return {
      totalResources,
      totalViolations,
      totalTraces,
      tracesWithViolations
    };
  }, [resourceViolations, traces]);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Resource Data Summary</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          Key metrics for resource-related violations.
        </div>
        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Resources</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e74c3c' }}>{resourceViolations.length}</p>
            </div>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Total Violations</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>{resourceViolations.reduce((sum, r) => sum + r.violations, 0)}</p>
            </div>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Activities Involved</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f39c12' }}>{new Set(resourceViolations.flatMap(r => r.activities)).size}</p>
            </div>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', textAlign: 'center' }}>
              <h4>Traces Affected</h4>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>{traces.filter(trace => trace.violations > 0).length}</p>
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Resource Violation Analysis</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          Violations, unique traces, and activities per resource.
        </div>
        <div style={{ height: 400, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {resourceViolations.length === 0 ? (
            <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No resource violation data available.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={resourceViolations} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="resource" angle={-45} textAnchor="end">
                  <Label value="Resource" offset={20} position="bottom" />
                </XAxis>
                <YAxis allowDecimals={false} label={{ value: 'Number of Violations', angle: -90, position: 'insideLeft', offset: 10 }} />
                <Tooltip formatter={(value: any, name: string) => {
                  const labels: Record<string, string> = {
                    'violations': 'Violations',
                    'uniqueTraces': 'Unique Traces', 
                    'uniqueActivities': 'Unique Activities'
                  };
                  return [value, labels[name] || name];
                }} />
                <Legend verticalAlign="top" align="center" wrapperStyle={{ paddingBottom: 10 }} />
                <Bar dataKey="violations" fill="#e74c3c" name="Violations" />
                <Bar dataKey="uniqueTraces" fill="#3498db" name="Unique Traces" />
                <Bar dataKey="uniqueActivities" fill="#f39c12" name="Unique Activities" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: 4 }}>Activity-Resource Event Heatmap</h3>
        <div style={{ color: '#888', fontSize: '0.98rem', marginBottom: 12 }}>
          Distribution of events by activity and resource (only activities with violations).
        </div>
        <div style={{ height: 400, background: '#f8f9fa', borderRadius: 8, padding: 16 }}>
          {activityResourceHeatmap.activities.length === 0 || activityResourceHeatmap.resources.length === 0 ? (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
              No activity-resource data available.
            </div>
          ) : (
            <div style={{ width: '100%', height: 360, position: 'relative', display: 'grid',
              gridTemplateColumns: `110px repeat(${activityResourceHeatmap.resources.length}, 1fr)`,
              gridTemplateRows: `repeat(${activityResourceHeatmap.activities.length}, 1fr) 28px 32px`,
              background: '#e9ecef', borderRadius: 8 }}>
              {/* Y-axis labels (activities) */}
              {activityResourceHeatmap.activities.map((activity, i) => (
                <div key={activity} style={{
                  gridColumn: 1,
                  gridRow: i + 1,
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#2c3e50',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '10px',
                  background: '#f8f9fa',
                  borderRight: '1px solid #e9ecef',
                  borderBottom: '1px solid #e9ecef',
                  borderTopLeftRadius: i === 0 ? 8 : 0,
                  borderBottomLeftRadius: i === activityResourceHeatmap.activities.length - 1 ? 8 : 0
                }}>
                  {activity}
                </div>
              ))}
              {/* Heatmap grid */}
              {activityResourceHeatmap.matrix.flatMap((row, y) =>
                row.map((count, x) => {
                  const intensity = count / activityResourceHeatmap.max;
                  const red = Math.round(231 * intensity);
                  const green = Math.round(174 * (1 - intensity));
                  const blue = Math.round(60 * intensity);
                  return (
                    <div
                      key={`${y}-${x}`}
                      style={{
                        gridColumn: x + 2,
                        gridRow: y + 1,
                        background: count === 0
                          ? '#27ae60'
                          : `rgb(${red}, ${green}, ${blue})`,
                        border: '1px solid #fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        color: intensity > 0.5 ? 'white' : 'black',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        aspectRatio: '1',
                        minHeight: '30px'
                      }}
                      title={`Activity: ${activityResourceHeatmap.activities[y]}\nResource: ${activityResourceHeatmap.resources[x]}\nCount: ${count}`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })
              )}
              {/* X-axis labels (resources) */}
              {activityResourceHeatmap.resources.map((resource, i) => (
                <div key={resource} style={{
                  gridColumn: i + 2,
                  gridRow: activityResourceHeatmap.activities.length + 1,
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
                  borderTopRightRadius: i === activityResourceHeatmap.resources.length - 1 ? 8 : 0
                }}>
                  {resource}
                </div>
              ))}
              {/* X-axis main label */}
              <div style={{
                gridColumn: `2 / span ${activityResourceHeatmap.resources.length}`,
                gridRow: activityResourceHeatmap.activities.length + 2,
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
                Resource
              </div>
              {/* Background for bottom left corner */}
              <div style={{
                gridColumn: 1,
                gridRow: `${activityResourceHeatmap.activities.length + 1} / span 2`,
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

export default ResourceView; 