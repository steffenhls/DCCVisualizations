# Declarative Conformance Checking Frontend

This project is an interactive web application for **declarative conformance checking**—a modern approach to analyzing how real-world process executions (event logs) comply with flexible, rule-based process models (DECLARE). The app empowers users to upload, tag, and analyze declarative process models and their conformance results, providing deep insights into process quality, compliance, and efficiency.

---

## What is Declarative Conformance Checking?

Declarative conformance checking is a process mining technique that evaluates how well observed behavior (event logs) aligns with **declarative process models**. Unlike rigid, flowchart-like models, declarative models (such as those in the DECLARE language) specify **rules and constraints** (e.g., “If A happens, B must eventually follow”) rather than strict sequences. This approach is ideal for flexible, knowledge-intensive domains.

The app supports:
- **Uploading DECLARE models** (rules/constraints in `.decl` files)
- **Uploading conformance analysis results** (CSV, XES, etc.)
- **Visualizing constraints and their fulfillment/violation statistics**
- **Tagging constraints** by business relevance (quality, efficiency, compliance, priority)
- **Exploring violations, fulfillments, and process variants interactively**

---

## Core Workflow

1. **Upload Files**
   - DECLARE model (`.decl`)
   - Analysis results (overview/detail CSVs, event logs in `.xes`)
2. **Constraint Tagging**
   - Assign business tags (priority, quality, efficiency, compliance) to each constraint
   - Group constraints for focused analysis
3. **Analysis Dashboard**
   - Visualize the process model and constraints
   - Explore statistics: activations, fulfillments, violations, violation rates
   - Filter and sort constraints by tags, priority, or performance
   - Drill down into traces, variants, and co-violation patterns

---

## Key Features

- **Model-Driven Visualization:** Interactive graph of DECLARE constraints using Cytoscape and ReactFlow.
- **Rich Tagging:** Tag constraints with business dimensions and priorities for targeted analysis.
- **Comprehensive Analysis:** View detailed statistics for each constraint and trace.
- **Flexible Filtering:** Filter constraints and traces by tags, violation rates, or business groupings.
- **User-Centric Workflow:** Step-by-step wizard guides users from file upload to deep analysis.

---

## File Types Supported

- **DECLARE Model:** `.decl` (constraint definitions)
- **Analysis Overview:** `.csv` (constraint-level statistics)
- **Analysis Detail:** `.csv` (trace-constraint mapping)
- **Event Log:** `.xes` (process execution data)
- **Aligned Log:** `.xes` (optional, for advanced alignment analysis)

---

## Getting Started

1. `cd frontend`
2. `npm install`
3. `npm start`
4. Open [http://localhost:3000](http://localhost:3000)

---

## Technologies

- **React** (UI)
- **Cytoscape.js** & **ReactFlow** (graph visualization)
- **Recharts** (charts)
- **Papaparse** (CSV parsing)
- **fast-xml-parser** (XES/XML parsing)

---

## The Big Idea

This project bridges the gap between **business rules** and **real-world process execution**. By making declarative conformance checking accessible and visual, it enables organizations to:
- Detect compliance and efficiency issues
- Prioritize improvements based on business impact
- Foster transparency in flexible, knowledge-driven processes 