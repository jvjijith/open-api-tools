import { CanonicalSpec } from './ir';
import { MergePolicy, ValidationReport, ValidationMatrixRow } from './types';

/**
 * Validates version compatibility across all active specifications based on the MergePolicy.
 * In Strict Mode, rejects incompatible spec types and cross-version merges.
 * In Compatibility Mode, logs migration warning entries and logs.
 */
export function validateCompatibility(
  specs: CanonicalSpec[],
  policy: MergePolicy
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const migrationLogs: string[] = [];
  const matrix: ValidationMatrixRow[] = [];

  if (specs.length <= 1) {
    // Single spec or empty is always compatible
    return {
      isValid: true,
      errors,
      warnings,
      matrix,
      migrationLogs: specs.length === 1 ? [`[Validator] Single spec "${specs[0].name}" loaded. Version: ${specs[0].originalVersion} (${specs[0].detectedFormat}). Spec is valid.` ] : []
    };
  }

  migrationLogs.push('[Validator] Initializing compatibility checks...');
  migrationLogs.push(`[Policy] Strict Validation: ${policy.strictValidation}`);
  migrationLogs.push(`[Policy] Allow Cross-Version Merge: ${policy.allowCrossVersionMerge}`);
  migrationLogs.push(`[Policy] Allow Minor Version Mismatch: ${policy.allowMinorVersionMismatch}`);
  migrationLogs.push(`[Policy] Target Output Version: ${policy.targetOutputVersion}`);

  // Pairwise compare all specs
  for (let i = 0; i < specs.length; i++) {
    for (let j = i + 1; j < specs.length; j++) {
      const specA = specs[i];
      const specB = specs[j];
      
      const formatA = specA.detectedFormat;
      const formatB = specB.detectedFormat;

      let status: ValidationMatrixRow['status'] = 'compatible';
      let message = '✅ Specifications are fully compatible.';

      // Case 1: Cross-version mismatch (Swagger 2.0 vs OpenAPI 3.x)
      const isCrossVersion = 
        (formatA === 'swagger2' && formatB.startsWith('openapi3')) ||
        (formatB === 'swagger2' && formatA.startsWith('openapi3'));

      // Case 2: Minor version mismatch (OpenAPI 3.0 vs OpenAPI 3.1)
      const isMinorMismatch = 
        (formatA === 'openapi3.0' && formatB === 'openapi3.1') ||
        (formatB === 'openapi3.0' && formatA === 'openapi3.1');

      if (isCrossVersion) {
        if (!policy.allowCrossVersionMerge) {
          status = 'incompatible';
          message = `❌ Cross-version merging disabled in Strict Mode.`;
          errors.push(
            `Incompatible specification versions detected.\n` +
            `- "${specA.name}" is ${formatA === 'swagger2' ? 'Swagger 2.0' : `OpenAPI ${specA.originalVersion}`}\n` +
            `- "${specB.name}" is ${formatB === 'swagger2' ? 'Swagger 2.0' : `OpenAPI ${specB.originalVersion}`}\n` +
            `Cross-version merging is disabled in Strict Mode.`
          );
          migrationLogs.push(`[Validator Error] Clash between "${specA.name}" and "${specB.name}": Swagger 2.0 cannot be merged with OpenAPI 3.x in Strict Mode.`);
        } else {
          status = 'minor_warning';
          message = `⚠ Cross-version merge active. Older specs will be upgraded to ${policy.targetOutputVersion}.`;
          warnings.push(`⚠ Swagger spec "${formatA === 'swagger2' ? specA.name : specB.name}" will be automatically upgraded to OpenAPI ${policy.targetOutputVersion} before merge.`);
          migrationLogs.push(`[Upgrade Log] Detected Swagger 2.0 in cross-version merge. Normalizing schemas to components structure...`);
        }
      } else if (isMinorMismatch) {
        if (!policy.allowMinorVersionMismatch) {
          status = 'incompatible';
          message = `❌ Minor version mismatch disabled in Strict Mode.`;
          errors.push(
            `Divergent minor OpenAPI versions detected.\n` +
            `- "${specA.name}" is OpenAPI ${specA.originalVersion}\n` +
            `- "${specB.name}" is OpenAPI ${specB.originalVersion}\n` +
            `Merging OpenAPI 3.0.x with OpenAPI 3.1.x is disabled in Strict Mode.`
          );
          migrationLogs.push(`[Validator Error] Clash between "${specA.name}" and "${specB.name}": Divergent minor versions (3.0.x vs 3.1.x) blocked.`);
        } else {
          status = 'minor_warning';
          message = `⚠ Minor version mismatch active. Will consolidate to standard OpenAPI ${policy.targetOutputVersion}.`;
          warnings.push(`⚠ Divergent OpenAPI minor versions (3.0.x vs 3.1.x) will be consolidated to OpenAPI ${policy.targetOutputVersion}.`);
          migrationLogs.push(`[Consolidation Log] Re-wiring OpenAPI 3.1 schemas to standard 3.0 structure...`);
        }
      }

      matrix.push({
        specAName: specA.name,
        specAVersion: specA.originalVersion,
        specBName: specB.name,
        specBVersion: specB.originalVersion,
        status,
        message
      });
    }
  }

  // Log active upgrade steps if any spec is upgraded
  specs.forEach(s => {
    if (s.detectedFormat === 'swagger2' && policy.allowCrossVersionMerge) {
      migrationLogs.push(`[Migration] Upgrading "${s.name}" (Swagger 2.0) -> OpenAPI ${policy.targetOutputVersion}`);
      migrationLogs.push(`[Migration] Mapping definitions in "${s.name}" to components.schemas`);
      migrationLogs.push(`[Migration] Mapping securityDefinitions in "${s.name}" to components.securitySchemes`);
      migrationLogs.push(`[Migration] Rewriting schema $ref links from #/definitions/ to #/components/schemas/`);
    } else if (s.detectedFormat === 'openapi3.1' && policy.allowMinorVersionMismatch && policy.targetOutputVersion === '3.0.0') {
      migrationLogs.push(`[Migration] Consolidating "${s.name}" (OpenAPI 3.1.x) -> OpenAPI 3.0.x`);
      migrationLogs.push(`[Migration] Down-leveling examples, standardizing type declarations inside schemas...`);
    }
  });

  const isValid = errors.length === 0;
  if (isValid) {
    migrationLogs.push('[Validator] Compatibility checks passed successfully. AST generation enabled.');
  } else {
    migrationLogs.push('[Validator Error] Compatibility checks failed. Merge compilation aborted.');
  }

  return {
    isValid,
    errors,
    warnings,
    matrix,
    migrationLogs
  };
}
