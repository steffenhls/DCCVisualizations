// Test script to verify constraint parsing
const fs = require('fs');
const path = require('path');

// Mock the parseDeclareConstraint function (simplified version)
function parseDeclareConstraint(constraintString) {
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
  
  // Parse activities
  const activities = activitiesString.split(',').map(a => a.trim()).filter(Boolean);
  
  if (activities.length === 0) {
    return null;
  }
  
  return {
    id: idCleaned,
    type: templateKey,
    activities,
    originalString: constraintString
  };
}

// Map template name variations to template keys
function mapTemplateName(templateName) {
  const nameMap = {
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

// Test constraint ID mapping
function mapConstraintIdFromCsv(csvId) {
  // Handle format like "absence2: [Admission IC]" -> "Absence2[Admission IC]"
  const match = csvId.match(/^([a-z0-9]+):\s*\[([^\]]+)\]$/);
  if (match) {
    const templateName = match[1];
    const activities = match[2];
    
    // Capitalize first letter of template name
    const capitalizedTemplate = templateName.charAt(0).toUpperCase() + templateName.slice(1);
    
    return `${capitalizedTemplate}[${activities}]`;
  }
  
  return csvId;
}

console.log('Testing constraint ID mapping:');
console.log('='.repeat(50));

const testCases = [
  'absence2: [Admission IC]',
  'alternate succession: [ER Registration, ER Sepsis Triage]',
  'exactly1: [ER Registration]',
  'existence: [Leucocytes]',
  'init: [ER Registration]'
];

testCases.forEach(csvId => {
  const declareId = mapConstraintIdFromCsv(csvId);
  console.log(`CSV: "${csvId}" -> DECLARE: "${declareId}"`);
});

console.log('\n' + '='.repeat(50));

// Read the DECLARE file
const declareFile = path.join(__dirname, 'public', 'StepsisModel.decl');
const content = fs.readFileSync(declareFile, 'utf8');

// Extract constraint lines (lines that contain '[' and ']')
const lines = content.split('\n');
const constraintLines = lines.filter(line => 
  line.includes('[') && line.includes(']') && 
  !line.startsWith('activity') && 
  !line.startsWith('bind') &&
  !line.includes(':') &&
  line.trim().length > 0
);

console.log(`Found ${constraintLines.length} constraint lines:`);
console.log('='.repeat(50));

const parsedConstraints = [];
const failedConstraints = [];

for (const line of constraintLines) {
  const parsed = parseDeclareConstraint(line);
  if (parsed) {
    parsedConstraints.push(parsed);
    console.log(`✓ Parsed: ${parsed.id}`);
  } else {
    failedConstraints.push(line);
    console.log(`✗ Failed: ${line.trim()}`);
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Successfully parsed: ${parsedConstraints.length} constraints`);
console.log(`Failed to parse: ${failedConstraints.length} constraints`);

if (failedConstraints.length > 0) {
  console.log('\nFailed constraints:');
  failedConstraints.forEach(line => console.log(`  ${line.trim()}`));
}

// Show unique template types found
const templateTypes = [...new Set(parsedConstraints.map(c => c.type))];
console.log('\nTemplate types found:', templateTypes.sort()); 