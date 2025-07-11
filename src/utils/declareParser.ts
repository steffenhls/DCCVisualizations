import { DeclareConstraint } from '../types';

// DECLARE constraint templates
const DECLARE_TEMPLATES: Record<string, any> = {
  'Response': {
    name: 'Response',
    description: 'If A occurs, then B must eventually occur',
    formula: 'A → ◇B',
    visualRepresentation: 'A → B',
    examples: ['Response[A, B]', 'Response[Register, Approve]'],
    helpText: 'After activity A occurs, activity B must eventually occur in the same case.'
  },
  'Precedence': {
    name: 'Precedence',
    description: 'B can only occur if A has occurred before',
    formula: 'B → ◇A',
    visualRepresentation: 'A ← B',
    examples: ['Precedence[A, B]', 'Precedence[Register, Approve]'],
    helpText: 'Activity B can only occur if activity A has occurred before in the same case.'
  },
  'Succession': {
    name: 'Succession',
    description: 'A and B must occur in order',
    formula: 'A → ◇B ∧ B → ◇A',
    visualRepresentation: 'A ↔ B',
    examples: ['Succession[A, B]', 'Succession[Register, Approve]'],
    helpText: 'Activities A and B must occur in order: A must occur before B.'
  },
  'AlternateResponse': {
    name: 'Alternate Response',
    description: 'If A occurs, then B must eventually occur, but not immediately',
    formula: 'A → ◇B ∧ ¬(A → B)',
    visualRepresentation: 'A → B (alternate)',
    examples: ['AlternateResponse[A, B]', 'AlternateResponse[Register, Approve]'],
    helpText: 'After activity A occurs, activity B must eventually occur, but not immediately after A.'
  },
  'AlternatePrecedence': {
    name: 'Alternate Precedence',
    description: 'B can only occur if A has occurred before, but not immediately',
    formula: 'B → ◇A ∧ ¬(B → A)',
    visualRepresentation: 'A ← B (alternate)',
    examples: ['AlternatePrecedence[A, B]', 'AlternatePrecedence[Register, Approve]'],
    helpText: 'Activity B can only occur if activity A has occurred before, but not immediately before B.'
  },
  'ChainResponse': {
    name: 'Chain Response',
    description: 'If A occurs, then B must occur immediately after',
    formula: 'A → B',
    visualRepresentation: 'A → B (chain)',
    examples: ['ChainResponse[A, B]', 'ChainResponse[Register, Approve]'],
    helpText: 'After activity A occurs, activity B must occur immediately after.'
  },
  'ChainPrecedence': {
    name: 'Chain Precedence',
    description: 'B can only occur if A has occurred immediately before',
    formula: 'B → A',
    visualRepresentation: 'A ← B (chain)',
    examples: ['ChainPrecedence[A, B]', 'ChainPrecedence[Register, Approve]'],
    helpText: 'Activity B can only occur if activity A has occurred immediately before.'
  },
  'NotSuccession': {
    name: 'Not Succession',
    description: 'A and B cannot occur in order',
    formula: '¬(A → ◇B)',
    visualRepresentation: 'A ↛ B',
    examples: ['NotSuccession[A, B]', 'NotSuccession[Register, Approve]'],
    helpText: 'Activities A and B cannot occur in order: A cannot be followed by B.'
  },
  'NotChainSuccession': {
    name: 'Not Chain Succession',
    description: 'A and B cannot occur immediately in order',
    formula: '¬(A → B)',
    visualRepresentation: 'A ↛ B (chain)',
    examples: ['NotChainSuccession[A, B]', 'NotChainSuccession[Register, Approve]'],
    helpText: 'Activities A and B cannot occur immediately in order: A cannot be immediately followed by B.'
  },
  'Participation': {
    name: 'Participation',
    description: 'A must occur at least once',
    formula: '◇A',
    visualRepresentation: '◇A',
    examples: ['Participation[A]', 'Participation[Register]'],
    helpText: 'Activity A must occur at least once in the case.'
  },
  'Init': {
    name: 'Init',
    description: 'A must be the first activity',
    formula: 'A ∧ ¬(⊤ → A)',
    visualRepresentation: 'A (init)',
    examples: ['Init[A]', 'Init[Register]'],
    helpText: 'Activity A must be the first activity in the case.'
  },
  'End': {
    name: 'End',
    description: 'A must be the last activity',
    formula: 'A ∧ ¬(A → ⊤)',
    visualRepresentation: 'A (end)',
    examples: ['End[A]', 'End[Approve]'],
    helpText: 'Activity A must be the last activity in the case.'
  },
  'Existence': {
    name: 'Existence',
    description: 'A must occur exactly n times',
    formula: '◇A ∧ ¬(◇A ∧ ◇A)',
    visualRepresentation: '◇A (exactly once)',
    examples: ['Existence[A]', 'Existence[Register]'],
    helpText: 'Activity A must occur exactly once in the case.'
  },
  'Absence': {
    name: 'Absence',
    description: 'A must not occur',
    formula: '¬◇A',
    visualRepresentation: '¬A',
    examples: ['Absence[A]', 'Absence[Cancel]'],
    helpText: 'Activity A must not occur in the case.'
  },
  'Absence2': {
    name: 'Absence 2',
    description: 'A must not occur more than once',
    formula: '¬(◇A ∧ ◇A)',
    visualRepresentation: '¬◇A (max 1)',
    examples: ['Absence2[A]', 'Absence2[Cancel]'],
    helpText: 'Activity A must not occur more than once in the case.'
  },
  'Absence3': {
    name: 'Absence 3',
    description: 'A must not occur more than twice',
    formula: '¬(◇A ∧ ◇A ∧ ◇A)',
    visualRepresentation: '¬◇A (max 2)',
    examples: ['Absence3[A]', 'Absence3[Cancel]'],
    helpText: 'Activity A must not occur more than twice in the case.'
  },
  'Exactly1': {
    name: 'Exactly 1',
    description: 'A must occur exactly once',
    formula: '◇A ∧ ¬(◇A ∧ ◇A)',
    visualRepresentation: '◇A (exactly 1)',
    examples: ['Exactly1[A]', 'Exactly1[Register]'],
    helpText: 'Activity A must occur exactly once in the case.'
  },
  'AlternateSuccession': {
    name: 'Alternate Succession',
    description: 'A and B must alternate',
    formula: 'A → ◇B ∧ B → ◇A ∧ ¬(A → B) ∧ ¬(B → A)',
    visualRepresentation: 'A ↔ B (alternate)',
    examples: ['AlternateSuccession[A, B]', 'AlternateSuccession[Register, Approve]'],
    helpText: 'Activities A and B must alternate: A must be followed by B and B must be followed by A, but not immediately.'
  },
  'ChainSuccession': {
    name: 'Chain Succession',
    description: 'A and B must occur immediately in sequence',
    formula: 'A → B ∧ B → A',
    visualRepresentation: 'A ↔ B (chain)',
    examples: ['ChainSuccession[A, B]', 'ChainSuccession[Register, Approve]'],
    helpText: 'Activities A and B must occur immediately in sequence: A must be immediately followed by B and B must be immediately preceded by A.'
  },
  'CoExistence': {
    name: 'Co-Existence',
    description: 'A and B must occur together or not at all',
    formula: '◇A ↔ ◇B',
    visualRepresentation: 'A ↔ B',
    examples: ['CoExistence[A, B]', 'CoExistence[Register, Approve]'],
    helpText: 'Activities A and B must either both occur or both not occur in the case.'
  }
};

