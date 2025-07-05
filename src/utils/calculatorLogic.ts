import { TransactionInput, ComplianceResult, RequirementGroup, JurisdictionRequirements } from '../types';
import { countryConfigs, convertToUSD } from '../data/countryConfigs';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface FieldMatch {
  sumsubField: string;
  counterpartyField: string;
  isExactMatch: boolean;
  isOrGroupMatch?: boolean;
  orGroupId?: string;
}

export interface FieldAnalysis {
  missing_fields: string[];
  extra_fields: string[];
  matching_fields: string[];
  sumsub_sends_more: string[];
  counterparty_sends_more: string[];
  field_matches: FieldMatch[];
  or_group_matches: { [groupId: string]: string }; // groupId -> matched field
}

// ===================================================================
// MAIN CALCULATION FUNCTION
// ===================================================================

export const calculateCompliance = (input: TransactionInput): ComplianceResult & { field_analysis: FieldAnalysis } => {
  // Validate country configurations
  const sumsubConfig = countryConfigs[input.sumsub_vasp_country];
  const counterpartyConfig = countryConfigs[input.counterparty_vasp_country];

  if (!sumsubConfig || !counterpartyConfig) {
    throw new Error('Invalid country configuration');
  }

  // Determine threshold compliance for each VASP
  const sumsubThresholdMet = input.transfer_amount >= sumsubConfig.threshold;
  const counterpartyThresholdMet = input.transfer_amount >= counterpartyConfig.threshold;

  // Get jurisdiction requirements based on threshold and customer type
  const sumsubReqs = sumsubThresholdMet 
    ? sumsubConfig[input.customer_type].above_threshold
    : sumsubConfig[input.customer_type].below_threshold;

  const counterpartyReqs = counterpartyThresholdMet 
    ? counterpartyConfig[input.customer_type].above_threshold
    : counterpartyConfig[input.customer_type].below_threshold;

  // Extract required fields and OR groups from requirements
  const { requiredFields: sumsubRequiredFields, orGroups: sumsubOrGroups } = extractRequiredFieldsWithOrLogic(sumsubReqs.requirements);
  const { requiredFields: counterpartyRequiredFields, orGroups: counterpartyOrGroups } = extractRequiredFieldsWithOrLogic(counterpartyReqs.requirements);

  // Perform detailed field analysis with OR group matching
  const fieldAnalysis = analyzeFieldDifferencesWithOrGroups(
    sumsubRequiredFields,
    counterpartyRequiredFields,
    sumsubOrGroups,
    counterpartyOrGroups,
    input.transfer_direction
  );

  // Determine overall compliance status
  const complianceStatus = determineComplianceStatus(
    sumsubRequiredFields,
    counterpartyRequiredFields,
    input.transfer_direction
  );

  // Convert amount to USD for display purposes
  const amountInUSD = convertToUSD(input.transfer_amount, sumsubConfig.currency);

  return {
    sumsub_requirements: {
      required_fields: sumsubRequiredFields,
      recommended_fields: sumsubReqs.recommended_fields || [],
      requirement_groups: sumsubReqs.requirements,
      kyc_required: sumsubReqs.kyc_required || false,
      aml_required: sumsubReqs.aml_required || false,
      wallet_attribution: sumsubReqs.wallet_attribution || false
    },
    counterparty_requirements: {
      required_fields: counterpartyRequiredFields,
      recommended_fields: counterpartyReqs.recommended_fields || [],
      requirement_groups: counterpartyReqs.requirements,
      kyc_required: counterpartyReqs.kyc_required || false,
      aml_required: counterpartyReqs.aml_required || false,
      wallet_attribution: counterpartyReqs.wallet_attribution || false
    },
    compliance_status: complianceStatus,
    currency: sumsubConfig.currency,
    threshold_met: sumsubThresholdMet,
    converted_amount: amountInUSD,
    field_analysis: fieldAnalysis
  };
};

// ===================================================================
// FIELD EXTRACTION AND OR GROUP HANDLING
// ===================================================================

