import React, { useState } from 'react';
import { UploadedFiles } from '../types';
import FileUpload from './FileUpload';
import ConstraintTagging from './ConstraintTagging';
import AnalysisDashboard from './AnalysisDashboard';
import './Wizard.css';
import { DataProcessor } from '../utils/dataProcessor';
import { DashboardConstraint } from '../types';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

const Wizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [constraints, setConstraints] = useState<DashboardConstraint[]>([]);
  const [taggedConstraints, setTaggedConstraints] = useState<DashboardConstraint[]>([]);

  const steps: WizardStep[] = [
    {
      id: 'upload',
      title: 'Upload Files',
      description: 'Upload your declarative model and analysis files',
      completed: false,
      current: true
    },
    {
      id: 'tagging',
      title: 'Tag Constraints',
      description: 'Tag constraints with priority and categories',
      completed: false,
      current: false
    },
    {
      id: 'analysis',
      title: 'Analysis Dashboard',
      description: 'Comprehensive analysis with DECLARE visualization',
      completed: false,
      current: false
    }
  ];

  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>(steps);

  const updateStep = (stepIndex: number, completed: boolean) => {
    const updatedSteps = wizardSteps.map((step, index) => ({
      ...step,
      completed: index < stepIndex ? true : index === stepIndex ? completed : false,
      current: index === stepIndex
    }));
    setWizardSteps(updatedSteps);
  };

  const nextStep = () => {
    if (currentStep < wizardSteps.length - 1) {
      updateStep(currentStep, true);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      updateStep(currentStep - 1, true);
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex <= currentStep || wizardSteps[stepIndex - 1]?.completed) {
      setCurrentStep(stepIndex);
      updateStep(stepIndex, false);
    }
  };

  const handleFilesChange = async (files: UploadedFiles) => {
    setUploadedFiles(files);
    
    if (files.declarativeModel) {
      const modelText = await files.declarativeModel.text();
      const parsed = DataProcessor.parseDeclareModel(modelText);
      
      // Parse analysis overview for constraint statistics
      let constraintStats: any[] = [];
      if (files.analysisOverview) {
        try {
          const analysisText = await files.analysisOverview.text();
          constraintStats = DataProcessor.parseAnalysisOverview(analysisText);
          console.log('Wizard - Parsed analysis overview:', constraintStats.length);
        } catch (error) {
          console.error('Error parsing analysis overview:', error);
        }
      }
      
      // Create dashboard constraints with actual statistics
      const dashboardConstraints = parsed.map((constraint: any) => {
        // Find matching statistics for this constraint
        const stats = constraintStats.find(s => s.constraintId === constraint.id);
        
        return {
          ...constraint,
          statistics: stats ? {
            constraintId: constraint.id,
            activations: stats.activations || 0,
            fulfilments: stats.fulfilments || 0,
            violations: stats.violations || 0,
            vacuousFulfilments: stats.vacuousFulfilments || 0,
            vacuousViolations: stats.vacuousViolations || 0,
            violationRate: stats.violationRate || 0,
            severity: stats.severity || 'MEDIUM',
          } : {
            constraintId: constraint.id,
            activations: 0,
            fulfilments: 0,
            violations: 0,
            vacuousFulfilments: 0,
            vacuousViolations: 0,
            violationRate: 0,
            severity: 'MEDIUM',
          },
          violationCount: stats ? (stats.violations + stats.vacuousViolations) : 0,
          fulfilmentCount: stats ? (stats.fulfilments + stats.vacuousFulfilments) : 0,
          violationRate: stats ? stats.violationRate : 0,
          severity: stats ? stats.severity : 'MEDIUM',
          tag: {
            priority: 'MEDIUM',
            quality: false,
            efficiency: false,
            compliance: false,
          },
        };
      });
      
      console.log('Wizard - Created dashboard constraints:', {
        total: dashboardConstraints.length,
        withStats: dashboardConstraints.filter(c => c.statistics.activations > 0).length,
        sample: dashboardConstraints.slice(0, 3)
      });
      
      setConstraints(dashboardConstraints);
    }
  };

  const handleTaggingComplete = (tagged: DashboardConstraint[]) => {
    setTaggedConstraints(tagged);
    nextStep();
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <FileUpload
            uploadedFiles={uploadedFiles}
            onFilesChange={handleFilesChange}
            onNext={nextStep}
          />
        );
      case 1:
        return (
          <ConstraintTagging
            constraints={constraints}
            onTaggingComplete={handleTaggingComplete}
            onBack={prevStep}
          />
        );
      case 2:
        return (
          <AnalysisDashboard
            uploadedFiles={uploadedFiles}
            taggedConstraints={taggedConstraints}
            onBack={prevStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="wizard">
      <div className="wizard-header">
        <h1>Declarative Conformance Checking Wizard</h1>
        <p>Streamlined analysis with constraint tagging and DECLARE visualization</p>
      </div>

      <div className="wizard-progress">
        {wizardSteps.map((step, index) => (
          <div
            key={step.id}
            className={`wizard-step ${step.current ? 'current' : ''} ${step.completed ? 'completed' : ''}`}
            onClick={() => goToStep(index)}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-content">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
            {step.completed && <div className="step-check">✓</div>}
          </div>
        ))}
      </div>

      <div className="wizard-content">
        {renderCurrentStep()}
      </div>
    </div>
  );
};

export default Wizard; 