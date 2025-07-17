import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ModelVisualization, DashboardTrace } from '../types';
import CytoscapeModel from './CytoscapeModel';
import cytoscape from 'cytoscape';

interface ProcessModelViewProps {
  modelVisualization: ModelVisualization | null;
  traces: DashboardTrace[];
  onConstraintClick?: (constraintId: string) => void;
}

const ProcessModelView: React.FC<ProcessModelViewProps> = ({
  modelVisualization,
  traces,
  onConstraintClick
}) => {
  const dfgContainerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [minPercentage, setMinPercentage] = useState(20); // Default 20%
  const [layoutType, setLayoutType] = useState<'grid' | 'cose' | 'circle' | 'concentric'>('cose');

  // Compute DFG data from traces
  const dfgData = useMemo(() => {
    const pairCounts = new Map<string, number>();
    const activitySet = new Set<string>();
    let totalTransitions = 0;
    
    traces.forEach(trace => {
      const events = trace.events;
      for (let i = 0; i < events.length - 1; i++) {
        const from = events[i].activity;
        const to = events[i + 1].activity;
        activitySet.add(from);
        activitySet.add(to);
        const key = `${from}|||${to}`;
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
        totalTransitions++;
      }
      // Add single-activity traces
      if (events.length === 1) {
        activitySet.add(events[0].activity);
      }
    });

    // Filter edges based on minimum percentage (inverse logic)
    const sortedPairs = Array.from(pairCounts.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by count descending
    
    const maxCount = sortedPairs.length > 0 ? sortedPairs[0][1] : 0;
    const thresholdCount = Math.ceil((minPercentage / 100) * maxCount);
    
    const filteredPairs = sortedPairs.filter(([key, count]) => {
      return count >= thresholdCount;
    });

    // Create constraint edges if model visualization is available
    const constraintEdges: any[] = [];
    if (modelVisualization) {
      modelVisualization.constraints.forEach(constraint => {
        const isSelfLoop = constraint.source === constraint.target;
        if (!isSelfLoop) { // Only add non-self-loop constraints
          constraintEdges.push({
            data: {
              id: `constraint-${constraint.id}`,
              source: constraint.source,
              target: constraint.target,
              violationCount: constraint.violationCount,
              isSelfLoop: isSelfLoop,
              edgeType: 'constraint',
              constraintId: constraint.constraint.id,
              label: constraint.constraint.type
            },
            group: 'edges' as const
          });
        }
      });
    }

    // Create nodes
    const nodes = Array.from(activitySet).map(activity => {
      // Check if this activity has self-loop constraints from the original model
      const selfLoopConstraints = modelVisualization?.constraints.filter(constraint => 
        constraint.source === activity && constraint.target === activity
      ) || [];
      
      const constraintTypes = selfLoopConstraints.map(constraint => constraint.constraint.type).join(', ');
      console.log(`Activity ${activity} has constraints:`, constraintTypes);
      
      const hasConstraints = selfLoopConstraints.length > 0;
      const label = hasConstraints ? `[${constraintTypes}]\n\n${activity}` : activity;
      
      // Calculate width based on content
      const baseWidth = 120;
      const constraintWidth = hasConstraints ? Math.max(baseWidth, constraintTypes.length * 8 + 40) : baseWidth;
      
      return {
        data: { 
          id: activity, 
          label: label,
          weight: 1,
          hasConstraints: hasConstraints,
          constraintTypes: constraintTypes,
          width: constraintWidth
        },
        group: 'nodes' as const
      };
    });

    // Create edges from filtered pairs (process flow)
    const flowEdges = filteredPairs.map(([key, count]) => {
      const [from, to] = key.split('|||');
      const percentage = ((count / totalTransitions) * 100).toFixed(1);
      const isSelfLoop = from === to;
      
      return {
        data: {
          id: `flow-${from}->${to}`,
          source: from,
          target: to,
          weight: count,
          isSelfLoop: isSelfLoop,
          edgeType: 'flow'
        },
        group: 'edges' as const
      };
    }).filter(edge => !edge.data.isSelfLoop);

    const allEdges = [...flowEdges, ...constraintEdges];

    return { nodes, edges: allEdges, totalTransitions, thresholdCount };
  }, [traces, minPercentage, layoutType, modelVisualization]);

  // Initialize Cytoscape DFG
  useEffect(() => {
    if (!dfgContainerRef.current || dfgData.nodes.length === 0) return;

    // Destroy previous instance
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
      } catch (error) {
        console.warn('Error destroying previous Cytoscape instance:', error);
      }
      cyRef.current = null;
    }

    // Create new Cytoscape instance with headless mode
    try {
      cyRef.current = cytoscape({
        container: dfgContainerRef.current,
        elements: {
          nodes: dfgData.nodes,
          edges: dfgData.edges
        },
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#667eea',
              'label': 'data(label)',
              'color': 'white',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'font-weight': 'bold',
              'width': '120px',
              'height': '60px',
              'border-color': '#2c3e50',
              'border-width': 2,
              'text-wrap': 'wrap',
              'text-max-width': '120px',
              'shape': 'roundrectangle'
            }
          },
          {
            selector: 'node[hasConstraints = true]',
            style: {
              'background-color': '#667eea',
              'height': '80px',
              'width': 'data(width)',
              'label': 'data(label)',
              'font-size': '10px',
              'text-wrap': 'wrap',
              'text-max-width': 'data(width)',
              'text-valign': 'center',
              'text-halign': 'center',
              'shape': 'roundrectangle',
              'border-style': 'solid',
              'border-width': '3px 3px 3px 3px',
              'border-color': '#2c3e50 #2c3e50 #e74c3c #2c3e50'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': '1px',
              'line-color': '#666666',
              'target-arrow-color': '#666666',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
              'curve-style': 'bezier',
              'edge-distances': 'intersection',
              'loop-direction': '0deg',
              'loop-sweep': '-45deg',
              'control-point-distances': [-20],
              'control-point-weights': [0.5]
            }
          },
          {
            selector: 'edge[edgeType = "constraint"]',
            style: {
              'width': '3px',
              'line-color': '#3498db', // Blue for constraints
              'target-arrow-color': '#3498db',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '10px',
              'font-weight': 'bold',
              'text-rotation': 'autorotate',
              'text-margin-y': -10,
              'text-background-color': 'white',
              'text-background-opacity': 0.8,
              'text-background-padding': '2px',
              'edge-distances': 'intersection',
              'loop-direction': '0deg',
              'loop-sweep': '-45deg',
              'control-point-distances': [20],
              'control-point-weights': [0.5]
            }
          }
        ],
        layout: {
          name: layoutType as any,
          animate: layoutType === 'cose' ? false : false, // Disable animation for stability
          nodeDimensionsIncludeLabels: true,
          fit: true,
          padding: 50,
          ...(layoutType === 'grid' && {
            rows: Math.ceil(Math.sqrt(dfgData.nodes.length))
          }),
          ...(layoutType === 'cose' && {
            animate: false, // Force disable animation
            animationDuration: 0, // No animation duration
            randomize: false,
            componentSpacing: 150, // Increased spacing
            nodeRepulsion: 400000,
            nodeOverlap: 20,
            idealEdgeLength: 300, // Increased ideal edge length
            edgeElasticity: 150, // Increased edge elasticity
            nestingFactor: 5,
            gravity: 80,
            numIter: 500, // Reduced iterations for stability
            initialTemp: 200,
            coolingFactor: 0.95,
            minTemp: 1.0
          }),
          ...(layoutType === 'circle' && {
            radius: 200,
            startAngle: 0,
            sweep: 360
          }),
          ...(layoutType === 'concentric' && {
            concentric: function(node: any) {
              return node.degree();
            },
            levelWidth: function() {
              return 2;
            }
          })
        },
        wheelSensitivity: 0.3,
        minZoom: 0.2,
        maxZoom: 3
      });

      // Add event listeners with error handling
      if (cyRef.current) {
        cyRef.current.on('tap', 'node', function(evt) {
          try {
            const node = evt.target;
            console.log('Clicked node:', node.id());
          } catch (error) {
            console.warn('Error handling node click:', error);
          }
        });

        cyRef.current.on('tap', 'edge', function(evt) {
          try {
            const edge = evt.target;
            const edgeType = edge.data('edgeType');
            if (edgeType === 'constraint' && onConstraintClick) {
              const constraintId = edge.data('constraintId');
              onConstraintClick(constraintId);
            } else {
              console.log('Clicked edge:', edge.id(), 'Weight:', edge.data('weight'));
            }
          } catch (error) {
            console.warn('Error handling edge click:', error);
          }
        });

        // Fit the graph to the container with error handling
        try {
          cyRef.current.fit();
        } catch (error) {
          console.warn('Error fitting graph:', error);
        }
      }
    } catch (error) {
      console.error('Error creating Cytoscape instance:', error);
    }

    // Cleanup function
    return () => {
      if (cyRef.current) {
        try {
          cyRef.current.destroy();
        } catch (error) {
          console.warn('Error destroying Cytoscape instance during cleanup:', error);
        }
        cyRef.current = null;
      }
    };
  }, [dfgData, layoutType, onConstraintClick]);

  return (
    <div className="process-model-view">
      <div className="model-visualization">
        <h3>Process Model</h3>
        <div style={{ 
          fontSize: '12px', 
          color: '#666', 
          marginBottom: '12px',
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #e9ecef'
        }}>
          <strong>Process Model Visualization:</strong> Shows the DECLARE constraints from your uploaded model. 
          Each arrow represents a constraint between activities. Click on arrows to see detailed constraint information. 
          Use the dropdown to change what values are displayed on the arrows (violations, activations, fulfillments, or violation rate).
        </div>
        {modelVisualization ? (
          <CytoscapeModel 
            modelVisualization={modelVisualization} 
            onConstraintClick={onConstraintClick}
          />
        ) : (
          <div className="no-model-message">
            <p>No process model visualization available.</p>
            <p>Please ensure a valid DECLARE model file was uploaded.</p>
          </div>
        )}
      </div>
      
      <div className="dfg-visualization" style={{ marginTop: 32 }}>
        <h3>Directly-Follows Graph (DFG)</h3>
        <div style={{ 
          fontSize: '12px', 
          color: '#666', 
          marginBottom: '12px',
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #e9ecef'
        }}>
          <strong>DFG Visualization:</strong> Shows the actual process flow from your event log (gray arrows) and DECLARE constraints (blue arrows). 
          Activities with constraints show constraint types in red headers. Use the slider to filter transitions by frequency. 
          Click on constraint arrows to see detailed information.
        </div>
        
        <div className="dfg-controls" style={{ marginBottom: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ fontSize: '14px', fontWeight: 500, minWidth: '120px' }}>
              Show Top: {minPercentage}%
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={minPercentage}
              onChange={(e) => setMinPercentage(Number(e.target.value))}
              style={{ flex: 1, maxWidth: '200px' }}
            />
            <span style={{ fontSize: '12px', color: '#666', minWidth: '80px' }}>
              {dfgData.edges.filter(e => e.data.edgeType === 'flow').length} edges
            </span>
          </div>
          
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            Showing transitions with at least {dfgData.thresholdCount} occurrences
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: 16, 
            marginTop: 8, 
            fontSize: '12px',
            color: '#666'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 12, 
                height: 1, 
                backgroundColor: '#666666' 
              }}></div>
              <span>Process Flow</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ 
                width: 12, 
                height: 3, 
                backgroundColor: '#3498db' 
              }}></div>
              <span>Constraints</span>
            </div>
          </div>
        </div>
        
        <div 
          ref={dfgContainerRef} 
          style={{ 
            height: 500, 
            background: '#f8f9fa', 
            borderRadius: 8, 
            border: '1px solid #e9ecef',
            marginTop: 16
          }}
        />
      </div>
    </div>
  );
};

export default ProcessModelView; 