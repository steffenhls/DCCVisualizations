# DCC Visualization - Data Model Visualization

## 📊 Overall Data Flow

```
┌─────────────────┐    ┌────────────────────┐    ┌────────────────────┐
│   Input Files   │    │   Data Processor   │    │   Dashboard Data   │
│                 │    │                    │    │                    │
│ • DECLARE Model │───▶│ • Parse & Map IDs  │───▶│ • Constraints      │
│ • Analysis CSV  │    │ • Combine Data     │    │ • Traces           │
│ • Replay CSV    │    │ • Calculate KPIs   │    │ • Overview         │
│ • XES Logs      │    │ • Build Viz/Groups │    │ • Visualizations   │
└─────────────────┘    └────────────────────┘    └────────────────────┘
```

## 🏗️ Core Data Structures

### 1. **DeclareConstraint** (Base Constraint)
```typescript
interface DeclareConstraint {
  id: string;           // e.g. "Response[Register, Approve]" (may include time info)
  type: string;         // "Response", "Precedence", etc.
  activities: string[]; // ["Register", "Approve"]
  description: string;  // Template description
  helpText: string;     // Dynamic help text with activity names
}
```

### 2. **ConstraintStatistics** (Analysis Results)
```typescript
interface ConstraintStatistics {
  constraintId: string;        // Links to DeclareConstraint.id
  activations: number;         // How many times constraint was activated
  fulfilments: number;         // How many times constraint was fulfilled
  violations: number;          // How many times constraint was violated
  violationRate: number;       // Calculated violation rate
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

### 3. **TraceStatistics** (Replay Results)
```typescript
interface TraceStatistics {
  caseId: string;      // "Case_001", ...
  fitness: number;     // 0.0 to 1.0
  insertions: number;  // Alignment insertions
  deletions: number;   // Alignment deletions
}
```

### 4. **ProcessEvent** (Event Log Data)
```typescript
interface ProcessEvent {
  id: string;          // Unique event ID
  activity: string;    // Activity name
  timestamp: string;   // ISO timestamp
  resource?: string;   // Optional resource info
}
```

### 5. **ProcessCase** (Complete Trace)
```typescript
interface ProcessCase {
  caseId: string;
  events: ProcessEvent[];
}
```

## 🔄 Data Processing Pipeline

### Step 1: File Parsing & Mapping
```
DECLARE Model File (.decl)
├── parseDeclareModel() → DeclareConstraint[]
Analysis Overview CSV
├── parseAnalysisOverview() → ConstraintStatistics[]
Replay Overview CSV
├── parseReplayOverview() → TraceStatistics[]
Analysis Detail CSV
├── parseAnalysisDetail() → Map<string, Map<string, string[]>>
XES Event Log
├── parseEventLog() → ProcessCase[]
Aligned Log (optional)
├── parseAlignedLog() → AlignedCase[]
```

### Step 2: Data Combination & Enrichment
```
processData() combines all data:
DeclareConstraint[] + ConstraintStatistics[] + TraceStatistics[] + ProcessCase[] + AlignedCase[] + analysisDetail
    │
    ▼