/**
 * Extracts required fields and OR groups from requirement groups
 * Separates AND logic fields (always required) from OR logic fields (alternatives)
 */
const extractRequiredFieldsWithOrLogic = (
  requirements: RequirementGroup[]
): { 
  requiredFields: string[]; 
  orGroups: { [groupId: string]: string[] }; 
} => {

  const requiredFields = new Set<string>();
  const orGroups: { [groupId: string]: string[] } = {};

  let orGroupCounter = 0;

  requirements.forEach((group: RequirementGroup) => {
    if (group.logic === 'AND') {
      group.fields.forEach((field: string) => requiredFields.add(field));
    } else if (group.logic === 'OR') {
      const groupId = `or_group_${orGroupCounter}`;
      orGroups[groupId] = group.fields;
      orGroupCounter++;
    }
  });

  return { 
    requiredFields: Array.from(requiredFields), 
    orGroups 
  };
};


// ===================================================================
// FIELD ANALYSIS AND MATCHING
// ===================================================================

/**
 * Analyzes field differences between Sumsub and Counterparty requirements
 * Handles OR group matching and determines compliance gaps
 */
const analyzeFieldDifferencesWithOrGroups = (
  sumsubFields: string[],
  counterpartyFields: string[],
  sumsubOrGroups: { [groupId: string]: string[] },
  counterpartyOrGroups: { [groupId: string]: string[] },
  transferDirection: 'OUT' | 'IN'
): FieldAnalysis => {
  const sumsubSet = new Set(sumsubFields);
  const counterpartySet = new Set(counterpartyFields);

  // Initialize tracking variables
  const fieldMatches: FieldMatch[] = [];
  const matchedSumsubFields = new Set<string>();
  const matchedCounterpartyFields = new Set<string>();
  const orGroupMatches: { [groupId: string]: string } = {};

  // Step 1: Find exact matches for required fields
  sumsubFields.forEach(sumsubField => {
    if (counterpartySet.has(sumsubField)) {
      fieldMatches.push({
        sumsubField,
        counterpartyField: sumsubField,
        isExactMatch: true
      });
      matchedSumsubFields.add(sumsubField);
      matchedCounterpartyFields.add(sumsubField);
    }
  });

  // Step 2: Handle OR group matching for counterparty
  Object.entries(counterpartyOrGroups).forEach(([groupId, orFields]) => {
    if (orGroupMatches[groupId]) return; // Skip if already matched
    
    // Check for individual field matches in OR group
    for (const orField of orFields) {
      if (sumsubSet.has(orField) && !matchedSumsubFields.has(orField)) {
        fieldMatches.push({
          sumsubField: orField,
          counterpartyField: orField,
          isExactMatch: true,
          isOrGroupMatch: true,
          orGroupId: groupId
        });
        matchedSumsubFields.add(orField);
        matchedCounterpartyFields.add(orField);
        orGroupMatches[groupId] = orField;
        break; // Only need one match per OR group
      }
    }
    
    // Special handling for DEU combination fields (date_of_birth + birthplace)
    if (!orGroupMatches[groupId] && isDeuOrGroup(orFields)) {
      const combinationMatch = checkDeuCombinationMatch(sumsubSet, orFields);
      if (combinationMatch) {
        // Add matches for both combination fields
        fieldMatches.push({
          sumsubField: 'date_of_birth',
          counterpartyField: 'date_of_birth',
          isExactMatch: true,
          isOrGroupMatch: true,
          orGroupId: groupId
        });
        fieldMatches.push({
          sumsubField: 'birthplace',
          counterpartyField: 'birthplace',
          isExactMatch: true,
          isOrGroupMatch: true,
          orGroupId: groupId
        });
        matchedSumsubFields.add('date_of_birth');
        matchedSumsubFields.add('birthplace');
        matchedCounterpartyFields.add('date_of_birth');
        matchedCounterpartyFields.add('birthplace');
        orGroupMatches[groupId] = 'date_of_birth + birthplace';
      }
    }
  });

  // Step 3: Handle OR group matching for Sumsub
  Object.entries(sumsubOrGroups).forEach(([groupId, orFields]) => {
    if (orGroupMatches[groupId]) return; // Skip if already matched
    
    for (const orField of orFields) {
      if (counterpartySet.has(orField) && !matchedSumsubFields.has(orField)) {
        fieldMatches.push({
          sumsubField: orField,
          counterpartyField: orField,
          isExactMatch: true,
          isOrGroupMatch: true,
          orGroupId: groupId
        });
        matchedSumsubFields.add(orField);
        matchedCounterpartyFields.add(orField);
        orGroupMatches[groupId] = orField;
        break;
      }
    }
    
    // Special handling for DEU combination fields
    if (!orGroupMatches[groupId] && isDeuOrGroup(orFields)) {
      const combinationMatch = checkDeuCombinationMatch(counterpartySet, orFields);
      if (combinationMatch) {
        fieldMatches.push({
          sumsubField: 'date_of_birth',
          counterpartyField: 'date_of_birth',
          isExactMatch: true,
          isOrGroupMatch: true,
          orGroupId: groupId
        });
        fieldMatches.push({
          sumsubField: 'birthplace',
          counterpartyField: 'birthplace',
          isExactMatch: true,
          isOrGroupMatch: true,
          orGroupId: groupId
        });
        matchedSumsubFields.add('date_of_birth');
        matchedSumsubFields.add('birthplace');
        matchedCounterpartyFields.add('date_of_birth');
        matchedCounterpartyFields.add('birthplace');
        orGroupMatches[groupId] = 'date_of_birth + birthplace';
      }
    }
  });

  // Step 4: Find semantic matches for remaining unmatched fields
  const semanticMatches = findSemanticMatches(sumsubFields, counterpartyFields);
  semanticMatches.forEach(match => {
    if (!matchedSumsubFields.has(match.sumsubField) && !matchedCounterpartyFields.has(match.counterpartyField)) {
      fieldMatches.push(match);
      matchedSumsubFields.add(match.sumsubField);
      matchedCounterpartyFields.add(match.counterpartyField);
    }
  });

  // Step 5: Calculate final analysis based on transfer direction
  const matching_fields = Array.from(matchedSumsubFields);
  
  if (transferDirection === 'OUT') {
    // Outbound: Sumsub sends to Counterparty
    const missing_fields = counterpartyFields.filter(field => !matchedCounterpartyFields.has(field));
    const extra_fields = sumsubFields.filter(field => !matchedSumsubFields.has(field));
    
    return {
      missing_fields,
      extra_fields,
      matching_fields,
      sumsub_sends_more: extra_fields,
      counterparty_sends_more: [],
      field_matches: fieldMatches,
      or_group_matches: orGroupMatches
    };
  } else {
    // Inbound: Counterparty sends to Sumsub
    const missing_fields = sumsubFields.filter(field => !matchedSumsubFields.has(field));
    const extra_fields = counterpartyFields.filter(field => !matchedCounterpartyFields.has(field));
    
    return {
      missing_fields,
      extra_fields,
      matching_fields,
      sumsub_sends_more: [],
      counterparty_sends_more: extra_fields,
      field_matches: fieldMatches,
      or_group_matches: orGroupMatches
    };
  }
};

