import { 
  DeclareConstraint, 
  ConstraintStatistics, 
  TraceStatistics,
  ProcessCase, 
  ProcessEvent,
  AlignedCase,
  DashboardConstraint,
  DashboardTrace,
  DashboardOverview,
  ModelVisualization,
  ActivityNode,
  ConstraintEdge,
  ConstraintGroup,
  TraceConstraintDetail
} from '../types';
import { parseDeclareConstraint, getConstraintSeverity, getConstraintColor } from './declareParser';
import { XMLParser } from 'fast-xml-parser';

// Utility to normalize constraint IDs by stripping trailing []
function normalizeConstraintId(id: string): string {
  return id.replace(/(\[\])*$/g, '');
}

// Map template name variations to DECLARE display names (with spaces)
function mapTemplateName(templateName: string): string {
  const nameMap: Record<string, string> = {
    'alternate succession': 'Alternate Succession',
    'chain succession': 'Chain Succession',
    'alternate response': 'Alternate Response',
    'alternate precedence': 'Alternate Precedence',
    'chain response': 'Chain Response',
    'chain precedence': 'Chain Precedence',
    'not succession': 'Not Succession',
    'not chain succession': 'Not Chain Succession',
    'absence2': 'Absence2',
    'absence3': 'Absence3',
    'exactly1': 'Exactly1',
    'existence': 'Existence',
    'succession': 'Succession',
    'response': 'Response',
    'precedence': 'Precedence',
    'init': 'Init'
  };
  return nameMap[templateName.toLowerCase()] || templateName;
}

// Map constraint ID from CSV format to DECLARE model format
function mapConstraintIdFromCsv(csvId: string): string {
  // Match template name and everything inside the first [...] (including commas)
  const match = csvId.match(/^([^:]+):\s*\[([\s\S]+?)\](?:\[\])*$/);
  if (match) {
    const templateName = match[1].trim();
    let activities = match[2].replace(/\]\s*,\s*\[/g, ', '); // merge [A], [B] to A, B
    // Remove any stray brackets
    activities = activities.replace(/[\[\]]/g, '');
    const displayTemplate = mapTemplateName(templateName);
    return `${displayTemplate}[${activities}]`;
  }
  return normalizeConstraintId(csvId);
}

// Build constraint-level grouping and statistics from traceConstraintMap
export function buildConstraintLevelDetail(traceConstraintMap: Map<string, Map<string, string[]>>) {
  // Map<constraintId, Map<traceId, string[]>>
  const constraintTraceMap = new Map();
  // Map<constraintId, { fulfilment: n, violation: m, traces: Set<traceId>, violatingTraces: Set<traceId> }>
  const constraintStatsMap = new Map();

  for (const [traceId, constraintMap] of Array.from(traceConstraintMap.entries())) {
    for (const [constraintId, resultTypes] of Array.from(constraintMap.entries())) {
      // Group traces by constraint
      if (!constraintTraceMap.has(constraintId)) {
        constraintTraceMap.set(constraintId, new Map());
      }
      constraintTraceMap.get(constraintId).set(traceId, resultTypes);

      // Count result types for stats
      if (!constraintStatsMap.has(constraintId)) {
        constraintStatsMap.set(constraintId, {
          fulfilment: 0,
          violation: 0,
          traces: new Set(),
          violatingTraces: new Set()
        });
      }
      const stats = constraintStatsMap.get(constraintId);
      let hasViolation = false;
      for (const type of resultTypes) {
        if (type === 'fulfillment' || type === 'vac. fulfillment') {
          stats.fulfilment++;
        }
        else if (type === 'violation' || type === 'vac. violation') {
          stats.violation++;
          hasViolation = true;
        }
      }
      stats.traces.add(traceId);
      if (hasViolation) {
        stats.violatingTraces.add(traceId);
      }
    }
  }
  // Convert Set to Array for serialization
  for (const stats of Array.from(constraintStatsMap.values())) {
    stats.traces = Array.from(stats.traces);
    stats.violatingTraces = Array.from(stats.violatingTraces);
  }
  return { constraintTraceMap, constraintStatsMap };
}