DashboardConstraint[] + DashboardTrace[] + DashboardOverview + ModelVisualization + ConstraintGroup[] + coViolationMatrix
```

## 🎯 Dashboard Data Structures

### **DashboardConstraint** (Enhanced Constraint)
```typescript
interface DashboardConstraint {
  // From DeclareConstraint
  id: string;
  type: string;
  activities: string[];
  description: string;
  helpText: string;
  // From ConstraintStatistics
  statistics: ConstraintStatistics;
  violationCount: number;
  fulfilmentCount: number;
  violationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isTimeConstraint?: boolean;
  // User-defined tags
  tag: {
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    quality: boolean;
    efficiency: boolean;
    compliance: boolean;
    group?: string;
  };
}
```

### **DashboardTrace** (Enhanced Trace)
```typescript
interface DashboardTrace {
  caseId: string;
  fitness: number;
  insertions: number;
  deletions: number;
  activations: number;
  fulfilments: number;
  violations: number;
  violatedConstraints: string[];
  fulfilledConstraints: string[];
  events: ProcessEvent[];
  alignedEvents: any[];
  constraintDetails: TraceConstraintDetail[];
}
```

### **DashboardOverview** (KPI Summary)
```typescript
interface DashboardOverview {
  totalTraces: number;
  totalVariants: number;
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

### **ConstraintGroup** (Grouping for Analysis)
```typescript
interface ConstraintGroup {
  id: string;
  name: string;
  constraints: DashboardConstraint[];
  totalViolations: number;
  totalFulfilments: number;
  averageViolationRate: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

## 🔗 Data Relationships

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            Data Relationships                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  DeclareConstraint.id ──────────┐                                          │
│                                 │                                          │
│  ConstraintStatistics.constraintId                                        │
│                                 │                                          │
│  DashboardConstraint.id ─────────┘                                          │
│                                 │                                          │
│  TraceStatistics.caseId ────────┐                                          │
│                                 │                                          │
│  ProcessCase.caseId ────────────┤                                          │
│                                 │                                          │
│  DashboardTrace.caseId ─────────┘                                          │
│                                 │                                          │
│  violatedConstraints[] ──────────┐                                         │
│                                 │                                          │
│  fulfilledConstraints[] ─────────┤                                         │
│                                 │                                          │
│  DashboardConstraint.id ─────────┘                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

## 📈 Data Flow in Components

### **FileUpload Component**
```
UploadedFiles {
  declarativeModel?: File;    // .decl file
  analysisOverview?: File;    // CSV with constraint stats
  analysisDetail?: File;      // CSV with trace-constraint mappings
  replayOverview?: File;      // CSV with trace fitness
  eventLog?: File;            // XES file
  alignedLog?: File;          // XES file with alignment
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
├── ModelVisualization (graph data)
├── ConstraintGroup[] (grouped constraints)
└── coViolationMatrix (matrix of co-violations)
```

## 🎨 Visualization Data

### **ModelVisualization** (Process Graph)
```typescript
interface ModelVisualization {
  activities: ActivityNode[];    // Nodes for activities
  constraints: ConstraintEdge[]; // Edges for constraints
}

interface ActivityNode {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: number;
  width?: number;
  color: string;
}

interface ConstraintEdge {
  id: string;
  source: string;
  target: string;
  constraint: DashboardConstraint;
  violationCount: number;
  color: string;
  thickness: number;
  isSelfLoop?: boolean;
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
│   ├── description: "If A occurs, then B must eventually occur"
│   └── helpText: "After Register occurs, Approve must eventually occur..."
│
└── DashboardConstraint
    ├── id: "Response[Register, Approve]"
    ├── violationCount: 15
    ├── fulfilmentCount: 85
    ├── violationRate: 0.15
    ├── severity: "MEDIUM"
    └── tag: { priority: 'MEDIUM', quality: false, efficiency: false, compliance: false }
```

### **Example 2: Trace Data**
```
Input: Case "A" with 10 events
├── ProcessCase
│   ├── caseId: "A"
│   └── events: [Event1, ..., Event10]
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
    ├── violatedConstraints: ["Absence2[Cancel]"]
    └── constraintDetails: [ ... ]
```

## 🧠 Template & Mapping Logic

- **Constraint templates** are defined in code and mapped by name (e.g., "Alternate Succession" → "AlternateSuccession").
- **Constraint IDs** are normalized and mapped from CSV to DECLARE format, including time info if present.
- **Dynamic helpText** and descriptions are generated per constraint and activities.
- **Severity** and **color** are computed based on violation rates.
- **Groups** and **co-violation matrix** are built for advanced analysis and visualization.

This data model enables comprehensive process conformance analysis by combining declarative constraint definitions with event log analysis to provide insights into process quality, efficiency, and compliance. 