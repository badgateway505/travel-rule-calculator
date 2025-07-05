import { FieldDictionary } from '../types';

export const fieldDictionary: FieldDictionary = {
  full_name: { 
    label: "Full Name", 
    aliases: ["name", "customer_name", "full_legal_name"] 
  },
  wallet_address: { 
    label: "Wallet Address", 
    aliases: ["crypto_address", "blockchain_address", "virtual_asset_address", "dlt_address"] 
  },
  residential_address: { 
    label: "Residential Address", 
    aliases: ["address", "home_address", "street_address"] 
  },
  date_of_birth: { 
    label: "Date of Birth", 
    aliases: ["dob", "birth_date", "date_birth"] 
  },
  birthplace: { 
    label: "Place of Birth", 
    aliases: ["birth_location", "birth_place", "place_of_birth"] 
  },
  id_document_number: { 
    label: "ID Document Number", 
    aliases: ["passport_number", "identity_number", "national_id", "document_id"] 
  },
  customer_id: { 
    label: "Customer Internal ID", 
    aliases: ["internal_id", "client_id", "account_id"] 
  },
  nationality: { 
    label: "Nationality", 
    aliases: ["citizenship", "country_of_citizenship"] 
  },
  phone_number: { 
    label: "Phone Number", 
    aliases: ["telephone", "mobile_number", "contact_number"] 
  },
  email_address: { 
    label: "Email Address", 
    aliases: ["email", "electronic_mail"] 
  },
  occupation: { 
    label: "Occupation", 
    aliases: ["profession", "job_title", "employment"] 
  },
  company_name: { 
    label: "Registered Company Name", 
    aliases: ["business_name", "legal_entity_name", "corporation_name", "registered_name"] 
  },
  company_registration_number: { 
    label: "Company Registration Number", 
    aliases: ["business_registration", "legal_entity_id", "incorporation_number", "registration_number"] 
  },
  company_address: { 
    label: "Registered Address", 
    aliases: ["business_address", "registered_address", "corporate_address"] 
  },
  authorized_representative: { 
    label: "Authorized Representative", 
    aliases: ["signatory", "authorized_person", "legal_representative"] 
  },
  lei_or_equivalent: {
    label: "LEI or Equivalent",
    aliases: ["lei", "legal_entity_identifier", "lei_code"]
  }
};

export const getFieldLabel = (fieldKey: string): string => {
  return fieldDictionary[fieldKey]?.label || fieldKey;
};

export const getFieldAliases = (fieldKey: string): string[] => {
  return fieldDictionary[fieldKey]?.aliases || [];
};

export const isFieldOptional = (fieldKey: string): boolean => {
  return fieldDictionary[fieldKey]?.optional || false;
};