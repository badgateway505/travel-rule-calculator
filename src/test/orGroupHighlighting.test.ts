import { describe, it, expect } from 'vitest';
import { calculateCompliance } from '../utils/calculatorLogic';
import { TransactionInput } from '../types';

describe('OR Group Highlighting Tests', () => {

  describe('🇩🇪 Germany OR Group Highlighting', () => {

    it('should highlight customer_id when ZAF sends customer_id to DEU', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'ZAF',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 5
      };

      const result = calculateCompliance(input);

      expect(result.field_analysis.or_group_matches).toBeDefined();
      expect(Object.values(result.field_analysis.or_group_matches)).toContain('customer_id');

      const customerIdMatch = result.field_analysis.field_matches.find(
        match => match.sumsubField === 'customer_id' &&
                 match.counterpartyField === 'customer_id' &&
                 match.isOrGroupMatch === true
      );

      expect(customerIdMatch).toBeDefined();
      expect(customerIdMatch?.isExactMatch).toBe(true);
    });

    it('should highlight id_document_number when EU sends id_document_number to DEU', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'EU',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 1500
      };

      const result = calculateCompliance(input);

      expect(Object.values(result.field_analysis.or_group_matches)).toContain('id_document_number');

      const idDocMatch = result.field_analysis.field_matches.find(
        match => match.sumsubField === 'id_document_number' &&
                 match.counterpartyField === 'id_document_number' &&
                 match.isOrGroupMatch === true
      );

      expect(idDocMatch).toBeDefined();
      expect(idDocMatch?.isExactMatch).toBe(true);
    });

    it('should properly structure DEU OR group', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'DEU',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 100
      };

      const result = calculateCompliance(input);

      const orGroup = result.counterparty_requirements.requirement_groups.find(
        group => group.logic === 'OR' &&
                 group.fields.includes('id_document_number') &&
                 group.fields.includes('customer_id') &&
                 group.fields.includes('date_of_birth') &&
                 group.fields.includes('birthplace')
      );

      expect(orGroup).toBeDefined();
      expect(orGroup?.fields.length).toBe(4);
    });

    it('should highlight customer_id when no other OR fields present', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'EU',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 500
      };

      const result = calculateCompliance(input);

      expect(Object.values(result.field_analysis.or_group_matches)).toContain('customer_id');
    });

    it('should highlight OR group on inbound transfer', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'DEU',
        counterparty_vasp_country: 'ZAF',
        customer_type: 'individual',
        transfer_direction: 'IN',
        transfer_amount: 3000
      };

      const result = calculateCompliance(input);

      expect(Object.values(result.field_analysis.or_group_matches)).toContain('customer_id');
      expect(result.compliance_status).toBe('sender_may_not_provide');
    });
  });

  describe('Cross-border OR Group Scenarios', () => {

    it('should highlight OR group for EU to DEU transfer', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'EU',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 800
      };

      const result = calculateCompliance(input);

      expect(Object.values(result.field_analysis.or_group_matches)).toContain('customer_id');
      expect(result.field_analysis.missing_fields).toContain('residential_address');
      expect(result.compliance_status).toBe('counterparty_may_request_more');
    });

    it('should handle ZAF to DEU transfer with multiple OR matches', () => {
      const input: TransactionInput = {
        sumsub_vasp_country: 'ZAF',
        counterparty_vasp_country: 'DEU',
        customer_type: 'individual',
        transfer_direction: 'OUT',
        transfer_amount: 7500
      };

      const result = calculateCompliance(input);

      expect(Object.values(result.field_analysis.or_group_matches).length).toBeGreaterThan(0);
      expect(result.compliance_status).toMatch(/overcompliance|full_match|counterparty_may_request_more/);
    });
  });
});
