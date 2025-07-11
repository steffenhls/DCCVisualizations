import React, { useState, useCallback } from 'react';
import { DashboardConstraint } from '../types';
import './ConstraintTagging.css';

interface ConstraintTaggingProps {
  constraints: DashboardConstraint[];
  onTaggingComplete: (taggedConstraints: DashboardConstraint[]) => void;
  onBack: () => void;
}

const ConstraintTagging: React.FC<ConstraintTaggingProps> = ({
  constraints,
  onTaggingComplete,
  onBack
}) => {
  const [taggedConstraints, setTaggedConstraints] = useState<DashboardConstraint[]>(() => 
    // Initialize all constraints with default tags
    constraints.map(constraint => ({
      ...constraint,
      tag: {
        priority: 'MEDIUM' as const,
        quality: false,
        efficiency: false,
        compliance: false
      }
    }))
  );

  const handleTagChange = useCallback((constraintId: string, field: keyof DashboardConstraint['tag'], value: any) => {
    setTaggedConstraints(prev => 
      prev.map(c => 
        c.id === constraintId 
          ? { 
              ...c, 
              tag: { 
                ...c.tag!, 
                [field]: value 
              } 
            } 
          : c
      )
    );
  }, []);

  const handleContinue = useCallback(() => {
    onTaggingComplete(taggedConstraints);
  }, [taggedConstraints, onTaggingComplete]);

  return (
    <div className="constraint-tagging">
      <div className="tagging-header">
        <button onClick={onBack} className="back-button">
          ← Back to Upload
        </button>
        <h2>Constraint Tagging</h2>
        <p>Tag constraints with categories and priorities for KPI analysis</p>
        <div className="tagging-note">
          <p><strong>Categories:</strong> Quality, Efficiency, Compliance - used for filtering and grouping</p>
          <p><strong>Priority:</strong> Affects weighted conformance scoring (Low, Medium, High, Critical)</p>
        </div>
      </div>

      <div className="constraints-list">
        {taggedConstraints.map(constraint => (
          <div key={constraint.id} className="constraint-item">
            <div className="constraint-info">
              <h3 className="constraint-id-code">{constraint.id}</h3>
              <p className="constraint-description">{constraint.helpText}</p>
              <div className="constraint-activities">
                <strong>Activities:</strong> {constraint.activities.join(', ')}
              </div>
            </div>

            <div className="tagging-controls">
              <div className="priority-control">
                <label>Priority:</label>
                <select
                  value={constraint.tag?.priority || 'MEDIUM'}
                  onChange={(e) => handleTagChange(constraint.id, 'priority', e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div className="category-controls">
                <label>Categories:</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={constraint.tag?.quality || false}
                      onChange={(e) => handleTagChange(constraint.id, 'quality', e.target.checked)}
                    />
                    Quality
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={constraint.tag?.efficiency || false}
                      onChange={(e) => handleTagChange(constraint.id, 'efficiency', e.target.checked)}
                    />
                    Efficiency
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={constraint.tag?.compliance || false}
                      onChange={(e) => handleTagChange(constraint.id, 'compliance', e.target.checked)}
                    />
                    Compliance
                  </label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="tagging-actions">
        <button 
          className="continue-button"
          onClick={handleContinue}
        >
          Continue to Analysis
        </button>
      </div>
    </div>
  );
};

export default ConstraintTagging; 