// Parse DECLARE constraint from string
export function parseDeclareConstraint(constraintString: string): DeclareConstraint | null {
  // Remove extra whitespace and normalize
  const normalized = constraintString.trim().replace(/\s+/g, ' ');
  
  // Remove trailing [][][] or similar from the end
  const idCleaned = normalized.replace(/(\[\])*$/g, '');
  
  // Match pattern: TemplateName[Activity1, Activity2, ...] with optional | separators
  // Updated regex to handle template names with spaces
  const match = normalized.match(/^([A-Za-z0-9\s]+)\[([^\]]+)\]/);
  
  if (!match) {
    return null;
  }
  
  const templateName = match[1].trim();
  const activitiesString = match[2];
  
  // Map template name variations to template keys
  const templateKey = mapTemplateName(templateName);
  
  // Get template
  const template = DECLARE_TEMPLATES[templateKey];
  if (!template) {
    console.warn(`Template not found for: "${templateName}" (mapped to: "${templateKey}")`);
    return null;
  }
  
  // Parse activities
  const activities = activitiesString.split(',').map(a => a.trim()).filter(Boolean);
  
  if (activities.length === 0) {
    return null;
  }
  
  // Generate dynamic help text with actual activity names
  const dynamicHelpText = generateDynamicHelpText(template, activities);
  
  return {
    id: idCleaned,
    type: templateKey, // Use the template key for consistency
    activities,
    helpText: dynamicHelpText,
    description: template.description
  };
}

// Map template name variations to template keys
function mapTemplateName(templateName: string): string {
  const nameMap: Record<string, string> = {
    'Alternate Succession': 'AlternateSuccession',
    'Chain Succession': 'ChainSuccession',
    'Alternate Response': 'AlternateResponse',
    'Alternate Precedence': 'AlternatePrecedence',
    'Chain Response': 'ChainResponse',
    'Chain Precedence': 'ChainPrecedence',
    'Not Succession': 'NotSuccession',
    'Not Chain Succession': 'NotChainSuccession',
    'Absence 2': 'Absence2',
    'Absence 3': 'Absence3',
    'Exactly 1': 'Exactly1'
  };
  
  return nameMap[templateName] || templateName;
}

