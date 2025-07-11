# DCC Visualization - Data Model Visualization

## 📊 Overall Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Input Files   │    │  Data Processor │    │  Dashboard Data │
│                 │    │                 │    │                 │
│ • DECLARE Model │───▶│ • Parse Files   │───▶│ • Constraints   │
│ • Analysis CSV  │    │ • Combine Data  │    │ • Traces        │
│ • Replay CSV    │    │ • Calculate KPIs│    │ • Overview      │
│ • XES Logs      │    │ • Build Viz     │    │ • Visualizations│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🏗️ Core Data Structures

### 1. **DeclareConstraint** (Base Constraint)
```typescript
interface DeclareConstraint {
  id: string;           // "Absence2[Cancel]" or "Response[Register, Approve]"
  type: string;         // "Absence2", "Response", "Precedence", etc.
  activities: string[]; // ["Cancel"] or ["Register", "Approve"]
  description: string;  // "Cancel" or "Register → Approve" (with arrows)
  helpText: string;     // Detailed explanation with activity names
}
```

### 2. **ConstraintStatistics** (Analysis Results)
```typescript
interface ConstraintStatistics {
  constraintId: string;        // Links to DeclareConstraint.id
  activations: number;         // How many times constraint was activated
  fulfilments: number;         // How many times constraint was fulfilled
  violations: number;          // How many times constraint was violated
  vacuousFulfilments: number; // Vacuous fulfilments
  vacuousViolations: number;  // Vacuous violations
  violationRate: number;       // Calculated violation rate
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

### 3. **TraceStatistics** (Replay Results)
```typescript
interface TraceStatistics {
  caseId: string;      // "Case_001", "Case_002", etc.
  fitness: number;     // 0.0 to 1.0 (conformance fitness)
  insertions: number;  // Alignment insertions
  deletions: number;   // Alignment deletions
}
```

### 4. **ProcessEvent** (Event Log Data)
```typescript
interface ProcessEvent {
  id: string;          // Unique event ID
  activity: string;    // "Register", "Approve", etc.
  timestamp: string;   // ISO timestamp
  resource?: string;   // Optional resource info
}
```

### 5. **ProcessCase** (Complete Trace)
```typescript
interface ProcessCase {
  caseId: string;      // "Case_001"
  events: ProcessEvent[]; // Array of events in order
}
```

## 🔄 Data Processing Pipeline

### Step 1: File Parsing
```
DECLARE Model File (.decl)
├── parseDeclareModel()
└── DeclareConstraint[]

Analysis Overview CSV
├── parseAnalysisOverview()
└── ConstraintStatistics[]

Replay Overview CSV
├── parseReplayOverview()
└── TraceStatistics[]

XES Event Log
├── parseEventLog()
└── ProcessCase[]
```

### Step 2: Data Combination
```
processData() combines all data:

DeclareConstraint[] + ConstraintStatistics[] + TraceStatistics[] + ProcessCase[]
    │
    ▼
DashboardConstraint[] + DashboardTrace[] + DashboardOverview
```

## 🎯 Dashboard Data Structures

### **DashboardConstraint** (Enhanced Constraint)
```typescript
interface DashboardConstraint {
  // From DeclareConstraint
  id: string;           // "Absence 2 [Cancel]" (descriptive)
  type: string;         // "Absence2"
  activities: string[]; // ["Cancel"]
  description: string;  // "Cancel" (with arrows)
  helpText: string;     // Detailed explanation
  
  // From ConstraintStatistics
  statistics: ConstraintStatistics;
  violationCount: number;
  fulfilmentCount: number;
  violationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // User-defined tags
  tag: {
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    quality: boolean;
    efficiency: boolean;
    compliance: boolean;
  };
}
```

### **DashboardTrace** (Enhanced Trace)
```typescript
interface DashboardTrace {
  // From TraceStatistics
  caseId: string;
  fitness: number;
  insertions: number;
  deletions: number;
  
  // Calculated from analysis detail
  activations: number;
  fulfilments: number;
  violations: number;
  vacuousFulfilments: number;
  vacuousViolations: number;
  violatedConstraints: string[];  // Constraint IDs
  fulfilledConstraints: string[]; // Constraint IDs
  