// ===================================================================
// HELPER FUNCTIONS FOR OR GROUP LOGIC
// ===================================================================

/**
 * Checks if the OR group is a DEU-style group with 4 specific fields
 */
const isDeuOrGroup = (orFields: string[]): boolean => {
  return orFields.length === 4 && 
         orFields.includes('id_document_number') && 
         orFields.includes('customer_id') &&
         orFields.includes('date_of_birth') && 
         orFields.includes('birthplace');
};

/**
 * Checks if the field set satisfies DEU combination requirement (date_of_birth + birthplace)
 */
const checkDeuCombinationMatch = (fieldSet: Set<string>, orFields: string[]): boolean => {
  return fieldSet.has('date_of_birth') && fieldSet.has('birthplace');
};

// ===================================================================
// SEMANTIC FIELD MATCHING
// ===================================================================

/**
 * Finds semantic matches between different field names that represent the same data
 * Handles cross-entity-type mappings (individual vs company fields)
 */
const findSemanticMatches = (sumsubFields: string[], counterpartyFields: string[]): FieldMatch[] => {
  const semanticMappings: { [key: string]: string[] } = {
    // Individual/Company name mappings
    'full_name': ['company_name', 'registered_name'],
    'company_name': ['full_name', 'registered_name'],
    'registered_name': ['full_name', 'company_name'],
    
    // Address mappings
    'residential_address': ['company_address', 'registered_address'],
    'company_address': ['residential_address', 'registered_address'],
    'registered_address': ['residential_address', 'company_address'],
    
    // ID/Registration number mappings
    'id_document_number': ['company_registration_number', 'registration_number', 'lei_or_equivalent'],
    'company_registration_number': ['id_document_number', 'registration_number', 'lei_or_equivalent'],
    'registration_number': ['id_document_number', 'company_registration_number', 'lei_or_equivalent'],
    'lei_or_equivalent': ['id_document_number', 'company_registration_number', 'registration_number'],
    
    // Customer/Client ID mappings
    'customer_id': ['internal_id', 'client_id', 'account_id'],
    'internal_id': ['customer_id', 'client_id', 'account_id'],
    'client_id': ['customer_id', 'internal_id', 'account_id'],
    'account_id': ['customer_id', 'internal_id', 'client_id'],
    
    // Date/Birth related mappings
    'date_of_birth': ['birth_date', 'dob'],
    'birth_date': ['date_of_birth', 'dob'],
    'dob': ['date_of_birth', 'birth_date'],
    'birthplace': ['birth_location', 'place_of_birth'],
    'birth_location': ['birthplace', 'place_of_birth'],
    'place_of_birth': ['birthplace', 'birth_location'],
    
    // Contact information mappings
    'phone_number': ['telephone', 'mobile_number', 'contact_number'],
    'telephone': ['phone_number', 'mobile_number', 'contact_number'],
    'mobile_number': ['phone_number', 'telephone', 'contact_number'],
    'contact_number': ['phone_number', 'telephone', 'mobile_number'],
    'email_address': ['email', 'electronic_mail'],
    'email': ['email_address', 'electronic_mail'],
    'electronic_mail': ['email_address', 'email'],
    
    // Wallet/Address mappings
    'wallet_address': ['crypto_address', 'blockchain_address', 'virtual_asset_address', 'dlt_address'],
    'crypto_address': ['wallet_address', 'blockchain_address', 'virtual_asset_address', 'dlt_address'],
    'blockchain_address': ['wallet_address', 'crypto_address', 'virtual_asset_address', 'dlt_address'],
    'virtual_asset_address': ['wallet_address', 'crypto_address', 'blockchain_address', 'dlt_address'],
    'dlt_address': ['wallet_address', 'crypto_address', 'blockchain_address', 'virtual_asset_address'],
    
    // Nationality/Citizenship mappings
    'nationality': ['citizenship', 'country_of_citizenship'],
    'citizenship': ['nationality', 'country_of_citizenship'],
    'country_of_citizenship': ['nationality', 'citizenship'],
    
    // Professional/Business mappings
    'occupation': ['profession', 'job_title', 'employment'],
    'profession': ['occupation', 'job_title', 'employment'],
    'job_title': ['occupation', 'profession', 'employment'],
    'employment': ['occupation', 'profession', 'job_title'],
    'authorized_representative': ['signatory', 'authorized_person', 'legal_representative'],
    'signatory': ['authorized_representative', 'authorized_person', 'legal_representative'],
    'authorized_person': ['authorized_representative', 'signatory', 'legal_representative'],
    'legal_representative': ['authorized_representative', 'signatory', 'authorized_person']
  };

  const matches: FieldMatch[] = [];
  
  sumsubFields.forEach(sumsubField => {
    const possibleMatches = semanticMappings[sumsubField] || [];
    possibleMatches.forEach(possibleMatch => {
      if (counterpartyFields.includes(possibleMatch)) {
        matches.push({
          sumsubField,
          counterpartyField: possibleMatch,
          isExactMatch: false
        });
      }
    });
  });

  return matches;
};

