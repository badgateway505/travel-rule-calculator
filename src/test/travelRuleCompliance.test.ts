import { describe, it, expect } from 'vitest';
import { calculateCompliance } from '../utils/calculatorLogic';
import { TransactionInput } from '../types';

describe('Travel Rule Compliance Tests', () => {

  describe('🇩🇪 Germany (DEU) - No threshold (0 EUR)', () => {
    describe('Individual customers', () => {
      it('should require core fields + OR group (no threshold)', () => {
        const input: TransactionInput = {
          sumsub_vasp_country: 'DEU',
          counterparty_vasp_country: 'DEU',
          customer_type: 'individual',
          transfer_direction: 'OUT',
          transfer_amount: 100
        };

        const result = calculateCompliance(input);

        expect(result.threshold_met).toBe(true);
        expect(result.sumsub_requirements.required_fields).toEqual([
          'full_name',
          'residential_address',
          'wallet_address'
        ]);

        const orGroup = result.sumsub_requirements.requirement_groups.find(
          group => group.logic === 'OR' && 
          group.fields.includes('id_document_number') &&
          group.fields.includes('customer_id') &&
          group.fields.includes('date_of_birth') &&
          group.fields.includes('birthplace')
        );
        
        expect(orGroup).toBeDefined();
        expect(result.sumsub_requirements.recommended_fields).toContain('birthplace');
      });
    });
  });

  describe('Cross-border compliance scenarios', () => {

    it('should handle EU to ZAF transfer', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'EU',
        counterparty_vasp_country: 'ZAF',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 1500
      };

      const result = calculateCompliance(input);

      expect(result.sumsub_requirements.kyc_required).toBe(true);
      expect(result.counterparty_requirements.kyc_required).toBe(true);
      expect(result.compliance_status).toMatch(/full_match|overcompliance|counterparty_may_request_more/);
    });

    it('should handle ZAF to DEU transfer (DEU has no threshold)', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'ZAF',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 3000
      };

      const result = calculateCompliance(input);

      expect(result.sumsub_requirements.kyc_required).toBe(false);
      expect(result.counterparty_requirements.kyc_required).toBe(true);
      expect(result.compliance_status).toBe('counterparty_may_request_more');
    });

    it('should handle DEU to EU with alternative identification', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'DEU',
        counterparty_vasp_country: 'EU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 2000
      };

      const result = calculateCompliance(input);

      expect(result.sumsub_requirements.kyc_required).toBe(true);
      expect(result.counterparty_requirements.kyc_required).toBe(true);
      const hasOrLogic = result.sumsub_requirements.requirement_groups.some(group => group.logic === 'OR');
      expect(hasOrLogic).toBe(true);
    });
  });

  describe('Field matching and semantic analysis', () => {

    it('should detect missing fields in cross-border scenarios', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'ZAF',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 3000
      };

      const result = calculateCompliance(input);

      expect(result.field_analysis.missing_fields.length).toBeGreaterThan(0);
      expect(result.compliance_status).toBe('counterparty_may_request_more');
    });

    it('should detect overcompliance scenarios', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'DEU',
        counterparty_vasp_country: 'EU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 500
      };

      const result = calculateCompliance(input);

      expect(result.field_analysis.sumsub_sends_more.length).toBeGreaterThan(0);
      expect(result.compliance_status).toMatch(/overcompliance|full_match|counterparty_may_request_more/);
    });
  });

  describe('Transfer direction scenarios', () => {

    it('should handle inbound transfers with partial data', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'EU',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'IN',
        transfer_amount: 800
      };

      const result = calculateCompliance(input);

      expect(result.sumsub_requirements.kyc_required).toBe(false);
      expect(result.counterparty_requirements.kyc_required).toBe(true);
      expect(result.compliance_status).toBe('sender_may_not_provide');
    });

    it('should handle outbound overcompliance', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'DEU',
        counterparty_vasp_country: 'EU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 800
      };

      const result = calculateCompliance(input);

      expect(result.sumsub_requirements.kyc_required).toBe(true);
      expect(result.counterparty_requirements.kyc_required).toBe(false);
      expect(result.compliance_status).toMatch(/overcompliance|full_match|counterparty_may_request_more/);
    });
  });
});
