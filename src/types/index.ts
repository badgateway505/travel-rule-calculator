export interface FieldDefinition {
  label: string;
  aliases: string[];
  optional?: boolean;
}

export interface FieldDictionary {
  [key: string]: FieldDefinition;
}

export interface RequirementGroup {
  fields: string[];
  logic: 'AND' | 'OR';
}

export interface JurisdictionRequirements {
  requirements: RequirementGroup[];
  recommended_fields?: string[];
  kyc_required?: boolean;
  aml_required?: boolean;
  wallet_attribution?: boolean;
}

export interface CountryConfig {
  currency: string;
  threshold: number; // in local currency
  individual: {
    below_threshold: JurisdictionRequirements;
    above_threshold: JurisdictionRequirements;
  };
  company: {
    below_threshold: JurisdictionRequirements;
    above_threshold: JurisdictionRequirements;
  };
}

export interface CountryConfigs {
  [countryCode: string]: CountryConfig;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  flag: string;
}

export interface TransactionInput {
  sumsub_vasp_country: string;
  counterparty_vasp_country: string;
  customer_type: 'individual' | 'company';
  transfer_direction: 'OUT' | 'IN';
  transfer_amount: number;
}

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
  or_group_matches: { [groupId: string]: string };
}

export interface ComplianceResult {
  sumsub_requirements: {
    required_fields: string[];
    recommended_fields: string[];
    requirement_groups: RequirementGroup[];
    kyc_required: boolean;
    aml_required: boolean;
    wallet_attribution: boolean;
  };
  counterparty_requirements: {
    required_fields: string[];
    recommended_fields: string[];
    requirement_groups: RequirementGroup[];
    kyc_required: boolean;
    aml_required: boolean;
    wallet_attribution: boolean;
  };
  compliance_status: 'full_match' | 'overcompliance' | 'counterparty_may_request_more' | 'sender_may_not_provide';
  currency: string;
  threshold_met: boolean;
  converted_amount?: number;
  field_analysis: FieldAnalysis;
}