// Generate dynamic help text with actual activity names
function generateDynamicHelpText(template: any, activities: string[]): string {
  const activityNames = activities.map(activity => formatActivityName(activity));
  
  switch (template.name) {
    case 'Response':
      return `After ${activityNames[0]} occurs, ${activityNames[1]} must eventually occur in the same case.`;
    case 'Precedence':
      return `${activityNames[1]} can only occur if ${activityNames[0]} has occurred before in the same case.`;
    case 'Succession':
      return `${activityNames[0]} and ${activityNames[1]} must occur in order: ${activityNames[0]} must occur before ${activityNames[1]}.`;
    case 'Alternate Response':
      return `After ${activityNames[0]} occurs, ${activityNames[1]} must eventually occur, but not immediately after ${activityNames[0]}.`;
    case 'Alternate Precedence':
      return `${activityNames[1]} can only occur if ${activityNames[0]} has occurred before, but not immediately before ${activityNames[1]}.`;
    case 'Chain Response':
      return `After ${activityNames[0]} occurs, ${activityNames[1]} must occur immediately after.`;
    case 'Chain Precedence':
      return `${activityNames[1]} can only occur if ${activityNames[0]} has occurred immediately before.`;
    case 'Not Succession':
      return `${activityNames[0]} and ${activityNames[1]} cannot occur in order: ${activityNames[0]} cannot be followed by ${activityNames[1]}.`;
    case 'Not Chain Succession':
      return `${activityNames[0]} and ${activityNames[1]} cannot occur immediately in order: ${activityNames[0]} cannot be immediately followed by ${activityNames[1]}.`;
    case 'Participation':
      return `${activityNames[0]} must occur at least once in the case.`;
    case 'Init':
      return `${activityNames[0]} must be the first activity in the case.`;
    case 'End':
      return `${activityNames[0]} must be the last activity in the case.`;
    case 'Existence':
      return `${activityNames[0]} must occur exactly once in the case.`;
    case 'Absence':
      return `${activityNames[0]} must not occur in the case.`;
    case 'Absence 2':
      return `${activityNames[0]} must not occur more than once in the case.`;
    case 'Absence 3':
      return `${activityNames[0]} must not occur more than twice in the case.`;
    case 'Exactly 1':
      return `${activityNames[0]} must occur exactly once in the case.`;
    case 'Alternate Succession':
      return `${activityNames[0]} and ${activityNames[1]} must alternate: ${activityNames[0]} must be followed by ${activityNames[1]} and ${activityNames[1]} must be followed by ${activityNames[0]}, but not immediately.`;
    case 'Chain Succession':
      return `${activityNames[0]} and ${activityNames[1]} must occur immediately in sequence: ${activityNames[0]} must be immediately followed by ${activityNames[1]} and ${activityNames[1]} must be immediately preceded by ${activityNames[0]}.`;
    case 'Co-Existence':
      return `${activityNames[0]} and ${activityNames[1]} must either both occur or both not occur in the case.`;
    default:
      return template.helpText;
  }
}

// Format activity name for better readability
function formatActivityName(activity: string): string {
  // Convert camelCase to Title Case with spaces
  return activity
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
}

// Get constraint severity based on violation rate
export function getConstraintSeverity(violationRate: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (violationRate >= 0.8) return 'CRITICAL';
  if (violationRate >= 0.6) return 'HIGH';
  if (violationRate >= 0.3) return 'MEDIUM';
  return 'LOW';
}

// Get constraint color based on severity
export function getConstraintColor(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string {
  switch (severity) {
    case 'CRITICAL': return '#f44336'; // Red
    case 'HIGH': return '#ff9800';     // Orange
    case 'MEDIUM': return '#ffeb3b';   // Yellow
    case 'LOW': return '#4caf50';      // Green
    default: return '#9e9e9e';         // Gray
  }
}

// Get all available templates
export function getAvailableTemplates(): any[] {
  return Object.values(DECLARE_TEMPLATES);
}

// Get template by name
export function getTemplateByName(name: string): any | null {
  return DECLARE_TEMPLATES[name] || null;
}

// Validate constraint string
export function validateConstraintString(constraintString: string): boolean {
  return parseDeclareConstraint(constraintString) !== null;
}

// Generate constraint description
export function generateConstraintDescription(constraint: DeclareConstraint): string {
  const { activities } = constraint;
  
  if (activities.length === 1) {
    return `${constraint.description.replace('A', activities[0])}`;
  } else if (activities.length === 2) {
    return constraint.description
      .replace('A', activities[0])
      .replace('B', activities[1]);
  } else {
    return `${constraint.type} constraint between ${activities.join(', ')}`;
  }
} 