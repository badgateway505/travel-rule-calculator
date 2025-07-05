import React, { useState, useEffect } from 'react';
import { Calculator, FileText, ArrowRight, AlertCircle, CheckCircle, Info, ChevronDown, Plus, Minus, ArrowUpRight, ArrowDownLeft, Send, Inbox, Link } from 'lucide-react';
import { TransactionInput, ComplianceResult, FieldMatch } from '../types';
import { calculateCompliance, formatCurrency, getComplianceStatusColor, getComplianceStatusIcon, getComplianceStatusMessage, getDetailedComplianceMessage } from '../utils/calculatorLogic';
import { countries, getCountryName, getCountryFlag, formatThreshold, countryConfigs } from '../data/countryConfigs';
import { getFieldLabel } from '../data/fieldDictionary';

// ===================================================================
// MAIN COMPONENT
// ===================================================================

const TravelRuleCalculator: React.FC = () => {
  // ===================================================================
  // STATE MANAGEMENT
  // ===================================================================
  
  const [input, setInput] = useState<TransactionInput>({
    sumsub_vasp_country: 'EU',
    counterparty_vasp_country: 'DEU',
    customer_type: 'individual',
    transfer_direction: 'OUT',
    transfer_amount: 0
  });

  const [amountInput, setAmountInput] = useState<string>('');
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [hoveredField, setHoveredField] = useState<string | null>(null);


  // ===================================================================
  // EFFECTS
  // ===================================================================
  useEffect(() => {
    if (Number.isFinite(input.transfer_amount) && input.transfer_amount > 0) {
      try {
        const calculatedResult = calculateCompliance(input);
        setResult(calculatedResult);
      } catch (error) {
        console.error('Calculation error:', error);
        setResult(null);
      }
    } else {
        // If amount is 0 or invalid, clear previous results
        setResult(null);
    }
  }, [input]);

  // ===================================================================
  // EVENT HANDLERS
  // ===================================================================

  const handleInputChange = (field: keyof TransactionInput, value: string | number) => {
    setInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAmountChange = (value: string) => {
    // Sanitize to allow only numbers and a single decimal point.
    // This regex removes any character that is not a digit or a dot,
    // and then removes any subsequent dots after the first one.
    const sanitizedValue = value.replace(/[^0-9.]/g, '').replace(/(\..*?)\./g, '$1');

    setAmountInput(sanitizedValue);
    
    // Convert to number for calculations, defaulting to 0 if invalid.
    const numericValue = parseFloat(sanitizedValue);
    handleInputChange('transfer_amount', isNaN(numericValue) ? 0 : numericValue);
  };

  // ===================================================================
  // UTILITY FUNCTIONS
  // ===================================================================
  
  const getMatchCounterpart = (field: string): string | null => {
      if (!result) return null;
      // For combo fields, we need to check both parts
      if (field === 'date_of_birth + birthplace') {
          const dobMatch = result.field_analysis.field_matches.find(m => m.sumsubField === 'date_of_birth' || m.counterpartyField === 'date_of_birth');
          const pobMatch = result.field_analysis.field_matches.find(m => m.sumsubField === 'birthplace' || m.counterpartyField === 'birthplace');
          return (dobMatch && pobMatch) ? 'matched' : null;
      }
      const match = result.field_analysis.field_matches.find(m => m.sumsubField === field || m.counterpartyField === field);
      if (!match) return null;
      return match.sumsubField === field ? match.counterpartyField : match.sumsubField;
  };

  const getCurrentCurrency = () => {
    const country = countries.find(c => c.code === input.sumsub_vasp_country);
    return country?.currency || 'USD';
  };

  const getCurrentThreshold = () => {
    const config = countryConfigs[input.sumsub_vasp_country];
    return config ? formatThreshold(config.threshold, config.currency) : '';
  };

  // ===================================================================
  // RENDER HELPER FUNCTIONS
  // ===================================================================

  const renderCountryOption = (country: any) => (
    <option key={country.code} value={country.code}>
      {country.flag} {country.name} ({country.code})
    </option>
  );

  const renderToggleSwitch = (
    value: boolean,
    onChange: (value: boolean) => void,
    leftLabel: string,
    rightLabel: string
  ) => (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium transition-colors ${!value ? 'text-blue-600' : 'text-gray-500'}`}>
        {leftLabel}
      </span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          value ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm font-medium transition-colors ${value ? 'text-blue-600' : 'text-gray-500'}`}>
        {rightLabel}
      </span>
    </div>
  );

  const renderFieldBadges = (fields: string[], colorClass: string = 'bg-blue-100 text-blue-700', interactive: boolean = true) => (
    <div className="flex flex-wrap gap-2">
      {fields.map(field => {
        if (!interactive) {
          return (
            <span key={field} className={`px-3 py-1 ${colorClass} text-sm rounded-full font-medium`}>
              {getFieldLabel(field)}
            </span>
          );
        }

        const counterpart = getMatchCounterpart(field);
        const isHovered = hoveredField === field || (counterpart && hoveredField === counterpart);
        const isUnprovided = !counterpart;
        const borderColorClass = isUnprovided ? 'border-orange-500' : (colorClass.includes('purple') ? 'border-purple-500' : 'border-blue-500');
        
        return (
          <div key={field} className="relative group" onMouseEnter={() => setHoveredField(field)} onMouseLeave={() => setHoveredField(null)}>
            <span
              className={`block px-3 py-1 ${colorClass} text-sm rounded-full font-medium transition-all duration-300 ease-in-out cursor-pointer border-2 ${
                isHovered ? `scale-105 ${borderColorClass}` : 'border-transparent'
              }`}
            >
              {getFieldLabel(field)}
            </span>
            {/* {isUnprovided && isHovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-700 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                    not provided
                </div>
            )} */}
          </div>
        );
      })}
    </div>
  );


  // ===================================================================
  // OR GROUP RENDERING
  // ===================================================================

  const isDeuOrGroup = (fields: string[]): boolean => {
  return fields.length === 4 && 
      fields.includes('id_document_number') && 
      fields.includes('customer_id') &&
      fields.includes('date_of_birth') && 
      fields.includes('birthplace'); 
  };
    
  const renderOrGroupBadges = (group: any, groupIndex: number, matchedField?: string) => {
    const isGroupSatisfied = !!matchedField;

    const renderBadge = (field: string, displayContent: React.ReactNode) => {
        const isMatched = matchedField === field;
        const isDimmed = isGroupSatisfied && !isMatched;

        const isCombo = field.includes('+');
        const counterpart = getMatchCounterpart(field);
        const isDeuComboHovered = () => {
            if (!isCombo) return false;
            if (hoveredField === field) return true;
            const counterpartDob = getMatchCounterpart('date_of_birth');
            const counterpartPob = getMatchCounterpart('birthplace');
            return (counterpartDob && hoveredField === counterpartDob) || (counterpartPob && hoveredField === counterpartPob);
        };
        const isHovered = !isDimmed && (hoveredField === field || (counterpart && hoveredField === counterpart) || isDeuComboHovered());
        //const isUnprovided = !isMatched && !counterpart;

        const colorClass = isMatched ? 'bg-green-100 text-green-700' : isDimmed ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-600';
        const cursorClass = isDimmed ? 'cursor-not-allowed' : 'cursor-pointer';
        const borderColorClass = isMatched ? 'border-green-500' : 'border-orange-500';

        return (
            <div
                key={field}
                className="relative group"
                onMouseEnter={() => !isDimmed && setHoveredField(field)}
                onMouseLeave={() => !isDimmed && setHoveredField(null)}
            >
                <div
                    className={`inline-block px-3 py-1 text-sm rounded-full font-medium transition-all duration-300 ease-in-out border-2 ${colorClass} ${cursorClass} ${
                        isHovered ? `scale-105 ${borderColorClass}` : 'border-transparent'
                    } ${isDimmed ? 'opacity-60' : ''}`}
                >
                    {displayContent}
                    {isMatched && <span className="ml-1">✓</span>}
                </div>
                {/* {isUnprovided && isHovered && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-gray-700 text-white text-xs rounded shadow-lg whitespace-nowrap z-10">
                        not provided
                    </div>
                )} */}
            </div>
        );
    };

    return (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-gray-600">And one of these:</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                {isDeuOrGroup(group.fields) ? (
                    <>
                        {renderBadge('id_document_number', getFieldLabel('id_document_number'))}
                        {renderBadge('customer_id', getFieldLabel('customer_id'))}
                        {renderBadge('date_of_birth + birthplace', 
                            <span className="flex items-center gap-1">
                                <span>{getFieldLabel('date_of_birth')}</span>
                                <span className="text-xs">+</span>
                                <span>{getFieldLabel('birthplace')}</span>
                            </span>
                        )}
                    </>
                ) : (
                    group.fields.map((field: string) => renderBadge(field, getFieldLabel(field)))
                )}
            </div>
            
            {/* Additional highlight */}
            {/* {matchedField && (
                <div className="mt-2 text-xs text-green-600">
                    ✓ Matched with: {matchedField.includes('+') ? matchedField : getFieldLabel(matchedField)}
                </div>
            )} */}
        </div>
    );
  };

  // ===================================================================
  // REQUIREMENTS RENDERING
  // ===================================================================

  const renderRequirements = (requirements: any, orGroupMatches: { [groupId: string]: string } = {}, badgeColor = 'bg-blue-100 text-blue-700') => (
    <div className="space-y-4">
      {/* Required Fields (AND groups) */}
      {requirements.requirement_groups
        .filter((group: any) => group.logic === 'AND')
        .map((group: any, index: number) => (
          <div key={`and-${index}`}>
            <h4 className="font-medium text-gray-700 mb-3">Required Fields</h4>
            {renderFieldBadges(group.fields, badgeColor)}
          </div>
        ))}

      {/* Alternative Requirements (OR groups) */}
      {requirements.requirement_groups
        .filter((group: any) => group.logic === 'OR')
        .map((group: any, index: number) => {
          const groupId = `or_group_${index}`;
          const matchedField = orGroupMatches[groupId];
          return (
            <div key={`or-${index}`}>
              {renderOrGroupBadges(group, index, matchedField)}
            </div>
          );
        })}

      {/* Recommended Fields */}
      {requirements.recommended_fields && requirements.recommended_fields.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Recommended Fields</h4>
          {renderFieldBadges(requirements.recommended_fields, 'bg-yellow-100 text-yellow-700')}
        </div>
      )}
    </div>
  );

  // ===================================================================
  // FIELD MATCHES RENDERING
  // ===================================================================

  const renderFieldMatches = (fieldMatches: FieldMatch[]) => {
  if (fieldMatches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No field matches found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {fieldMatches.map((match, index) => {
        const isStrictExact = match.isExactMatch && !match.isOrGroupMatch;
        
        return (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 border rounded-lg ${
              isStrictExact ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            {/* Sumsub Field */}
            <div className="flex-1">
              <span
                onMouseEnter={() => setHoveredField(match.sumsubField)}
                onMouseLeave={() => setHoveredField(null)}
                className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full font-medium"
              >
                {getFieldLabel(match.sumsubField)}
              </span>
            </div>

            {/* Connection Indicator */}
            <div className="shrink-0 flex items-center gap-2">
              {isStrictExact ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="w-8 h-0.5 bg-green-500"></div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="w-8 h-0.5 bg-yellow-500"></div>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                </>
              )}
            </div>

            {/* Counterparty Field */}
            <div className="flex-1 text-right">
              <span
                onMouseEnter={() => setHoveredField(match.counterpartyField)}
                onMouseLeave={() => setHoveredField(null)}
                className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full font-medium"
              >
                {getFieldLabel(match.counterpartyField)}
              </span>
            </div>

            {/* Match Type Indicator */}
            <div className="ml-2">
              {isStrictExact ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Exact</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Link className="w-4 h-4" />
                  <span className="text-xs font-medium">Semantic</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};


  // ===================================================================
  // COMPLIANCE CHECKS RENDERING
  // ===================================================================

  const renderComplianceChecks = (requirements: any) => (
    <div className="space-y-2">
      <h4 className="font-medium text-gray-700 text-sm">Compliance Requirements</h4>
      <div className="grid grid-cols-1 gap-2">
        {[
          { label: 'KYC Required', value: requirements.kyc_required },
          { label: 'AML Screening', value: requirements.aml_required },
          { label: 'Wallet Attribution', value: requirements.wallet_attribution }
        ].map(check => (
          <div key={check.label} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
            {check.value ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <div className="w-4 h-4 border border-gray-300 rounded"></div>
            )}
            <span className="text-sm text-gray-600">{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ===================================================================
  // MAIN RENDER
  // ===================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* ===================================================================
            HEADER SECTION
            =================================================================== */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full">
              <Calculator className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Travel Rule Compliance Check
            </h1>
          </div>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Real-time compliance validation for cross-border virtual asset transfers
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm text-gray-500">
            <span>🇪🇺 EU Regulation (EU) 2015/847</span>
            <span>•</span>
            <span>🇿🇦 ZAF FIC Act</span>
            <span>•</span>
            <span>🇩🇪 DEU GwG + BaFin</span>
          </div>
        </div>

        {/* ===================================================================
            INPUT FORM SECTION
            =================================================================== */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">Transaction Parameters</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Country Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Sumsub VASP Country</label>
              <div className="relative">
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none bg-white"
                  value={input.sumsub_vasp_country}
                  onChange={(e) => handleInputChange('sumsub_vasp_country', e.target.value)}
                >
                  {countries.map(renderCountryOption)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-500">
                Threshold: {getCurrentThreshold()}
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Counterparty VASP Country</label>
              <div className="relative">
                <select
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none bg-white"
                  value={input.counterparty_vasp_country}
                  onChange={(e) => handleInputChange('counterparty_vasp_country', e.target.value)}
                >
                  {countries.map(renderCountryOption)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Customer Type</label>
              <div className="p-3 bg-gray-50 rounded-lg">
                {renderToggleSwitch(
                  input.customer_type === 'company',
                  (value) => handleInputChange('customer_type', value ? 'company' : 'individual'),
                  'Individual',
                  'Company'
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Transfer Direction</label>
              <div className="p-3 bg-gray-50 rounded-lg">
                {renderToggleSwitch(
                  input.transfer_direction === 'IN',
                  (value) => handleInputChange('transfer_direction', value ? 'IN' : 'OUT'),
                  'Outbound',
                  'Inbound'
                )}
              </div>
            </div>

            {/* Amount Field */}
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Transfer Amount
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  value={amountInput}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder={`Enter amount in ${getCurrentCurrency()}`}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-gray-100 rounded text-sm font-medium text-gray-600">
                  {getCurrentCurrency()}
                </div>
              </div>
              {input.transfer_amount > 0 && (
                <p className="text-xs text-gray-500">
                  Amount: {formatCurrency(input.transfer_amount, getCurrentCurrency())}
                  {result && result.converted_amount && (
                    <span> • USD Equivalent: {formatCurrency(result.converted_amount, 'USD')}</span>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ===================================================================
            RESULTS SECTION
            =================================================================== */}
        {result && (
          <div className="space-y-6">
            
            {/* Compliance Status Summary */}
            <div className={`p-6 rounded-xl border-2 ${getComplianceStatusColor(result.compliance_status)}`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{getComplianceStatusIcon(result.compliance_status)}</span>
                <h3 className="text-xl font-semibold">Compliance Status</h3>
                <div className="flex items-center gap-2 ml-auto">
                  {input.transfer_direction === 'OUT' ? (
                    <ArrowUpRight className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ArrowDownLeft className="w-5 h-5 text-gray-500" />
                  )}
                  <span className="text-sm text-gray-600">
                    {input.transfer_direction === 'OUT' ? 'Outbound' : 'Inbound'}
                  </span>
                </div>
              </div>
              
              <p className="text-lg mb-2">{getComplianceStatusMessage(result.compliance_status)}</p>
              <p className="text-base mb-4">{getDetailedComplianceMessage(result.compliance_status, result.field_analysis, input.transfer_direction)}</p>
              
              <div className="flex items-center gap-4 text-sm">
                <span>Amount: {formatCurrency(input.transfer_amount, result.currency)}</span>
                <span>•</span>
                <span>USD Equivalent: {formatCurrency(result.converted_amount || 0, 'USD')}</span>
                <span>•</span>
                <span>Threshold: {result.threshold_met ? 'Above' : 'Below'}</span>
              </div>
            </div>

            {/* Side-by-Side Requirements Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Sumsub VASP Block */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center gap-3 mb-6">
                  {input.transfer_direction === 'OUT' ? (
                    <Send className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Inbox className="w-6 h-6 text-blue-600" />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      Sumsub VASP {input.transfer_direction === 'OUT' ? 'Sends' : 'Expects'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getCountryFlag(input.sumsub_vasp_country)} {getCountryName(input.sumsub_vasp_country)} • {result.threshold_met ? 'Above' : 'Below'} threshold
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {renderRequirements(result.sumsub_requirements, result.field_analysis.or_group_matches)}
                  {renderComplianceChecks(result.sumsub_requirements)}
                </div>
              </div>

              {/* Counterparty VASP Block */}
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                <div className="flex items-center gap-3 mb-6">
                  {input.transfer_direction === 'OUT' ? (
                    <Inbox className="w-6 h-6 text-purple-600" />
                  ) : (
                    <Send className="w-6 h-6 text-purple-600" />
                  )}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      Counterparty VASP {input.transfer_direction === 'OUT' ? 'Expects' : 'Sends'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getCountryFlag(input.counterparty_vasp_country)} {getCountryName(input.counterparty_vasp_country)} • {result.threshold_met ? 'Above' : 'Below'} threshold
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {renderRequirements(result.counterparty_requirements, result.field_analysis.or_group_matches, 'bg-purple-100 text-purple-700')}
                  {renderComplianceChecks(result.counterparty_requirements)}
                </div>
              </div>
            </div>

            {/* Enhanced Field Analysis with Visual Matching */}
            {result.field_analysis && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-6">Field Analysis</h3>
                
                {/* Field Matches Section */}
                {result.field_analysis.field_matches.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-800">
                        Field Matches ({result.field_analysis.field_matches.length})
                      </span>
                    </div>
                    {renderFieldMatches(result.field_analysis.field_matches)}
                    
                    <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Exact Match</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span>Semantic Match</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other Analysis Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Extra Fields */}
                  {(result.field_analysis.sumsub_sends_more.length > 0 || result.field_analysis.counterparty_sends_more.length > 0) && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Plus className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-blue-800">
                          Additional Fields ({input.transfer_direction === 'OUT' ? result.field_analysis.sumsub_sends_more.length : result.field_analysis.counterparty_sends_more.length})
                        </span>
                      </div>
                      {renderFieldBadges(
                        input.transfer_direction === 'OUT' ? result.field_analysis.sumsub_sends_more : result.field_analysis.counterparty_sends_more,
                        'bg-blue-100 text-blue-700',
                        false
                      )}
                      <p className="text-xs text-blue-600 mt-2">Overcompliance - acceptable</p>
                    </div>
                  )}

                  {/* Missing Fields */}
                  {result.field_analysis.missing_fields.length > 0 && (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Minus className="w-5 h-5 text-orange-600" />
                        <span className="font-medium text-orange-800">
                          Missing Fields ({result.field_analysis.missing_fields.length})
                        </span>
                      </div>
                      {renderFieldBadges(result.field_analysis.missing_fields, 'bg-orange-100 text-orange-700', false)}
                      <p className="text-xs text-orange-600 mt-2">
                        {input.transfer_direction === 'OUT' 
                          ? 'Counterparty may request additional data'
                          : 'Sender may not provide required data'
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug View Toggle */}
            <div className="text-center">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                {showDebug ? 'Hide' : 'Show'} Debug View
              </button>
            </div>

            {/* Debug View */}
{showDebug && (
  <div className="bg-white rounded-xl shadow-lg p-6">
    <div className="flex items-center gap-2 mb-6">
      <AlertCircle className="w-5 h-5 text-gray-600" />
      <h3 className="text-xl font-semibold text-gray-800">Debug Information</h3>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Sumsub Block */}
      <div>
        <h4 className="font-medium text-gray-700 mb-4">Sumsub VASP Requirement Groups</h4>
        <div className="space-y-3">
          {result.sumsub_requirements.requirement_groups.map((group, index) => (
            <div key={index} className="p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs rounded ${
                  group.logic === 'AND' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {group.logic}
                </span>
                <span className="text-sm text-gray-600">
                  {group.logic === 'AND' ? 'All fields required' : 'At least one field required'}
                </span>
              </div>

              {group.logic === 'OR' && isDeuOrGroup(group.fields) ? (
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                    ID Document Number
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                    Customer Internal ID
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                    Date of Birth + Place of Birth
                  </span>
                </div>
              ) : (
                renderFieldBadges(group.fields, 'bg-gray-100 text-gray-700', false)
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Counterparty Block */}
      <div>
        <h4 className="font-medium text-gray-700 mb-4">Counterparty VASP Requirement Groups</h4>
        <div className="space-y-3">
          {result.counterparty_requirements.requirement_groups.map((group, index) => (
            <div key={index} className="p-3 border rounded-lg bg-gray-50">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 text-xs rounded ${
                  group.logic === 'AND' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {group.logic}
                </span>
                <span className="text-sm text-gray-600">
                  {group.logic === 'AND' ? 'All fields required' : 'At least one field required'}
                </span>
              </div>

              {group.logic === 'OR' && isDeuOrGroup(group.fields) ? (
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                    ID Document Number
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                    Customer Internal ID
                  </span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full font-medium">
                    Date of Birth + Place of Birth
                  </span>
                </div>
              ) : (
                renderFieldBadges(group.fields, 'bg-gray-100 text-gray-700', false)
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  </div>
)}

          </div>
        )}
      </div>
    </div>
  );
};

export default TravelRuleCalculator;