// ===================================================================
// COMPLIANCE STATUS DETERMINATION
// ===================================================================

/**
 * Determines overall compliance status based on field matching results
 */
const determineComplianceStatus = (
  sumsubFields: string[],
  counterpartyFields: string[],
  transferDirection: 'OUT' | 'IN'
): 'full_match' | 'overcompliance' | 'counterparty_may_request_more' | 'sender_may_not_provide' => {
  const sumsubFieldsSet = new Set(sumsubFields);
  const counterpartyFieldsSet = new Set(counterpartyFields);
  
  // Check field coverage
  const sumsubHasAll = Array.from(counterpartyFieldsSet).every(field => sumsubFieldsSet.has(field));
  const counterpartyHasAll = Array.from(sumsubFieldsSet).every(field => counterpartyFieldsSet.has(field));
  
  // Full match: both parties require exactly the same fields
  if (sumsubHasAll && counterpartyHasAll && sumsubFields.length === counterpartyFields.length) {
    return 'full_match';
  }
  
  if (transferDirection === 'OUT') {
    // Outbound transfers: Sumsub sends to Counterparty
    if (sumsubHasAll) {
      return sumsubFields.length > counterpartyFields.length ? 'overcompliance' : 'full_match';
    } else {
      return 'counterparty_may_request_more';
    }
  } else {
    // Inbound transfers: Counterparty sends to Sumsub
    if (counterpartyHasAll) {
      return counterpartyFields.length > sumsubFields.length ? 'overcompliance' : 'full_match';
    } else {
      return 'sender_may_not_provide';
    }
  }
};

