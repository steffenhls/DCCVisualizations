import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ModelVisualization, DashboardTrace } from '../types';
import CytoscapeModel from './CytoscapeModel';
import ProcessFlowMatrix from './ProcessFlowMatrix';
import cytoscape from 'cytoscape';
// @ts-ignore
import klay from 'cytoscape-klay';

// Register the Klay layout
cytoscape.use(klay);


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
  const [minPercentage, setMinPercentage] = useState(0); // Default 0% - show all edges
  const [layoutType, setLayoutType] = useState<'klay'>('klay');
  const [visualizationType, setVisualizationType] = useState<'dfg' | 'matrix'>('dfg');

  // Compute DFG data from traces
  const dfgData = useMemo(() => {
    // First, calculate variants and their frequencies
    const variantCounts = new Map<string, number>();
    const variantTraces = new Map<string, DashboardTrace[]>();
    
    traces.forEach(trace => {
      // Create variant key from activity sequence
      const activitySequence = trace.events.map(event => event.activity).join('->');
      const variantKey = activitySequence || 'empty';
      
      variantCounts.set(variantKey, (variantCounts.get(variantKey) || 0) + 1);
      
      if (!variantTraces.has(variantKey)) {
        variantTraces.set(variantKey, []);
      }
      variantTraces.get(variantKey)!.push(trace);
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
      
      // Add START node connections to all first activities
      if (originalEvents.length > 0) {
        const firstActivity = originalEvents[0].activity;
        activitySet.add('START');
        activitySet.add(firstActivity);
        const key = `START|||${firstActivity}`;
        originalPairCounts.set(key, (originalPairCounts.get(key) || 0) + 1);
        totalOriginalTransitions++;
      }
      
      for (let i = 0; i < originalEvents.length - 1; i++) {
        const from = originalEvents[i].activity;
        const to = originalEvents[i + 1].activity;
        activitySet.add(from);
        activitySet.add(to);
        const key = `${from}|||${to}`;
        originalPairCounts.set(key, (originalPairCounts.get(key) || 0) + 1);
        totalOriginalTransitions++;
      }
      
      // Add END node at the end of each trace
      if (originalEvents.length > 0) {
        const lastActivity = originalEvents[originalEvents.length - 1].activity;
        activitySet.add(lastActivity);
        activitySet.add('END');
        const key = `${lastActivity}|||END`;
        originalPairCounts.set(key, (originalPairCounts.get(key) || 0) + 1);
        totalOriginalTransitions++;
      }
      
      // Add single-activity traces
      if (originalEvents.length === 1) {
        const activity = originalEvents[0].activity;
        activitySet.add(activity);
        // For single activity, connect START -> activity -> END
        const startKey = `START|||${activity}`;
        const endKey = `${activity}|||END`;
        originalPairCounts.set(startKey, (originalPairCounts.get(startKey) || 0) + 1);
        originalPairCounts.set(endKey, (originalPairCounts.get(endKey) || 0) + 1);
        totalOriginalTransitions += 2;
      }

      // Process aligned events
      const alignedEvents = trace.alignedEvents;
      
      // Add START node connections to all first aligned activities
      if (alignedEvents.length > 0) {
        const firstActivity = alignedEvents[0].alignedActivity || alignedEvents[0].originalActivity;
        if (firstActivity) {
          activitySet.add('START');
          activitySet.add(firstActivity);
          const key = `START|||${firstActivity}`;
          alignedPairCounts.set(key, (alignedPairCounts.get(key) || 0) + 1);
          totalAlignedTransitions++;
        }
      }
      
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
      
      // Add END node at the end of aligned trace
      if (alignedEvents.length > 0) {
        const lastActivity = alignedEvents[alignedEvents.length - 1].alignedActivity || alignedEvents[alignedEvents.length - 1].originalActivity;
        if (lastActivity) {
          activitySet.add(lastActivity);
          activitySet.add('END');
          const key = `${lastActivity}|||END`;
          alignedPairCounts.set(key, (alignedPairCounts.get(key) || 0) + 1);
          totalAlignedTransitions++;
        }
      }
      
      // Add single-activity aligned traces
      if (alignedEvents.length === 1) {
        const activity = alignedEvents[0].alignedActivity || alignedEvents[0].originalActivity;
        if (activity) {
          activitySet.add(activity);
          // For single activity, connect START -> activity -> END
          const startKey = `START|||${activity}`;
          const endKey = `${activity}|||END`;
          alignedPairCounts.set(startKey, (alignedPairCounts.get(startKey) || 0) + 1);
          alignedPairCounts.set(endKey, (alignedPairCounts.get(endKey) || 0) + 1);
          totalAlignedTransitions += 2;
        }
      }
    });

    // Get all pairs (no filtering by frequency since we're filtering by variant coverage)
    const allOriginalPairs = Array.from(originalPairCounts.entries());
    const allAlignedPairs = Array.from(alignedPairCounts.entries());
    
    // Calculate coverage info for display
    const coveredTraces = filteredTraces.length;
    const coveragePercentage = totalTraces > 0 ? (coveredTraces / totalTraces) * 100 : 0;
    const includedVariantCount = includedVariants.size;
    const totalVariantCount = variantCounts.size;
    
    // Create nodes
    const nodes = Array.from(activitySet).map(activity => {
      // Check if this activity has self-loop constraints from the original model
      const selfLoopConstraints = modelVisualization?.constraints.filter(constraint => 
        constraint.source === activity && constraint.target === activity
      ) || [];
      
      const constraintTypes = selfLoopConstraints.map(constraint => constraint.constraint.type).join(', ');
      
      const hasConstraints = selfLoopConstraints.length > 0;
      const label = activity; // Just show the activity name, no constraint info
      
      // Calculate width based on content
      const baseWidth = 200; // Updated to match new node width
      const constraintWidth = hasConstraints ? Math.max(baseWidth, constraintTypes.length * 8 + 40) : baseWidth;
      
      // Determine if activity exists in both logs
      const inOriginal = originalPairCounts.has(`${activity}|||${activity}`) || 
        Array.from(originalPairCounts.keys()).some(key => key.includes(activity));
      const inAligned = alignedPairCounts.has(`${activity}|||${activity}`) || 
        Array.from(alignedPairCounts.keys()).some(key => key.includes(activity));
      
      let nodeColor = '#667eea'; // Default blue
      if (activity === 'START') {
        nodeColor = '#27ae60'; // Green for START
      } else if (activity === 'END') {
        nodeColor = '#e74c3c'; // Red for END
      } else if (inOriginal && inAligned) {
        nodeColor = '#6c757d'; // Gray - exists in both (conforming)
      } else if (inOriginal && !inAligned) {
        nodeColor = '#e74c3c'; // Red - only in original
      } else if (!inOriginal && inAligned) {
        nodeColor = '#3498db'; // Blue - only in aligned (model insertion)
      }
      
      return {
        data: { 
          id: activity, 
          label: label,
          weight: 1,
          hasConstraints: hasConstraints,
          constraintTypes: constraintTypes,
          width: constraintWidth,
          inOriginal: inOriginal,
          inAligned: inAligned,
          color: nodeColor
        },
        group: 'nodes' as const
      };
    });

    // Create edges from filtered pairs (process flow)
    const flowEdges: any[] = [];
    
    // Add original log edges
    allOriginalPairs.forEach(([key, count]) => {
      const [from, to] = key.split('|||');
      const isSelfLoop = from === to;
      
      // Check if this transition exists in aligned log
      const alignedCount = alignedPairCounts.get(key) || 0;
      const inAligned = alignedCount > 0;
      
      let edgeColor = '#e74c3c'; // Red - only in original
      if (inAligned) {
        edgeColor = '#6c757d'; // Gray - exists in both (conforming)
      }
      
      flowEdges.push({
        data: {
          id: `original-${from}->${to}`,
          source: from,
          target: to,
          weight: count,
          isSelfLoop: isSelfLoop,
          edgeType: 'flow',
          logType: 'original',
          inAligned: inAligned,
          color: edgeColor
        },
        group: 'edges' as const
      });
    });

    // Add aligned-only edges
    allAlignedPairs.forEach(([key, count]) => {
      const [from, to] = key.split('|||');
      const isSelfLoop = from === to;
      
      // Check if this transition exists in original log
      const originalCount = originalPairCounts.get(key) || 0;
      const inOriginal = originalCount > 0;
      
      // Only add if it's not already added as an original edge
      if (!inOriginal) {
        flowEdges.push({
          data: {
            id: `aligned-${from}->${to}`,
            source: from,
            target: to,
            weight: count,
            isSelfLoop: isSelfLoop,
            edgeType: 'flow',
            logType: 'aligned',
            inOriginal: false,
            color: '#3498db' // Blue - only in aligned (model insertion)
          },
          group: 'edges' as const
        });
      }
    });

    // Only include flow edges, exclude constraint edges
    const allEdges = flowEdges.filter(edge => !edge.data.isSelfLoop);

    // Filter nodes to only include those that have edges
    const connectedNodes = new Set<string>();
    allEdges.forEach(edge => {
      connectedNodes.add(edge.data.source);
      connectedNodes.add(edge.data.target);
    });

    const filteredNodes = nodes.filter(node => connectedNodes.has(node.data.id));

    return { 
      nodes: filteredNodes, 
      edges: allEdges, 
      totalOriginalTransitions, 
      totalAlignedTransitions,
      coveragePercentage,
      includedVariantCount,
      totalVariantCount
    };
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
      console.log('Creating Cytoscape instance with Klay layout...');
      
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
                'background-color': 'data(color)',
                'label': 'data(label)',
                'color': 'white',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '20px',
                'font-weight': 'bold',
                'width': '200px',
                'height': '80px',
                'border-color': '#2c3e50',
                'border-width': 2,
                'text-wrap': 'wrap',
                'text-max-width': '180px',
                'shape': 'ellipse'
              }
            },
            {
              selector: 'edge',
              style: {
                'width': '2px',
                'line-color': 'data(color)',
                'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 1.2,
                'curve-style': modelVisualization ? 'unbundled-bezier' : 'bezier',
                'edge-distances': 'intersection',
                'loop-direction': '0deg',
                'loop-sweep': '-45deg',
                'control-point-distances': [-30, 30],
                'control-point-weights': [0.25, 0.75],
                'control-point-step-size': 40
              }
            },
          ],
          layout: {
            name: 'klay',
            animate: false,
            klay: {
              direction: 'RIGHT', // 'DOWN' is also common
              edgeRouting: 'SPLINES', // or 'SPLINES'
              spacing: 10,
              edgeSpacingFactor: 0.1,
              nodePlacement: 'SIMPLE', // or 'BRANDES_KOEPF' for better layering
              thoroughness: 50,
              inLayerSpacingFactor: dfgData.edges.length > 100 ? 10 : dfgData.edges.length > 10 ? 30 : 50,
              layoutHierarchy: true,
              fixedAlignment: 'BALANCED' // or 'LEFTDOWN', 'RIGHTUP', etc.
            }
          } as any,
          wheelSensitivity: 0.2,
          minZoom: 0.3,
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
      console.error('Layout error details:', error);
      
      // Try fallback to cose layout if Klay fails
      try {
        console.log('Trying fallback to cose layout...');
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
                'background-color': 'data(color)',
                'label': 'data(label)',
                'color': 'white',
                'text-valign': 'center',
                'text-halign': 'center',
                'font-size': '20px',
                'font-weight': 'bold',
                'width': '200px',
                'height': '80px',
                'border-color': '#2c3e50',
                'border-width': 2,
                'text-wrap': 'wrap',
                'text-max-width': '180px',
                'shape': 'ellipse'
              }
            },
            {
              selector: 'edge',
              style: {
                'width': '2px',
                'line-color': 'data(color)',
                'target-arrow-color': 'data(color)',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.8,
                'curve-style': 'straight',
                'edge-distances': 'intersection',
                'loop-direction': '0deg',
                'loop-sweep': '-45deg',
                'control-point-distances': [-30, 30],
                'control-point-weights': [0.25, 0.75],
                'control-point-step-size': 40
              }
            }
          ],
          layout: {
            name: 'cose',
            animationDuration: 0,
            randomize: false,
            componentSpacing: 160,
            nodeRepulsion: 400000,
            nodeOverlap: 20,
            idealEdgeLength: 300,
            edgeElasticity: 150,
            nestingFactor: 5,
            gravity: 80,
            numIter: 500,
            initialTemp: 200,
            coolingFactor: 0.95,
            minTemp: 1.0,
            nodeDimensionsIncludeLabels: true,
            fit: true,
            padding: 50
          },
          wheelSensitivity: 0.2,
          minZoom: 0.3,
          maxZoom: 3
        });
      } catch (fallbackError) {
        console.error('Fallback layout also failed:', fallbackError);
      }
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
  }, [dfgData, layoutType, onConstraintClick, visualizationType]);

  return (
    <div className="process-model-view">
      {modelVisualization && (
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
          <CytoscapeModel 
            modelVisualization={modelVisualization} 
            onConstraintClick={onConstraintClick}
          />
        </div>
      )}
      
      <div className="process-flow-visualization" style={{ marginTop: modelVisualization ? 32 : 0 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <h3>Process Flow Analysis</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setVisualizationType('dfg')}
              style={{
                padding: '8px 16px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                backgroundColor: visualizationType === 'dfg' ? '#667eea' : 'white',
                color: visualizationType === 'dfg' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              Graph View
            </button>
            <button
              onClick={() => setVisualizationType('matrix')}
              style={{
                padding: '8px 16px',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                backgroundColor: visualizationType === 'matrix' ? '#667eea' : 'white',
                color: visualizationType === 'matrix' ? 'white' : '#666',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              Matrix View
            </button>
          </div>
        </div>

        {visualizationType === 'dfg' ? (
          <div className="dfg-visualization">
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
              <strong>DFG Visualization:</strong> Shows process flow from both original event log and aligned log. 
              Gray indicates conforming behavior (present in both logs), red shows original-only deviations, blue shows model insertions.
              Use the slider to filter by variant coverage (most common sequences first).
            </div>
            
            <div className="dfg-controls" style={{ marginBottom: 16, marginTop: 16 }}>
              {modelVisualization && (
                <>
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
                      {dfgData.includedVariantCount}/{dfgData.totalVariantCount} variants
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                    {minPercentage === 0 ? 'Showing all variants' : `Showing ${dfgData.coveragePercentage.toFixed(1)}% of traces (${dfgData.includedVariantCount} most common variants)`}
                  </div>
                </>
              )}
              
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
                    height: 2, 
                    backgroundColor: '#6c757d' 
                  }}></div>
                  <span>Conforming</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ 
                    width: 12, 
                    height: 2, 
                    backgroundColor: '#e74c3c' 
                  }}></div>
                  <span>Original only</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ 
                    width: 12, 
                    height: 2, 
                    backgroundColor: '#3498db' 
                  }}></div>
                  <span>Model insertion</span>
                </div>
              </div>
            </div>
            
            <div 
              ref={dfgContainerRef} 
              style={{ 
                height: 500, 
                width: '100%',
                background: '#f8f9fa', 
                borderRadius: 8, 
                border: '1px solid #e9ecef',
                marginTop: 16
              }}
            />
          </div>
        ) : (
          <ProcessFlowMatrix 
            traces={traces}
            showAllTransitions={!modelVisualization}
            onActivityClick={(activity) => {
              console.log('Clicked activity:', activity);
              // Could implement activity filtering or highlighting here
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ProcessModelView; 