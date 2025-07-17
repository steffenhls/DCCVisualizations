import React, { useState, useCallback } from 'react';
import { UploadedFiles } from '../types';
import './FileUpload.css';

interface FileUploadProps {
  uploadedFiles: UploadedFiles;
  onFilesChange: (files: UploadedFiles) => void;
  onNext: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({
  uploadedFiles,
  onFilesChange,
  onNext
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFiles = useCallback((files: File[]) => {
    const errors: string[] = [];
    const newFiles: UploadedFiles = { ...uploadedFiles };

    files.forEach(file => {
      const fileName = file.name.toLowerCase();
      
      // Detect file type based on filename and content
      if (fileName.includes('model') || fileName.includes('declare') || fileName.endsWith('.decl')) {
        newFiles.declarativeModel = file;
      } else if (fileName.includes('analysis_overview')) {
        newFiles.analysisOverview = file;
      } else if (fileName.includes('analysis_detail')) {
        newFiles.analysisDetail = file;
      } else if (fileName.includes('replay_overview')) {
        newFiles.replayOverview = file;
      } else if (fileName.includes('replay_detail')) {
        newFiles.replayDetail = file;
      } else if (fileName.includes('log_aligned') || fileName.includes('aligned') || fileName.includes('alignment')) {
        newFiles.alignedLog = file;
      } else if (fileName.includes('log.xes') || (fileName.includes('event') && !fileName.includes('aligned')) || 
                 (fileName.endsWith('.xes') && !fileName.includes('aligned'))) {
        newFiles.eventLog = file;
      } else {
        errors.push(`Unknown file type: ${file.name}`);
      }
    });

    setUploadErrors(errors);
    onFilesChange(newFiles);
  }, [uploadedFiles, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  }, [processFiles]);

  const removeFile = useCallback((fileType: keyof UploadedFiles) => {
    const newFiles = { ...uploadedFiles };
    delete newFiles[fileType];
    onFilesChange(newFiles);
  }, [uploadedFiles, onFilesChange]);

  const getFileDisplayName = (file: File): string => {
    return file.name.length > 30 ? `${file.name.substring(0, 27)}...` : file.name;
  };

  const renderFileList = (files: File | File[], title: string, fileType: keyof UploadedFiles) => {
    if (!files) return null;
    
    const fileArray = Array.isArray(files) ? files : [files];
    
    return (
      <div className="file-section">
        <h3>{title}</h3>
        <div className="file-list">
          {fileArray.map((file, index) => (
            <div key={`${file.name}-${index}`} className="file-item">
              <span className="file-name">{getFileDisplayName(file)}</span>
              <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                className="remove-file"
                onClick={() => removeFile(fileType)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const canProceed = uploadedFiles.declarativeModel && 
    (uploadedFiles.analysisOverview || uploadedFiles.replayOverview);

  return (
    <div className="file-upload">
      <div className="upload-header">
        <h2>Upload Analysis Files</h2>
        <p>Upload your DECLARE model and analysis files to begin the conformance analysis.</p>
      </div>

      <div className="upload-container">
        <div
          className={`drag-drop-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="drag-content">
            <div className="upload-icon">📁</div>
            <h3>Drag and drop files here</h3>
            <p>or click to browse</p>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="file-input"
              accept=".csv,.txt,.xes,.xml,.decl"
            />
          </div>
        </div>

        {uploadErrors.length > 0 && (
          <div className="upload-errors">
            {uploadErrors.map((error, index) => (
              <div key={index} className="error-message">
                {error}
              </div>
            ))}
          </div>
        )}

        <div className="file-requirements">
          <h3>Required Files:</h3>
          <ul>
            <li className={uploadedFiles.declarativeModel ? 'completed' : ''}>
              <strong>DECLARE Model:</strong> .decl file containing DECLARE constraints (e.g., SepsisModel.decl)
            </li>
            <li className={uploadedFiles.analysisOverview ? 'completed' : ''}>
              <strong>Analysis Overview:</strong> CSV file with constraint-level statistics (e.g., analysis_overview.csv)
            </li>
            <li className={uploadedFiles.analysisDetail ? 'completed' : ''}>
              <strong>Analysis Detail:</strong> CSV file with trace-constraint mappings (e.g., analysis_detail.csv)
            </li>
            <li className={uploadedFiles.replayOverview ? 'completed' : ''}>
              <strong>Replay Overview:</strong> CSV file with trace-level statistics (e.g., replay_overview.csv)
            </li>
            <li className={uploadedFiles.eventLog ? 'completed' : ''}>
              <strong>Event Log (Optional):</strong> XES file with process events (e.g., log.xes)
            </li>
            <li className={uploadedFiles.alignedLog ? 'completed' : ''}>
              <strong>Aligned Log (Optional):</strong> XES file with alignment results (e.g., log_aligned.xes)
            </li>
          </ul>
          <div className="file-naming-note">
            <p><strong>Note:</strong> Make sure to use distinct names for event log and aligned log files to avoid conflicts.</p>
          </div>
        </div>

        <div className="uploaded-files">
          {uploadedFiles.declarativeModel && renderFileList(uploadedFiles.declarativeModel, 'DECLARE Model', 'declarativeModel')}
          {uploadedFiles.analysisOverview && renderFileList(uploadedFiles.analysisOverview, 'Analysis Overview', 'analysisOverview')}
          {uploadedFiles.analysisDetail && renderFileList(uploadedFiles.analysisDetail, 'Analysis Detail', 'analysisDetail')}
          {uploadedFiles.replayOverview && renderFileList(uploadedFiles.replayOverview, 'Replay Overview', 'replayOverview')}
          {uploadedFiles.replayDetail && renderFileList(uploadedFiles.replayDetail, 'Replay Detail', 'replayDetail')}
          {uploadedFiles.eventLog && renderFileList(uploadedFiles.eventLog, 'Event Log', 'eventLog')}
          {uploadedFiles.alignedLog && renderFileList(uploadedFiles.alignedLog, 'Aligned Log', 'alignedLog')}
        </div>
      </div>

      <div className="upload-actions">
        <button
          className={`next-button ${canProceed ? 'enabled' : 'disabled'}`}
          onClick={onNext}
          disabled={!canProceed}
        >
          Continue to Analysis
        </button>
      </div>
    </div>
  );
};

export default FileUpload; 