// ===================================================================
// UTILITY FUNCTIONS FOR UI
// ===================================================================

export const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const getComplianceStatusColor = (status: string): string => {
  switch (status) {
    case 'full_match':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'overcompliance':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'counterparty_may_request_more':
      return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'sender_may_not_provide':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
};

export const getComplianceStatusIcon = (status: string): string => {
  switch (status) {
    case 'full_match':
      return '✅';
    case 'overcompliance':
      return '📊';
    case 'counterparty_may_request_more':
      return '⚠️';
    case 'sender_may_not_provide':
      return '⚠️';
    default:
      return '❓';
  }
};

export const getComplianceStatusMessage = (status: string): string => {
  switch (status) {
    case 'full_match':
      return 'Full Compliance - both parties require identical data sets';
    case 'overcompliance':
      return 'Overcompliance - you provide more data than required';
    case 'counterparty_may_request_more':
      return 'Counterparty may request additional data beyond your jurisdiction requirements';
    case 'sender_may_not_provide':
      return 'Sending party may not provide all required data for your jurisdiction';
    default:
      return 'Unknown compliance status';
  }
};

export const getDetailedComplianceMessage = (
  status: string,
  fieldAnalysis: FieldAnalysis,
  transferDirection: 'OUT' | 'IN'
): string => {
  const { missing_fields, sumsub_sends_more, counterparty_sends_more, field_matches } = fieldAnalysis;

  switch (status) {
    case 'full_match':
      return `Requirements fully match. Both parties work with ${field_matches.length} matching field pairs.`;
    
    case 'overcompliance':
      if (transferDirection === 'OUT') {
        return `Sumsub VASP sends ${sumsub_sends_more.length} additional fields beyond counterparty requirements. This is acceptable and does not violate compliance.`;
      } else {
        return `Counterparty sends ${counterparty_sends_more.length} additional fields beyond your requirements. This is acceptable.`;
      }
    
    case 'counterparty_may_request_more':
      return `Counterparty requires ${missing_fields.length} additional fields that are not mandatory in your jurisdiction. Counterparty may request this data.`;
    
    case 'sender_may_not_provide':
      return `Sending party may not provide ${missing_fields.length} fields required for compliance with your jurisdiction requirements.`;
    
    default:
      return 'Compliance status not determined.';
  }
};