// Test constraint ID mapping
function mapTemplateName(templateName) {
  const nameMap = {
    'alternate succession': 'AlternateSuccession',
    'chain succession': 'ChainSuccession',
    'alternate response': 'AlternateResponse',
    'alternate precedence': 'AlternatePrecedence',
    'chain response': 'ChainResponse',
    'chain precedence': 'ChainPrecedence',
    'not succession': 'NotSuccession',
    'not chain succession': 'NotChainSuccession',
    'absence2': 'Absence2',
    'absence3': 'Absence3',
    'exactly1': 'Exactly1',
    'existence': 'Existence',
    'succession': 'Succession',
    'response': 'Response',
    'precedence': 'Precedence'
  };
  
  return nameMap[templateName.toLowerCase()] || templateName;
}

function mapConstraintIdFromCsv(csvId) {
  // Match template name and everything inside the first [...] (including commas)
  const match = csvId.match(/^([^:]+):\s*\[([\s\S]+?)\](?:\[\])*$/);
  if (match) {
    const templateName = match[1].trim();
    let activities = match[2].replace(/\]\s*,\s*\[/g, ', '); // merge [A], [B] to A, B
    // Remove any stray brackets
    activities = activities.replace(/[\[\]]/g, '');
    const mappedTemplateName = mapTemplateName(templateName);
    // Capitalize first letter for consistency
    const capitalizedTemplate = mappedTemplateName.charAt(0).toUpperCase() + mappedTemplateName.slice(1);
    return `${capitalizedTemplate}[${activities}]`;
  }
  return csvId.replace(/(\[\])*$/g, '');
}

// Test cases from actual CSV data
const testCases = [
  "absence2: [Admission IC][][][]",
  "alternate succession: [ER Registration], [ER Sepsis Triage][][][]",
  "alternate response: [ER Triage], [Leucocytes][][][]",
  "exactly1: [ER Triage][][][]",
  "existence: [CRP][][][]",
  "succession: [ER Registration], [Leucocytes][][][]"
];

console.log("Testing constraint ID mapping:");
testCases.forEach(testCase => {
  const mapped = mapConstraintIdFromCsv(testCase);
  console.log(`${testCase} -> ${mapped}`);
}); 