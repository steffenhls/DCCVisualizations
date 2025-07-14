import React, { useState, useCallback, useMemo } from 'react';
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

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');

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

  // Get unique constraint types for filter dropdown
  const constraintTypes = useMemo(() => {
    const types = new Set(taggedConstraints.map(c => c.type));
    return Array.from(types).sort();
  }, [taggedConstraints]);

  // Get unique activities for filter dropdown
  const activities = useMemo(() => {
    const allActivities = new Set<string>();
    taggedConstraints.forEach(constraint => {
      constraint.activities.forEach(activity => allActivities.add(activity));
    });
    return Array.from(allActivities).sort();
  }, [taggedConstraints]);

  // Filter constraints based on search term, type, and activity
  const filteredConstraints = useMemo(() => {
    return taggedConstraints.filter(constraint => {
      const matchesSearch = searchTerm === '' || 
        constraint.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        constraint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        constraint.helpText.toLowerCase().includes(searchTerm.toLowerCase()) ||
        constraint.activities.some(activity => 
          activity.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesType = selectedType === '' || constraint.type === selectedType;
      const matchesActivity = selectedActivity === '' || constraint.activities.includes(selectedActivity);
      
      return matchesSearch && matchesType && matchesActivity;
    });
  }, [taggedConstraints, searchTerm, selectedType, selectedActivity]);

  return (
    <div className="constraint-tagging">
      <div className="tagging-header">
        <button onClick={onBack} className="back-button">
          ← Back to Upload
        </button>
        <h2>Constraint Tagging</h2>
      </div>

      {/* Filters */}
      <div className="tagging-filters">
        <div className="filter-group">
          <label htmlFor="search-constraints">Search Constraints:</label>
          <input
            id="search-constraints"
            type="text"
            placeholder="Search by ID, description, activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <label htmlFor="type-filter">Filter by Type:</label>
          <select
            id="type-filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="type-select"
          >
            <option value="">All Types</option>
            {constraintTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="activity-filter">Filter by Activity:</label>
          <select
            id="activity-filter"
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="activity-select"
          >
            <option value="">All Activities</option>
            {activities.map(activity => (
              <option key={activity} value={activity}>{activity}</option>
            ))}
          </select>
        </div>

        <div className="filter-results">
          <span>Showing {filteredConstraints.length} of {taggedConstraints.length} constraints</span>
        </div>
      </div>

      <div className="constraints-list">
        {filteredConstraints.map(constraint => (
          <div key={constraint.id} className="constraint-item">
            <div className="constraint-info">
              <h3 className="constraint-id-code">{constraint.id}</h3>
              <p className="constraint-description">{constraint.helpText}</p>
              <div className="constraint-activities">
                <strong>Activities:</strong> {constraint.activities.join(', ')}
              </div>
              <div className="constraint-type">
                <strong>Type:</strong> {constraint.type}
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

      {filteredConstraints.length === 0 && (
        <div className="no-results">
          <p>No constraints match your current filters.</p>
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedType('');
              setSelectedActivity('');
            }}
            className="clear-filters-button"
          >
            Clear All Filters
          </button>
        </div>
      )}

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