export class DataProcessor {
  
  // Parse DECLARE model file
  static parseDeclareModel(modelText: string): DeclareConstraint[] {
    const constraints: DeclareConstraint[] = [];
    const lines = modelText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('//') && !trimmedLine.startsWith('#')) {
        // Handle DECLARE format with | separators
        if (trimmedLine.includes('|')) {
          const parts = trimmedLine.split('|').map(part => part.trim()).filter(Boolean);
          if (parts.length > 0) {
            const constraintString = parts[0];
            const constraint = parseDeclareConstraint(constraintString);
            if (constraint) {
              constraints.push(constraint);
            }
          }
        } else {
          // Handle simple constraint format
          const constraint = parseDeclareConstraint(trimmedLine);
          if (constraint) {
            constraints.push(constraint);
          }
        }
      }
    }
    
    return constraints;
  }

  // Parse analysis overview CSV to get constraint-level statistics
  static parseAnalysisOverview(analysisText: string): ConstraintStatistics[] {
    const stats: ConstraintStatistics[] = [];
    const lines = analysisText.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      if (values.length >= 6) {
        const csvConstraintId = values[0];
        const constraintId = mapConstraintIdFromCsv(csvConstraintId);
        const activations = parseInt(values[1]) || 0;
        const fulfilments = parseInt(values[2]) || 0;
        const violations = parseInt(values[3]) || 0;
        const vacuousFulfilments = parseInt(values[4]) || 0;
        const vacuousViolations = parseInt(values[5]) || 0;
        
        // Aggregate vacuous fulfilments and violations into total fulfilments and violations
        const totalFulfilments = fulfilments + vacuousFulfilments;
        const totalViolations = violations + vacuousViolations;
        const violationRate = activations > 0 ? totalViolations / activations : 0;
        const severity = getConstraintSeverity(violationRate);
        
        
        stats.push({
          constraintId,
          activations,
          fulfilments: totalFulfilments,
          violations: totalViolations,
          violationRate,
          severity
        });
      }
    }
    
    return stats;
  }

  // Parse replay overview CSV to get trace-level statistics
  static parseReplayOverview(replayText: string): TraceStatistics[] {
    const stats: TraceStatistics[] = [];
    const lines = replayText.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      if (values.length >= 4) {
        const caseId = values[0];
        const insertions = parseInt(values[1]) || 0;
        const deletions = parseInt(values[2]) || 0;
        const fitness = parseFloat(values[3]) || 0;
        
        stats.push({
          caseId,
          fitness,
          insertions,
          deletions
        });
      }
    }
    
    return stats;
  }

  // Parse analysis detail CSV to get trace-constraint mappings
  static parseAnalysisDetail(detailText: string): Map<string, Map<string, string[]>> {
    const traceConstraintMap = new Map<string, Map<string, string[]>>();
    const lines = detailText.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      if (values.length >= 3) {
        const caseId = values[0];
        const csvConstraintId = values[1];
        const constraintId = mapConstraintIdFromCsv(csvConstraintId);
        const resultType = values[2];
        
        if (!traceConstraintMap.has(caseId)) {
          traceConstraintMap.set(caseId, new Map());
        }
        
        const constraintMap = traceConstraintMap.get(caseId)!;
        if (!constraintMap.has(constraintId)) {
          constraintMap.set(constraintId, []);
        }
        
        constraintMap.get(constraintId)!.push(resultType);
      }
    }
    
    return traceConstraintMap;
  }

  // Parse XES event log using proper XML parser
  static parseEventLog(eventLogText: string): ProcessCase[] {
    const cases: ProcessCase[] = [];
    
    try {
      // Configure XML parser for XES format
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        parseAttributeValue: true,
        parseTagValue: true,
        trimValues: true
      });
      
      // Parse the XML
      const parsed = parser.parse(eventLogText);
      
      // Handle both single trace and multiple traces
      const traces = Array.isArray(parsed.log?.trace) ? parsed.log.trace : (parsed.log?.trace ? [parsed.log.trace] : []);
      
      for (const trace of traces) {
        // Extract case ID from concept:name
        let caseId = `case_${Date.now()}_${Math.random()}`;
        if (trace['string']) {
          const conceptName = Array.isArray(trace['string']) 
            ? trace['string'].find((s: any) => s['@_key'] === 'concept:name')
            : trace['string'];
          if (conceptName && conceptName['@_value']) {
            caseId = conceptName['@_value'];
          }
        }
        
        const events: ProcessEvent[] = [];
        
        // Handle both single event and multiple events
        const traceEvents = Array.isArray(trace.event) ? trace.event : (trace.event ? [trace.event] : []);
        
        for (const event of traceEvents) {
          const eventStrings = Array.isArray(event.string) ? event.string : (event.string ? [event.string] : []);

          const getStringValue = (key: string): string | undefined => {
            const attribute = eventStrings.find((s: any) => s['@_key'] === key);
            return attribute ? attribute['@_value'] : undefined;
          };

          const activity = getStringValue('concept:name') || 'Unknown';
          const resource = getStringValue('org:group');
          
          // Extract timestamp
          let timestamp = new Date().toISOString();
          if (event['date']) {
            const timeDate = Array.isArray(event['date']) 
              ? event['date'].find((d: any) => d['@_key'] === 'time:timestamp')
              : event['date'];
            if (timeDate && timeDate['@_value']) {
              timestamp = timeDate['@_value'];
            }
          }
          
          const processEvent: ProcessEvent = {
            id: `event_${Date.now()}_${Math.random()}`,
            activity,
            timestamp,
            resource
          };
          
          events.push(processEvent);
        }
        
        if (events.length > 0) {
          const processCase: ProcessCase = {
            caseId,
            events
          };
          cases.push(processCase);
        }
      }
      
    } catch (error) {
      
      // Fallback to old regex-based parsing for backward compatibility
      return this.parseEventLogLegacy(eventLogText);
    }
    
    return cases;
  }

  // Legacy regex-based parsing as fallback
  private static parseEventLogLegacy(eventLogText: string): ProcessCase[] {
    const cases: ProcessCase[] = [];
    const lines = eventLogText.split('\n');
    let currentCase: ProcessCase | null = null;
    
    for (const line of lines) {
      if (line.includes('<trace')) {
        // Save previous case
        if (currentCase && currentCase.events.length > 0) {
          cases.push(currentCase);
        }
        
        // Start new case
        const match = line.match(/id="([^"]+)"/);
        const caseId = match ? match[1] : `case_${Date.now()}`;
        currentCase = { caseId, events: [] };
      } else if (line.includes('<event') && currentCase) {
        const activityMatch = line.match(/activity="([^"]+)"/);
        const timestampMatch = line.match(/timestamp="([^"]+)"/);
        const resourceMatch = line.match(/resource="([^"]+)"/);
        
        if (activityMatch) {
          const event = {
            id: `event_${Date.now()}_${Math.random()}`,
            activity: activityMatch[1],
            timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString(),
            resource: resourceMatch ? resourceMatch[1] : undefined
          };
          currentCase.events.push(event);
        }
      }
    }
    
    // Add last case
    if (currentCase && currentCase.events.length > 0) {
      cases.push(currentCase);
    }
    
    return cases;
  }

  // Parse aligned log using XML parser
  static parseAlignedLog(alignedLogText: string): AlignedCase[] {
    const cases: AlignedCase[] = [];
    
    try {
      // Configure XML parser for XES format
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        parseAttributeValue: true,
        parseTagValue: true,
        trimValues: true
      });
      
      // Parse the XML
      const parsed = parser.parse(alignedLogText);
      
      // Handle both single trace and multiple traces
      const traces = Array.isArray(parsed.log?.trace) ? parsed.log.trace : (parsed.log?.trace ? [parsed.log.trace] : []);
      
      for (const trace of traces) {
        // Extract case ID from concept:name
        let caseId = `case_${Date.now()}_${Math.random()}`;
        if (trace['string']) {
          const conceptName = Array.isArray(trace['string']) 
            ? trace['string'].find((s: any) => s['@_key'] === 'concept:name')
            : trace['string'];
          if (conceptName && conceptName['@_value']) {
            caseId = conceptName['@_value'];
          }
        }
        
        const events: any[] = [];
        
        // Handle both single event and multiple events
        const traceEvents = Array.isArray(trace.event) ? trace.event : (trace.event ? [trace.event] : []);
        
        for (const event of traceEvents) {
          // Helper to get string values from child elements
          const getStringValueFromChildren = (key: string): string | undefined => {
            if (!event.string) return undefined;
            const eventStrings = Array.isArray(event.string) ? event.string : [event.string];
            const attribute = eventStrings.find((s: any) => s['@_key'] === key);
            return attribute ? attribute['@_value'] : undefined;
          };

          // For aligned logs, we expect original/aligned/type, but if not found, treat as regular event log
          let originalActivity = getStringValueFromChildren('original');
          let alignedActivity = getStringValueFromChildren('aligned');
          let eventType = getStringValueFromChildren('type');
          
          // If no alignment data found, treat as regular event log
          if (!originalActivity && !alignedActivity && !eventType) {
            originalActivity = getStringValueFromChildren('concept:name') || 'Unknown';
            alignedActivity = originalActivity; // Same as original for regular events
            eventType = 'complete'; // Default type for regular events
          }
          
          // Extract timestamp from child <date> element or from attribute
          let timestamp = new Date().toISOString();
          if (event.date) {
            const timeDate = Array.isArray(event.date) 
              ? event.date.find((d: any) => d['@_key'] === 'time:timestamp')
              : event.date;
            if (timeDate && timeDate['@_value']) {
              timestamp = timeDate['@_value'];
            }
          } else if (event['@_timestamp']) {
            timestamp = event['@_timestamp'];
          }
          
          const alignedEvent: any = {
            timestamp
          };
          
          if (originalActivity) alignedEvent.originalActivity = originalActivity;
          if (alignedActivity) alignedEvent.alignedActivity = alignedActivity;
          if (eventType) alignedEvent.type = eventType;
          
          events.push(alignedEvent);
        }
        
        if (events.length > 0) {
          const alignedCase: AlignedCase = {
            caseId,
            events
          };
          cases.push(alignedCase);
        }
      }
      
    } catch (error) {
      
      // Fallback to old regex-based parsing for backward compatibility
      return this.parseAlignedLogLegacy(alignedLogText);
    }
    
    return cases;
  }

  // Legacy regex-based parsing for aligned log as fallback
  private static parseAlignedLogLegacy(alignedLogText: string): AlignedCase[] {
    const cases: AlignedCase[] = [];
    const lines = alignedLogText.split('\n');
    let currentCase: AlignedCase | null = null;
    
    for (const line of lines) {
      if (line.includes('<trace')) {
        // Save previous case
        if (currentCase && currentCase.events.length > 0) {
          cases.push(currentCase);
        }
        
        // Start new case
        const match = line.match(/id="([^"]+)"/);
        const caseId = match ? match[1] : `case_${Date.now()}`;
        currentCase = { caseId, events: [] };
      } else if (line.includes('<event') && currentCase) {
        const originalMatch = line.match(/original="([^"]*)"/);
        const alignedMatch = line.match(/aligned="([^"]*)"/);
        const typeMatch = line.match(/type="([^"]+)"/);
        const timestampMatch = line.match(/timestamp="([^"]+)"/);
        
        const event: any = {
          timestamp: timestampMatch ? timestampMatch[1] : new Date().toISOString()
        };
        
        if (originalMatch) event.originalActivity = originalMatch[1];
        if (alignedMatch) event.alignedActivity = alignedMatch[1];
        if (typeMatch) event.type = typeMatch[1];
        
        currentCase.events.push(event);
      }
    }
    
    // Add last case
    if (currentCase && currentCase.events.length > 0) {
      cases.push(currentCase);
    }
    
    return cases;
  }

  // Combine all data for dashboard
  static processData(
    constraints: DeclareConstraint[],
    analysisOverview: ConstraintStatistics[],
    replayOverview: TraceStatistics[],
    analysisDetail: Map<string, Map<string, string[]>>,
    eventLog: ProcessCase[],
    alignedLog: AlignedCase[],
    taggedConstraints?: DashboardConstraint[]
  ): {
    dashboardConstraints: DashboardConstraint[];
    dashboardTraces: DashboardTrace[];
    overview: DashboardOverview;
    modelVisualization: ModelVisualization;
    constraintGroups: ConstraintGroup[];
  } {
    
    // Create constraint statistics map
    const constraintStatsMap = new Map<string, ConstraintStatistics>();
    analysisOverview.forEach(stat => {
      constraintStatsMap.set(stat.constraintId, stat);
    });
    
    // Create event log map
    const eventLogMap = new Map<string, ProcessEvent[]>();
    eventLog.forEach(case_ => {
      eventLogMap.set(case_.caseId, case_.events);
    });
    
    // Create aligned log map
    const alignedLogMap = new Map<string, any[]>();
    alignedLog.forEach(case_ => {
      alignedLogMap.set(case_.caseId, case_.events);
    });

    // Build constraint-level grouping and statistics from traceConstraintMap
    const constraintLevelDetail = buildConstraintLevelDetail(analysisDetail);
    // Now you have constraintLevelDetail.constraintTraceMap and constraintLevelDetail.constraintStatsMap for UI use
    
    // Build dashboard constraints using the new constraint-level statistics
    const dashboardConstraints: DashboardConstraint[] = constraints.map(constraint => {
      // Use the new constraint-level statistics instead of analysisOverview
      const newStats = constraintLevelDetail.constraintStatsMap.get(constraint.id);
      
      // Find tagged constraint if available
      const taggedConstraint = taggedConstraints?.find(tc => tc.id === constraint.id);
      
      if (newStats) {
        const totalActivations = newStats.fulfilment + newStats.violation;
        const totalFulfilments = newStats.fulfilment;
        const totalViolations = newStats.violation;
        const violationRate = totalActivations > 0 ? totalViolations / totalActivations : 0;
        const severity = getConstraintSeverity(violationRate);
        
        return {
          ...constraint,
          statistics: {
            constraintId: constraint.id,
            activations: totalActivations,
            fulfilments: totalFulfilments,
            violations: totalViolations,
            violationRate: violationRate,
            severity: severity
          },
          violationCount: totalViolations,
          fulfilmentCount: totalFulfilments,
          violationRate: violationRate,
          severity: severity,
          tag: taggedConstraint?.tag || {
            priority: 'MEDIUM',
            quality: false,
            efficiency: false,
            compliance: false,
          }
        };
      } else {
        // If no stats found, create default stats
        return {
          ...constraint,
          statistics: {
            constraintId: constraint.id,
            activations: 0,
            fulfilments: 0,
            violations: 0,
            violationRate: 0,
            severity: 'LOW' as const
          },
          violationCount: 0,
          fulfilmentCount: 0,
          violationRate: 0,
          severity: 'LOW' as const,
          tag: taggedConstraint?.tag || {
            priority: 'MEDIUM',
            quality: false,
            efficiency: false,
            compliance: false,
          }
        };
      }
    });
    
    // Build dashboard traces by combining replay and analysis data
    const dashboardTraces: DashboardTrace[] = replayOverview.map(replay => {
      const events = eventLogMap.get(replay.caseId) || [];
      const alignedEvents = alignedLogMap.get(replay.caseId) || [];
      
      // Get analysis detail for this trace
      const traceAnalysis = analysisDetail.get(replay.caseId) || new Map();
      
      // Calculate trace-level statistics from analysis detail
      let activations = 0;
      let fulfilments = 0;
      let violations = 0;
      const violatedConstraints: string[] = [];
      const fulfilledConstraints: string[] = [];
      const constraintDetails: TraceConstraintDetail[] = [];
      
      traceAnalysis.forEach((resultTypes, constraintId) => {
        let constraintActivations = 0;
        let constraintFulfilments = 0;
        let constraintViolations = 0;
        
        resultTypes.forEach((resultType: string) => {
          switch (resultType) {
            case 'fulfillment':
            case 'vac. fulfillment':
              fulfilments += 1;
              constraintFulfilments += 1;
              if (resultType === 'fulfillment') {
                fulfilledConstraints.push(mapConstraintIdFromCsv(constraintId));
              }
              break;
            case 'violation':
            case 'vac. violation':
              violations += 1;
              constraintViolations += 1;
              if (resultType === 'violation') {
                violatedConstraints.push(mapConstraintIdFromCsv(constraintId));
              }
              break;
          }
          activations += 1;
          constraintActivations += 1;
        });
        
        // Create detailed constraint analysis for this trace
        constraintDetails.push({
          constraintId: mapConstraintIdFromCsv(constraintId), // Ensure constraintId is in DECLARE format
          resultTypes,
          totalActivations: constraintActivations,
          totalFulfilments: constraintFulfilments,
          totalViolations: constraintViolations
        });
      });
      
      return {
        caseId: replay.caseId,
        fitness: replay.fitness,
        insertions: replay.insertions,
        deletions: replay.deletions,
        activations,
        fulfilments,
        violations,
        violatedConstraints: Array.from(new Set(violatedConstraints)),
        fulfilledConstraints: Array.from(new Set(fulfilledConstraints)),
        events,
        alignedEvents,
        constraintDetails
      };
    });
    
    // Calculate overview KPIs
    const totalTraces = dashboardTraces.length;
    const totalConstraints = dashboardConstraints.length;
    
    // Calculate total variants (unique activity sequences)
    const activitySequences = new Set<string>();
    dashboardTraces.forEach(trace => {
      if (trace.events && trace.events.length > 0) {
        const sequence = trace.events.map(e => e.activity).join(' → ');
        activitySequences.add(sequence);
      }
    });
    const totalVariants = activitySequences.size;
    
    const overview: DashboardOverview = {
      totalTraces,
      totalVariants,
      totalConstraints,
      overallFitness: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => sum + t.fitness, 0) / totalTraces : 0,
      overallConformance: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => {
        return sum + (t.violations === 0 ? 1 : 0);
      }, 0) / totalTraces : 0,
      overallCompliance: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => {
        // Get compliance-tagged constraints that this trace violates
        const complianceConstraints = dashboardConstraints.filter(c => c.tag?.compliance);
        const violatedComplianceConstraints = complianceConstraints.filter(c => 
          t.violatedConstraints.includes(c.id)
        );
        return sum + (violatedComplianceConstraints.length === 0 ? 1 : 0);
      }, 0) / totalTraces : 0,
      overallQuality: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => {
        // Get quality-tagged constraints that this trace violates
        const qualityConstraints = dashboardConstraints.filter(c => c.tag?.quality);
        const violatedQualityConstraints = qualityConstraints.filter(c => 
          t.violatedConstraints.includes(c.id)
        );
        return sum + (violatedQualityConstraints.length === 0 ? 1 : 0);
      }, 0) / totalTraces : 0,
      overallEfficiency: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => {
        // Get efficiency-tagged constraints that this trace violates
        const efficiencyConstraints = dashboardConstraints.filter(c => c.tag?.efficiency);
        const violatedEfficiencyConstraints = efficiencyConstraints.filter(c => 
          t.violatedConstraints.includes(c.id)
        );
        return sum + (violatedEfficiencyConstraints.length === 0 ? 1 : 0);
      }, 0) / totalTraces : 0,
      criticalViolations: dashboardConstraints.filter(c => c.tag?.priority === 'CRITICAL' && c.violationCount > 0).length,
      highPriorityViolations: dashboardConstraints.filter(c => c.tag?.priority === 'HIGH' && c.violationCount > 0).length,
      averageInsertions: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => sum + t.insertions, 0) / totalTraces : 0,
      averageDeletions: totalTraces > 0 ? dashboardTraces.reduce((sum, t) => sum + t.deletions, 0) / totalTraces : 0
    };
    
    // Build model visualization
    const modelVisualization = this.buildModelVisualization(dashboardConstraints);
    
    // Build constraint groups
    const constraintGroups = this.buildConstraintGroups(dashboardConstraints);
    
    return {
      dashboardConstraints,
      dashboardTraces,
      overview,
      modelVisualization,
      constraintGroups
    };
  }

  // Build model visualization
  private static buildModelVisualization(constraints: DashboardConstraint[]): ModelVisualization {
    const activities = new Set<string>();
    const activityNodes: ActivityNode[] = [];
    const constraintEdges: ConstraintEdge[] = [];
    
    // Collect all activities
    constraints.forEach(constraint => {
      constraint.activities.forEach(activity => activities.add(activity));
    });
    
    // Create activity nodes with improved positioning and dynamic sizing
    const activityArray = Array.from(activities);
    const baseHeight = 60; // Fixed height
    const minWidth = 100; // Minimum width
    const padding = 20; // Padding for text
    const spacing = 200; // Increased spacing for rectangles
    const cols = Math.ceil(Math.sqrt(activityArray.length));
    
    activityArray.forEach((activity, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      // Calculate dynamic width based on text length
      const textWidth = activity.length * 8; // Approximate character width
      const width = Math.max(minWidth, textWidth + padding);
      
      const node: ActivityNode = {
        id: activity,
        name: activity,
        position: { 
          x: col * spacing + 80, 
          y: row * spacing + 80 
        },
        size: baseHeight, // Use height as the size property
        width: width, // Add width property
        color: '#3498db' // Better color
      };
      activityNodes.push(node);
    });
    
    // Create constraint edges for multi-activity constraints
    constraints.forEach((constraint, index) => {
      if (constraint.activities.length >= 2) {
        const source = constraint.activities[0];
        const target = constraint.activities[1];
        
        // Find the source and target nodes
        const sourceNode = activityNodes.find(n => n.id === source);
        const targetNode = activityNodes.find(n => n.id === target);
        
        if (sourceNode && targetNode) {
          const edge: ConstraintEdge = {
            id: `edge_${index}`,
            source,
            target,
            constraint,
            violationCount: constraint.violationCount,
            color: getConstraintColor(constraint.severity),
            thickness: Math.max(1, Math.min(8, constraint.violationCount / 3)) // Better thickness calculation
          };
          constraintEdges.push(edge);
        }
      }
    });
    
    // Add single-activity constraints as self-loops or special indicators
    constraints.forEach((constraint, index) => {
      if (constraint.activities.length === 1) {
        const activity = constraint.activities[0];
        const activityNode = activityNodes.find(n => n.id === activity);
        
        if (activityNode) {
          // Create a self-loop edge for single-activity constraints
          const edge: ConstraintEdge = {
            id: `single_${index}`,
            source: activity,
            target: activity,
            constraint,
            violationCount: constraint.violationCount,
            color: getConstraintColor(constraint.severity),
            thickness: Math.max(1, Math.min(6, constraint.violationCount / 2)),
            isSelfLoop: true
          };
          constraintEdges.push(edge);
        }
      }
    });
    
    return {
      activities: activityNodes,
      constraints: constraintEdges
    };
  }

  // Build constraint groups
  private static buildConstraintGroups(constraints: DashboardConstraint[]): ConstraintGroup[] {
    const groups: ConstraintGroup[] = [];
    
    // Group by constraint type
    const typeGroups = new Map<string, DashboardConstraint[]>();
    constraints.forEach(constraint => {
      if (!typeGroups.has(constraint.type)) {
        typeGroups.set(constraint.type, []);
      }
      typeGroups.get(constraint.type)!.push(constraint);
    });
    
    // Create groups
    typeGroups.forEach((constraints, type) => {
      const totalViolations = constraints.reduce((sum, c) => sum + c.violationCount, 0);
      const totalFulfilments = constraints.reduce((sum, c) => sum + c.fulfilmentCount, 0);
      const averageViolationRate = constraints.reduce((sum, c) => sum + c.violationRate, 0) / constraints.length;
      const severity = getConstraintSeverity(averageViolationRate);
      
      groups.push({
        id: `group_${type}`,
        name: `${type} Constraints`,
        constraints,
        totalViolations,
        totalFulfilments,
        averageViolationRate,
        severity
      });
    });
    
    return groups;
  }
} 