import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { ModelVisualization } from '../types';

interface CytoscapeModelProps {
  modelVisualization: ModelVisualization | null;
  onConstraintClick?: (constraintId: string) => void;
}

const CytoscapeModel: React.FC<CytoscapeModelProps> = ({ modelVisualization, onConstraintClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [arrowValue, setArrowValue] = useState<'violations' | 'activations' | 'fulfillments' | 'rate'>('violations');
  const [tooltip, setTooltip] = useState<{ show: boolean; x: number; y: number; content: string }>({
    show: false,
    x: 0,
    y: 0,
    content: ''
  });

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Debug tooltip state changes
  useEffect(() => {
    console.log('Tooltip state changed:', tooltip);
  }, [tooltip]);

  useEffect(() => {
    if (!modelVisualization || !containerRef.current || !isMounted) return;

    // Destroy previous instance
    if (cyRef.current) {
      try {
        cyRef.current.destroy();
        cyRef.current = null;
      } catch (error) {
        console.warn('Error destroying previous Cytoscape instance:', error);
      }
    }

    // Convert our data to Cytoscape format with attached constraint rectangles
    const nodes: any[] = [];
    const edges: any[] = [];
    
    // Add activity nodes
    modelVisualization.activities.forEach(activity => {
      nodes.push({
        data: {
          id: activity.id,
          label: activity.name,
          width: activity.width || 120,
          height: activity.size || 60,
          color: '#2c3e50', // Dark blue background like RuM
          type: 'activity',
          support: '100.0%' // Default support
        },
        group: 'nodes' as const
      });
    });
    
    // Add constraint rectangles and edges
    modelVisualization.constraints.forEach(constraint => {
      if (constraint.isSelfLoop) {
        // Create constraint rectangle node positioned above the activity
        const constraintNodeId = `constraint-${constraint.id}`;
        const support = (constraint.constraint.statistics.fulfilments / constraint.constraint.statistics.activations * 100).toFixed(1);
        
        nodes.push({
          data: {
            id: constraintNodeId,
            label: constraint.constraint.type,
            width: 80,
            height: 25,
            color: '#f39c12', // Yellow/orange for constraint rectangles
            type: 'constraint',
            constraintId: constraint.id,
            support: `${support}%`,
            parentActivity: constraint.source,
            grabbable: false // Make constraint nodes non-movable
          },
          group: 'nodes' as const
        });
        
        // Add edge from constraint rectangle to activity (invisible or very thin)
        edges.push({
          data: {
            id: `edge-${constraint.id}`,
            source: constraintNodeId,
            target: constraint.source,
            label: '',
            color: 'transparent',
            thickness: 0.5,
            type: 'constraint-edge'
          },
          group: 'edges' as const
        });
      } else {
        // Regular edges between activities
        let label = '';
        let thickness = 1;
        
        switch (arrowValue) {
          case 'violations':
            label = constraint.violationCount.toString();
            thickness = Math.max(1, Math.min(4, constraint.violationCount / 2));
            break;
          case 'activations':
            label = constraint.constraint.statistics.activations.toString();
            thickness = Math.max(1, Math.min(4, constraint.constraint.statistics.activations / 5));
            break;
          case 'fulfillments':
            label = constraint.constraint.statistics.fulfilments.toString();
            thickness = Math.max(1, Math.min(4, constraint.constraint.statistics.fulfilments / 3));
            break;
          case 'rate':
            const rate = constraint.constraint.violationRate * 100;
            label = `${rate.toFixed(1)}%`;
            thickness = Math.max(1, Math.min(4, rate / 10));
            break;
        }
        
        edges.push({
          data: {
            id: constraint.id,
            source: constraint.source,
            target: constraint.target,
            label: `${constraint.constraint.type} ${label}`, // Include constraint type in label
            color: '#666666', // Gray for all constraints
            thickness: thickness,
            type: (constraint.constraint.type === 'NotCoExistence' || 
                   constraint.constraint.type === 'CoExistence' ||
                   constraint.constraint.type === 'AlternateSuccession' ||
                   constraint.constraint.type === 'ChainSuccession') ? 'bidirectional-edge' : 'activity-edge',
            constraintId: constraint.id,
            constraintType: constraint.constraint.type, // Store constraint type separately
            isBidirectional: (constraint.constraint.type === 'NotCoExistence' || 
                           constraint.constraint.type === 'CoExistence' ||
                           constraint.constraint.type === 'AlternateSuccession' ||
                           constraint.constraint.type === 'ChainSuccession').toString()
          },
          group: 'edges' as const
        });
      }
    });

    const elements = { nodes, edges };

    try {
      // Create Cytoscape instance
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: elements,
        style: [
          {
            selector: 'node[type = "activity"]',
            style: {
              'background-color': 'data(color)',
              'label': 'data(label)',
              'color': 'white',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '12px',
              'font-weight': 'bold',
              'width': 'data(width)',
              'height': 'data(height)',
              'border-color': '#34495e',
              'border-width': 2,
              'text-wrap': 'wrap',
              'text-max-width': 'data(width)',
              'shape': 'roundrectangle',
              'text-outline-color': '#2c3e50',
              'text-outline-width': 1
            }
          },
          {
            selector: 'node[type = "constraint"]',
            style: {
              'background-color': 'data(color)',
              'label': 'data(label)',
              'color': 'white',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '10px',
              'font-weight': 'bold',
              'width': 'data(width)',
              'height': 'data(height)',
              'border-color': '#f39c12',
              'border-width': 2,
              'text-wrap': 'wrap',
              'text-max-width': 'data(width)',
              'shape': 'roundrectangle',
              'text-outline-color': '#f39c12',
              'text-outline-width': 1,
            }
          },
          {
            selector: 'edge[type = "activity-edge"]',
            style: {
              'width': 'data(thickness)',
              'line-color': 'data(color)',
              'target-arrow-color': 'data(color)',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 1,
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '11px',
              'font-weight': 'bold',
              'text-rotation': 'autorotate',
              'text-margin-y': -15,
              'text-background-color': 'white',
              'text-background-opacity': 0.9,
              'text-background-padding': '3px',
              'text-border-color': '#666666',
              'text-border-width': 1,
              'text-border-opacity': 0.8,
            }
          },
          {
            selector: 'edge[type = "bidirectional-edge"]',
            style: {
              'width': 'data(thickness)',
              'line-color': 'data(color)',
              'target-arrow-color': 'data(color)',
              'target-arrow-shape': 'triangle',
              'source-arrow-color': 'data(color)',
              'source-arrow-shape': 'triangle',
              'arrow-scale': 1,
              'curve-style': 'bezier',
              'label': 'data(label)',
              'font-size': '11px',
              'font-weight': 'bold',
              'text-rotation': 'autorotate',
              'text-margin-y': -15,
              'text-background-color': 'white',
              'text-background-opacity': 0.9,
              'text-background-padding': '3px',
              'text-border-color': '#666666',
              'text-border-width': 1,
              'text-border-opacity': 0.8,
            }
          },
          {
            selector: 'edge[type = "constraint-edge"]',
            style: {
              'width': '0',
              'curve-style': 'straight',
            }
          }
        ],
        layout: {
          name: 'cose',
          nodeDimensionsIncludeLabels: true,
          padding: 10,
          fit: true,
          randomize: false,
          componentSpacing: 40,
          nodeRepulsion: 8000,
          nodeOverlap: 30,
          idealEdgeLength: 120,
          edgeElasticity: 250,
          nestingFactor: 0.1,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0
        },
        wheelSensitivity: 0.5,
        minZoom: 0.4,
        maxZoom: 3
      });

      // Add event listeners only if instance exists
      if (cyRef.current) {
        // Set up position synchronization for constraint rectangles
        const activityConstraintPairs = new Map<string, string[]>();
        
        // Group constraints by their parent activity
        modelVisualization.constraints.forEach(constraint => {
          if (constraint.isSelfLoop) {
            const parentActivity = constraint.source;
            if (!activityConstraintPairs.has(parentActivity)) {
              activityConstraintPairs.set(parentActivity, []);
            }
            activityConstraintPairs.get(parentActivity)!.push(`constraint-${constraint.id}`);
          }
        });
        
        // Add position listeners for each activity
        activityConstraintPairs.forEach((constraintIds, activityId) => {
          const activityNode = cyRef.current.getElementById(activityId);
          if (activityNode.length > 0) {
            activityNode.on('position', () => {
              const activityPos = activityNode.position();
              const activityHeight = activityNode.height();
              
              // Update position of all constraint rectangles for this activity
              // Stack them vertically with spacing
              constraintIds.forEach((constraintId, index) => {
                const constraintNode = cyRef.current.getElementById(constraintId);
                if (constraintNode.length > 0) {
                  const constraintHeight = constraintNode.height();
                  const spacing = 5; // Space between constraint rectangles
                  const totalOffset = 20 + (index * (constraintHeight + spacing)); // Base offset + stacked offset
                  
                  constraintNode.position({
                    x: activityPos.x,
                    y: activityPos.y - activityHeight/2 - totalOffset
                  });
                }
              });
            });
          }
        });

        cyRef.current.on('mouseover', 'node', function(event: any) {
          if (cyRef.current && isMounted) {
            const node = event.target;
            const nodeType = node.data('type');
            if (nodeType === 'activity') {
              node.style('border-width', 3);
              node.style('border-color', '#e74c3c');
            } else {
              node.style('border-width', 3);
              node.style('border-color', '#e74c3c');
            }
          }
        });

        cyRef.current.on('mouseout', 'node', function(event: any) {
          if (cyRef.current && isMounted) {
            const node = event.target;
            const nodeType = node.data('type');
            if (nodeType === 'activity') {
              node.style('border-width', 2);
              node.style('border-color', '#34495e');
            } else {
              node.style('border-width', 2);
              node.style('border-color', '#f39c12');
            }
          }
        });

        cyRef.current.on('mouseout', 'edge', function(event: any) {
          if (cyRef.current && isMounted) {
            const edge = event.target;
            edge.style('width', edge.data('thickness'));
            setTooltip({ show: false, x: 0, y: 0, content: '' });
          }
        });

        cyRef.current.on('click', 'edge', function(event: any) {
          if (cyRef.current && isMounted && onConstraintClick) {
            const edge = event.target;
            const constraintId = edge.data('constraintId');
            if (constraintId) {
              onConstraintClick(constraintId);
            }
          }
        });

        cyRef.current.on('click', 'node[type = "constraint"]', function(event: any) {
          if (cyRef.current && isMounted && onConstraintClick) {
            const node = event.target;
            const constraintId = node.data('constraintId');
            if (constraintId) {
              onConstraintClick(constraintId);
            }
          }
        });

        cyRef.current.on('mouseover', 'edge', function(event: any) {
          if (cyRef.current && isMounted) {
            const edge = event.target;
            edge.style('width', edge.data('thickness') * 1.5);
            
            // Get constraint details
            const constraintId = edge.data('constraintId');
            const constraint = modelVisualization.constraints.find(c => c.id === constraintId);
            if (constraint) {
              const stats = constraint.constraint.statistics;
              const rate = constraint.constraint.violationRate * 100;
              const content = `
                <strong>${constraint.constraint.type}<br/></strong>
                <em>${constraint.constraint.helpText}</em><br/>
                Activations: ${stats.activations}<br/>
                Fulfillments: ${stats.fulfilments}<br/>
                Violations: ${constraint.violationCount}<br/>
                Violation Rate: ${rate.toFixed(1)}%
              `;
              
              // Get mouse position relative to the container
              const containerRect = containerRef.current?.getBoundingClientRect();
              const position = event.renderedPosition || event.position;
              
              if (containerRect) {
                const x = containerRect.left + position.x;
                const y = containerRect.top + position.y;
                
                console.log('Setting tooltip:', { x, y, content });
                setTooltip({
                  show: true,
                  x: x,
                  y: y,
                  content: content
                });
              }
            }
          }
        });

        cyRef.current.on('mouseover', 'node[type = "constraint"]', function(event: any) {
          if (cyRef.current && isMounted) {
            const node = event.target;
            
            // Get constraint details
            const constraintId = node.data('constraintId');
            const constraint = modelVisualization.constraints.find(c => c.id === constraintId);
            if (constraint) {
              const stats = constraint.constraint.statistics;
              const rate = constraint.constraint.violationRate * 100;
              const support = node.data('support');
              
              const content = `
                <strong>${constraint.constraint.type}<br/></strong>
                <em>${constraint.constraint.helpText}</em><br/>
                Support: ${support}<br/>
                Activations: ${stats.activations}<br/>
                Fulfillments: ${stats.fulfilments}<br/>
                Violations: ${constraint.violationCount}<br/>
                Violation Rate: ${rate.toFixed(1)}%
              `;
              
              // Get mouse position relative to the container
              const containerRect = containerRef.current?.getBoundingClientRect();
              const position = event.renderedPosition || event.position;
              
              if (containerRect) {
                const x = containerRect.left + position.x;
                const y = containerRect.top + position.y;
                
                console.log('Setting tooltip:', { x, y, content });
                setTooltip({
                  show: true,
                  x: x,
                  y: y,
                  content: content
                });
              }
            }
          }
        });

        cyRef.current.on('mouseout', 'node[type = "constraint"]', function(event: any) {
          if (cyRef.current && isMounted) {
            setTooltip({ show: false, x: 0, y: 0, content: '' });
          }
        });

        // Prevent constraint nodes from being dragged away from their parent activities
        cyRef.current.on('drag', 'node[type = "constraint"]', function(event: any) {
          if (cyRef.current && isMounted) {
            const constraintNode = event.target;
            const parentActivityId = constraintNode.data('parentActivity');
            const parentNode = cyRef.current.getElementById(parentActivityId);
            
            if (parentNode.length > 0) {
              const parentPos = parentNode.position();
              const parentHeight = parentNode.height();
              
              // Find the index of this constraint in the stack
              const constraintIds = activityConstraintPairs.get(parentActivityId) || [];
              const constraintIndex = constraintIds.indexOf(constraintNode.id());
              
              if (constraintIndex !== -1) {
                const constraintHeight = constraintNode.height();
                const spacing = 5;
                const totalOffset = 20 + (constraintIndex * (constraintHeight + spacing));
                
                // Force constraint node back to correct position in stack
                constraintNode.position({
                  x: parentPos.x,
                  y: parentPos.y - parentHeight/2 - totalOffset
                });
              }
            }
          }
        });

        // Also handle dragfree events (when drag ends)
        cyRef.current.on('dragfree', 'node[type = "constraint"]', function(event: any) {
          if (cyRef.current && isMounted) {
            const constraintNode = event.target;
            const parentActivityId = constraintNode.data('parentActivity');
            const parentNode = cyRef.current.getElementById(parentActivityId);
            
            if (parentNode.length > 0) {
              const parentPos = parentNode.position();
              const parentHeight = parentNode.height();
              
              // Find the index of this constraint in the stack
              const constraintIds = activityConstraintPairs.get(parentActivityId) || [];
              const constraintIndex = constraintIds.indexOf(constraintNode.id());
              
              if (constraintIndex !== -1) {
                const constraintHeight = constraintNode.height();
                const spacing = 5;
                const totalOffset = 20 + (constraintIndex * (constraintHeight + spacing));
                
                // Ensure constraint node is in correct position in stack
                constraintNode.position({
                  x: parentPos.x,
                  y: parentPos.y - parentHeight/2 - totalOffset
                });
              }
            }
          }
        });

        // Fit the graph to the container
        cyRef.current.fit();
        
        // Initial positioning of constraint rectangles
        setTimeout(() => {
          if (cyRef.current && isMounted) {
            activityConstraintPairs.forEach((constraintIds, activityId) => {
              const activityNode = cyRef.current.getElementById(activityId);
              if (activityNode.length > 0) {
                const activityPos = activityNode.position();
                const activityHeight = activityNode.height();
                
                // Position all constraint rectangles for this activity with stacking
                constraintIds.forEach((constraintId, index) => {
                  const constraintNode = cyRef.current.getElementById(constraintId);
                  if (constraintNode.length > 0) {
                    const constraintHeight = constraintNode.height();
                    const spacing = 5; // Space between constraint rectangles
                    const totalOffset = 20 + (index * (constraintHeight + spacing)); // Base offset + stacked offset
                    
                    constraintNode.position({
                      x: activityPos.x,
                      y: activityPos.y - activityHeight/2 - totalOffset
                    });
                  }
                });
              }
            });
          }
        }, 100); // Small delay to ensure layout is complete
      }
    } catch (error) {
      console.error('Error creating Cytoscape instance:', error);
    }

    return () => {
      if (cyRef.current && isMounted) {
        try {
          cyRef.current.destroy();
          cyRef.current = null;
        } catch (error) {
          console.warn('Error destroying Cytoscape instance:', error);
        }
      }
    };
  }, [modelVisualization, isMounted, arrowValue]);

  if (!modelVisualization) {
    return (
      <div className="model-container">
        <div className="loading-container">
          <p>Loading model visualization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="model-visualization">
      <div className="model-controls">
        <label>
          Arrow Values:
          <select 
            value={arrowValue} 
            onChange={(e) => setArrowValue(e.target.value as any)}
            style={{ marginLeft: '10px', padding: '4px 8px' }}
          >
            <option value="violations">Violations</option>
            <option value="activations">Activations</option>
            <option value="fulfillments">Fulfillments</option>
            <option value="rate">Violation Rate (%)</option>
          </select>
        </label>
      </div>
      <div className="model-container">
        <div 
          ref={containerRef} 
          style={{ 
            width: '100%', 
            height: '600px',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}
        />
        {tooltip.show && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x + 10,
              top: tooltip.y - 10,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              zIndex: 1000,
              pointerEvents: 'none',
              maxWidth: '250px',
              border: '2px solid red'
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
          />
        )}
      </div>
    </div>
  );
};

export default CytoscapeModel; 