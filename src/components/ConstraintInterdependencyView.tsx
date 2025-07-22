import React from 'react';
import { DashboardConstraint } from '../types';
import './ConstraintInterdependencyView.css';

interface ConstraintInterdependencyViewProps {
  constraints: DashboardConstraint[];
  coViolationMatrix: number[][];
}

const ConstraintInterdependencyView: React.FC<ConstraintInterdependencyViewProps> = ({
  constraints,
  coViolationMatrix,
}) => {
  const maxCoViolations = Math.max(...coViolationMatrix.flat());

  return (
    <div className="interdependency-view">
      <h2>Constraint Interdependency Matrix</h2>
      <p>This matrix shows how often constraints are violated together in the same trace.</p>
      <div className="matrix-container">
        <table>
          <thead>
            <tr>
              <th></th>
              {constraints.map(c => (
                <th key={c.id}><div><span>{c.id}</span></div></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {constraints.map((rowConstraint, i) => (
              <tr key={rowConstraint.id}>
                <th>{rowConstraint.id}</th>
                {constraints.map((colConstraint, j) => {
                  const coViolations = coViolationMatrix[i][j];
                  const opacity = maxCoViolations > 0 ? coViolations / maxCoViolations : 0;
                  const textColor = opacity > 0.5 ? 'white' : 'black';
                  
                  const tooltipText = i === j
                    ? `"${rowConstraint.id}" was violated ${coViolations} time(s).`
                    : `Co-violations between "${rowConstraint.id}" and "${colConstraint.id}": ${coViolations}`;

                  return (
                    <td 
                      key={colConstraint.id} 
                      title={tooltipText}
                      style={{ 
                        backgroundColor: `rgba(220, 53, 69, ${opacity})`,
                        color: textColor 
                      }}
                    >
                      {coViolations}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConstraintInterdependencyView; 