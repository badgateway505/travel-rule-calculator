import { CountryConfigs } from '../types';

export const countryConfigs: CountryConfigs = {
  // 🇪🇺 European Union - Regulation (EU) 2015/847 (FATF Recommendation 16)
  EU: {
    currency: "EUR",
    threshold: 1000, // EUR 1,000 per EU Travel Rule Package
    individual: {
      below_threshold: {
        requirements: [
          { fields: ["full_name", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: false,
        aml_required: true,
        wallet_attribution: true
      },
      above_threshold: {
        requirements: [
          { fields: ["full_name", "id_document_number", "date_of_birth", "residential_address", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      }
    },
    company: {
      below_threshold: {
        requirements: [
          { fields: ["company_name", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: false,
        aml_required: true,
        wallet_attribution: true
      },
      above_threshold: {
        requirements: [
          { fields: ["company_name", "company_registration_number", "company_address", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      }
    }
  },
  
  // 🇿🇦 South Africa - FIC Act (Financial Intelligence Centre Act)
  ZAF: {
    currency: "ZAR",
    threshold: 5000, // ZAR 5,000 per SARB requirements
    individual: {
      below_threshold: {
        requirements: [
          { fields: ["full_name", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: false,
        aml_required: true,
        wallet_attribution: true
      },
      above_threshold: {
        requirements: [
          { fields: ["full_name", "wallet_address", "id_document_number", "date_of_birth", "residential_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      }
    },
    company: {
      below_threshold: {
        requirements: [
          { fields: ["company_name", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: false,
        aml_required: true,
        wallet_attribution: true
      },
      above_threshold: {
        requirements: [
          { fields: ["company_name", "company_registration_number", "company_address", "wallet_address", "customer_id"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      }
    }
  },
  
  // 🇩🇪 Germany - GwG (German Anti-Money Laundering Act) + BaFin guidelines
  DEU: {
    currency: "EUR",
    threshold: 0, // No threshold - all transfers require full compliance per German regulation
    individual: {
      below_threshold: {
        requirements: [
          { fields: ["full_name", "residential_address", "wallet_address"], logic: "AND" },
          // Alternative identification: ID Document OR Customer ID OR (Date of Birth + Place of Birth)
          { fields: ["id_document_number", "customer_id", "date_of_birth", "birthplace"], logic: "OR" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      },
      above_threshold: {
        requirements: [
          { fields: ["full_name", "residential_address", "wallet_address"], logic: "AND" },
          // Alternative identification: ID Document OR Customer ID OR (Date of Birth + Place of Birth)
          { fields: ["id_document_number", "customer_id", "date_of_birth", "birthplace"], logic: "OR" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      }
    },
    company: {
      below_threshold: {
        requirements: [
          { fields: ["company_name", "company_address", "wallet_address", "lei_or_equivalent"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      },
      above_threshold: {
        requirements: [
          { fields: ["company_name", "company_address", "wallet_address", "lei_or_equivalent"], logic: "AND" }
        ],
        recommended_fields: [],
        kyc_required: true,
        aml_required: true,
        wallet_attribution: true
      }
    }
  }
};

export const countries = [
  { code: 'EU', name: 'European Union', currency: 'EUR', flag: '🇪🇺' },
  { code: 'ZAF', name: 'South Africa', currency: 'ZAR', flag: '🇿🇦' },
  { code: 'DEU', name: 'Germany', currency: 'EUR', flag: '🇩🇪' }
];

export const getCountryName = (countryCode: string): string => {
  const country = countries.find(c => c.code === countryCode);
  return country ? country.name : countryCode;
};

export const getCountryFlag = (countryCode: string): string => {
  const country = countries.find(c => c.code === countryCode);
  return country ? country.flag : '';
};

export const getCurrencySymbol = (currency: string): string => {
  const symbols: { [key: string]: string } = {
    ZAR: "R",
    EUR: "€",
    USD: "$"
  };
  return symbols[currency] || currency;
};

// Exchange rates (simplified for demo - in production would use live rates)
export const exchangeRates: { [key: string]: number } = {
  ZAR: 18.50, // 1 USD = 18.50 ZAR
  EUR: 0.85,  // 1 USD = 0.85 EUR
  USD: 1.00
};

export const convertToUSD = (amount: number, currency: string): number => {
  return amount / exchangeRates[currency];
};

export const convertFromUSD = (amount: number, currency: string): number => {
  return amount * exchangeRates[currency];
};

export const formatThreshold = (threshold: number, currency: string): string => {
  if (threshold === 0) {
    return `${currency} 0 (all transfers)`;
  }
  return `${currency} ${threshold.toLocaleString()}`;
};