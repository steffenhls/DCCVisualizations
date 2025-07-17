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

    // Convert our data to Cytoscape format
    const elements = {
      nodes: modelVisualization.activities.map(activity => ({
        data: {
          id: activity.id,
          label: activity.name,
          width: activity.width || 100,
          height: activity.size || 60,
          color: activity.color
        },
        group: 'nodes' as const
      })),
      edges: modelVisualization.constraints.map(edge => {
        let label = '';
        let thickness = 1;
        
        switch (arrowValue) {
          case 'violations':
            label = edge.violationCount.toString();
            thickness = Math.max(1, Math.min(4, edge.violationCount / 2));
            break;
          case 'activations':
            label = edge.constraint.statistics.activations.toString();
            thickness = Math.max(1, Math.min(4, edge.constraint.statistics.activations / 5));
            break;
          case 'fulfillments':
            label = edge.constraint.statistics.fulfilments.toString();
            thickness = Math.max(1, Math.min(4, edge.constraint.statistics.fulfilments / 3));
            break;
          case 'rate':
            const rate = edge.constraint.violationRate * 100;
            label = `${rate.toFixed(1)}%`;
            thickness = Math.max(1, Math.min(4, rate / 10));
            break;
        }
        
        return {
          data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: label,
            color: edge.color,
            thickness: thickness,
            isSelfLoop: edge.isSelfLoop
          },
          group: 'edges' as const
        };
      })
    };

    try {
      // Create Cytoscape instance
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements: elements,
        style: [
          {
            selector: 'node',
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
              'border-color': '#2c3e50',
              'border-width': 2,
              'text-wrap': 'wrap',
              'text-max-width': 'data(width)',
              'shape': 'roundrectangle'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 'data(thickness)',
              'line-color': '#666666',
              'target-arrow-color': '#666666',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
              'curve-style': 'straight',
              'label': 'data(label)',
              'font-size': '10px',
              'font-weight': 'bold',
              'text-rotation': 'autorotate',
              'text-margin-y': -10,
              'text-background-color': 'white',
              'text-background-opacity': 0.8,
              'text-background-padding': '2px'
            }
          },
          {
            selector: 'edge[isSelfLoop = true]',
            style: {
              'curve-style': 'unbundled-bezier',
              'control-point-distances': [40],
              'control-point-weights': [0.5],
              'edge-distances': 'intersection',
              'loop-direction': '0deg',
              'loop-sweep': '-45deg'
            }
          }
        ],
        layout: {
          name: 'cose',
          animate: true,
          animationDuration: 1000,
          nodeDimensionsIncludeLabels: true,
          padding: 50,
          fit: true,
          randomize: false,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          nodeOverlap: 20,
          idealEdgeLength: 200,
          edgeElasticity: 100,
          nestingFactor: 5,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0
        },
        wheelSensitivity: 0.3,
        minZoom: 0.2,
        maxZoom: 3
      });

      // Add event listeners only if instance exists
      if (cyRef.current) {
        cyRef.current.on('mouseover', 'node', function(event: any) {
          if (cyRef.current && isMounted) {
            const node = event.target;
            node.style('border-width', 3);
            node.style('border-color', '#e74c3c');
          }
        });

        cyRef.current.on('mouseout', 'node', function(event: any) {
          if (cyRef.current && isMounted) {
            const node = event.target;
            node.style('border-width', 2);
            node.style('border-color', '#2c3e50');
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
            // Get the constraint from the edge data
            const constraint = modelVisualization.constraints.find(c => c.id === edge.id());
            if (constraint) {
              // Use the actual constraint ID instead of the edge ID
              onConstraintClick(constraint.constraint.id);
            }
          }
        });

        cyRef.current.on('mouseover', 'edge', function(event: any) {
          if (cyRef.current && isMounted) {
            const edge = event.target;
            edge.style('width', edge.data('thickness') * 1.5);
            
            // Get constraint details
            const constraint = modelVisualization.constraints.find(c => c.id === edge.id());
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

        // Fit the graph to the container
        cyRef.current.fit();
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