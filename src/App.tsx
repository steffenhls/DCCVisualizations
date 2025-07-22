import React, { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ConstraintTagging from './components/ConstraintTagging';
import AnalysisDashboard from './components/AnalysisDashboard';
import { UploadedFiles, DashboardConstraint } from './types';
import { DataProcessor } from './utils/dataProcessor';
import './App.css';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>({});
  const [taggedConstraints, setTaggedConstraints] = useState<DashboardConstraint[]>([]);
  const [processedConstraints, setProcessedConstraints] = useState<DashboardConstraint[]>([]);

  const steps = [
    {
      id: 'upload',
      title: 'Upload Files',
      description: 'Upload your DECLARE model and analysis files'
    },
    {
      id: 'tagging',
      title: 'Constraint Tagging',
      description: 'Tag constraints with priorities and categories'
    },
    {
      id: 'analysis',
      title: 'Analysis Dashboard',
      description: 'Comprehensive conformance analysis and visualization'
    }
  ];

  // Process constraints when files are uploaded
  useEffect(() => {
    const processConstraints = async () => {
      if (uploadedFiles.declarativeModel) {
        try {
          const modelText = await readFileAsText(uploadedFiles.declarativeModel);
          const constraints = DataProcessor.parseDeclareModel(modelText);
          
          // Create basic DashboardConstraint objects for tagging
          const dashboardConstraints: DashboardConstraint[] = constraints.map(constraint => ({
            ...constraint,
            statistics: {
              constraintId: constraint.id,
              activations: 0,
              fulfilments: 0,
              violations: 0,
              violationRate: 0,
              severity: 'MEDIUM' as const
            },
            violationCount: 0,
            fulfilmentCount: 0,
            violationRate: 0,
            severity: 'LOW' as const,
            tag: {
              priority: 'MEDIUM',
              quality: false,
              efficiency: false,
              compliance: false,
            }
          }));
          
          setProcessedConstraints(dashboardConstraints);
        } catch (error) {
          console.error('Error processing constraints:', error);
        }
      }
    };

    processConstraints();
  }, [uploadedFiles.declarativeModel]);

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  // Helper function to read file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const handleFilesChange = (files: UploadedFiles) => {
    setUploadedFiles(files);
  };

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleTaggingComplete = (constraints: DashboardConstraint[]) => {
    setTaggedConstraints(constraints);
    setCurrentStep(currentStep + 1);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <FileUpload
            uploadedFiles={uploadedFiles}
            onFilesChange={handleFilesChange}
            onNext={handleNext}
          />
        );
      case 1:
        return (
          <ConstraintTagging
            constraints={processedConstraints}
            onTaggingComplete={handleTaggingComplete}
            onBack={handleBack}
          />
        );
      case 2:
        return (
          <AnalysisDashboard
            uploadedFiles={uploadedFiles}
            taggedConstraints={taggedConstraints}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      {currentStep === 0 && (
      <div className="app-header">
        <h1>Declarative Conformance Analysis</h1>
        <p>Upload your files, tag constraints, and analyze process conformance with DECLARE constraints</p>
      </div>
      )}

      <div className="app-progress">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`progress-step ${index === currentStep ? 'active' : ''} ${
              index < currentStep ? 'completed' : ''
            }`}
          >
            <div className="step-number">{index + 1}</div>
            <div className="step-info">
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="app-content">
        {renderStep()}
      </div>
    </div>
  );
};

export default App; 