  // From ProcessCase
  events: ProcessEvent[];
  alignedEvents: AlignedEvent[];
}
```

### **DashboardOverview** (KPI Summary)
```typescript
interface DashboardOverview {
  totalTraces: number;
  totalConstraints: number;
  overallFitness: number;
  overallConformance: number;
  overallCompliance: number;
  overallQuality: number;
  overallEfficiency: number;
  criticalViolations: number;
  highPriorityViolations: number;
  averageInsertions: number;
  averageDeletions: number;
}
```

## 🔗 Data Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                    Data Relationships                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DeclareConstraint.id ──────────┐                              │
│                                 │                              │
│  ConstraintStatistics.constraintId                              │
│                                 │                              │
│  DashboardConstraint.id ─────────┘                              │
│                                 │                              │
│  TraceStatistics.caseId ────────┐                              │
│                                 │                              │
│  ProcessCase.caseId ────────────┤                              │
│                                 │                              │
│  DashboardTrace.caseId ─────────┘                              │
│                                 │                              │
│  violatedConstraints[] ──────────┐                              │
│                                 │                              │
│  fulfilledConstraints[] ─────────┤                              │
│                                 │                              │
│  DashboardConstraint.id ─────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## 📈 Data Flow in Components

### **FileUpload Component**
```
UploadedFiles {
  declarativeModel?: File;    // .decl file
  analysisOverview?: File;    // CSV with constraint stats
  analysisDetail?: File;      // CSV with trace-constraint mappings
  replayOverview?: File;      // CSV with trace fitness
  eventLog?: File;           // XES file
  alignedLog?: File;         // XES file with alignment
}
```

### **ConstraintTagging Component**
```
Input: DashboardConstraint[]
Output: DashboardConstraint[] (with tags)
```

### **AnalysisDashboard Component**
```
Input: 
├── UploadedFiles
└── DashboardConstraint[] (tagged)

Output:
├── DashboardOverview (KPIs)
├── DashboardTrace[] (enhanced traces)
└── ModelVisualization (graph data)
```

## 🎨 Visualization Data

### **ModelVisualization** (Process Graph)
```typescript
interface ModelVisualization {
  activities: ActivityNode[];    // Nodes for activities
  constraints: ConstraintEdge[]; // Edges for constraints
}

interface ActivityNode {
  id: string;                    // Activity name
  name: string;                  // Display name
  position: { x: number; y: number };
  size: number;
  color: string;
}

interface ConstraintEdge {
  id: string;
  source: string;                // Activity ID
  target: string;                // Activity ID
  constraint: DashboardConstraint;
  violationCount: number;
  color: string;                 // Based on severity
  thickness: number;             // Based on violations
}
```

## 🔄 Data Transformation Examples

### **Example 1: Response Constraint**
```
Input: "Response[Register, Approve]"
├── DeclareConstraint
│   ├── id: "Response[Register, Approve]"
│   ├── type: "Response"
│   ├── activities: ["Register", "Approve"]
│   ├── description: "Register → Approve"
│   └── helpText: "After Register occurs, Approve must eventually occur..."
│
└── DashboardConstraint
    ├── id: "Response [Register → Approve]"
    ├── violationCount: 15
    ├── fulfilmentCount: 85
    ├── violationRate: 0.15
    └── severity: "MEDIUM"
```

### **Example 2: Trace Data**
```
Input: Case "A" with 10 events
├── ProcessCase
│   ├── caseId: "A"
│   └── events: [Event1, Event2, ..., Event10]
│
├── TraceStatistics
│   ├── caseId: "A"
│   ├── fitness: 0.85
│   ├── insertions: 2
│   └── deletions: 1
│
└── DashboardTrace
    ├── caseId: "A"
    ├── fitness: 0.85
    ├── violations: 3
    ├── fulfilledConstraints: ["Response[Register, Approve]"]
    └── violatedConstraints: ["Absence2[Cancel]"]
```

This data model enables comprehensive process conformance analysis by combining declarative constraint definitions with event log analysis to provide insights into process quality, efficiency, and compliance. 