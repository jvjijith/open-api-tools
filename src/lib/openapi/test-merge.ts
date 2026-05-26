import { parseSpec } from './parser';
import { buildDependencyGraph, resolveDependencies } from './graph';
import { detectConflicts, compileMergedSpecs } from './merger';
import { validateCompatibility } from './validator';
import { USERS_SERVICE_TEMPLATE, PAYMENTS_SERVICE_TEMPLATE } from './templates';
import { MergePolicy } from './types';

function runTest() {
  console.log('=== STARTING APIMERGE ARCHITECTURE INTEGRATION TEST ===\n');

  // 1. Load raw specifications into Canonical AST IR format
  console.log('1. Parsing specs into Canonical spec IR models...');
  const specA = parseSpec('spec-a', 'users-service.yaml', USERS_SERVICE_TEMPLATE);
  const specB = parseSpec('spec-b', 'payments-service.yaml', PAYMENTS_SERVICE_TEMPLATE);
  console.log(`- Parsed Spec A ("${specA.name}"): OAS Format: ${specA.detectedFormat}, Version: ${specA.originalVersion}`);
  console.log(`- Parsed Spec B ("${specB.name}"): OAS Format: ${specB.detectedFormat}, Version: ${specB.originalVersion}\n`);

  // 2. Test compatibility validator under default Strict Mode
  console.log('2. Testing Compatibility Validator in Strict Mode (Default)...');
  const strictPolicy: MergePolicy = {
    allowCrossVersionMerge: false,
    allowMinorVersionMismatch: false,
    strictValidation: true,
    targetOutputVersion: '3.0.0'
  };

  // Temporarily downgrade Spec A to Swagger 2.0 to trigger cross-version validation check
  const swaggerSpecA = {
    ...specA,
    detectedFormat: 'swagger2' as const,
    originalVersion: '2.0'
  };

  const strictReport = validateCompatibility([swaggerSpecA, specB], strictPolicy);
  console.log(`- Validator block status: isValid = ${strictReport.isValid} (Expected: false)`);
  console.log(`- Validation errors found: ${strictReport.errors.length}`);
  if (!strictReport.isValid && strictReport.errors.length > 0) {
    console.log('  * Verification SUCCESS: Incompatible specifications successfully blocked under Strict Mode!');
    console.log(`    Validation error message:\n    "${strictReport.errors[0].replace(/\n/g, '\n    ')}"\n`);
  } else {
    throw new Error('Strict validation failed to block cross-version specs.');
  }

  // 3. Test compatibility validator under Compatibility Mode
  console.log('3. Testing Compatibility Validator in Compatibility Mode (Advanced)...');
  const compatPolicy: MergePolicy = {
    allowCrossVersionMerge: true,
    allowMinorVersionMismatch: true,
    strictValidation: false,
    targetOutputVersion: '3.0.0'
  };

  const compatReport = validateCompatibility([swaggerSpecA, specB], compatPolicy);
  console.log(`- Validator block status: isValid = ${compatReport.isValid} (Expected: true)`);
  console.log(`- Validator warnings logged: ${compatReport.warnings.length}`);
  console.log(`- Validator migration logs: ${compatReport.migrationLogs.length}`);
  if (compatReport.isValid && compatReport.migrationLogs.length > 0) {
    console.log('  * Verification SUCCESS: Compatibility mode upgrade pipeline passed successfully!');
    console.log('    First migration log entry:', compatReport.migrationLogs[0]);
    console.log('    Log entries:\n    ' + compatReport.migrationLogs.filter(l => l.startsWith('[Migration]')).slice(0, 3).join('\n    ') + '\n');
  } else {
    throw new Error('Compatibility validation failed to allow normalized cross-version specs.');
  }

  // 4. Test Dependency Graph Builder and Conflict Detection
  console.log('4. Compiling AST Dependency Graph and detecting conflicts...');
  const graph = buildDependencyGraph([specA, specB]);
  const selectedEndpointIds = Array.from(graph.endpoints.keys());
  const resolved = resolveDependencies(selectedEndpointIds, graph);
  const conflicts = detectConflicts([specA, specB], selectedEndpointIds, graph, resolved);
  console.log(`- Extracted endpoints: ${graph.endpoints.size}`);
  console.log(`- Extracted schemas: ${graph.schemas.size}`);
  console.log(`- Active conflicts identified: ${conflicts.length}`);

  const userConflict = conflicts.find(c => c.type === 'schema' && c.name === 'User');
  if (userConflict) {
    userConflict.resolution = 'rename';
    userConflict.resolvedRename = 'BillingUser';
    console.log('  * Resolved schema conflict for "User": Renamed Spec B\'s model to "BillingUser"\n');
  }

  // 5. Verify Compiler Generation targets (OAS 3.0 vs Swagger 2.0 serialization)
  console.log('5. Testing Multi-Format Target Compiler Generation...');

  // Test OpenAPI 3.0.3 compilation
  console.log('  A) Compiling to OpenAPI 3.0.3 (OAS 3.0)...');
  const oasCompilation = compileMergedSpecs(
    [specA, specB],
    selectedEndpointIds,
    graph,
    resolved,
    conflicts,
    { title: 'Gateway Spec', version: '1.0.0', description: 'Consolidated Spec' },
    { ...compatPolicy, targetOutputVersion: '3.0.0' }
  );
  console.log(`     - Root declaration in YAML: "${oasCompilation.yamlString.split('\n')[0]}" (Expected: openapi: 3.0.0)`);
  console.log(`     - Contains components.schemas: ${oasCompilation.yamlString.includes('components:') && oasCompilation.yamlString.includes('schemas:')}`);

  const rewrittenRef = oasCompilation.specObject.components.schemas.Payment.properties.userProfile['$ref'];
  console.log(`     - Internal $ref rewritten: "${rewrittenRef}" (Expected: #/components/schemas/BillingUser)`);
  if (oasCompilation.yamlString.startsWith('openapi: 3.0.0') && rewrittenRef === '#/components/schemas/BillingUser') {
    console.log('     * Sub-test SUCCESS: OpenAPI 3.0 output compiles and rewrites refs flawlessly!\n');
  } else {
    throw new Error('OpenAPI compiler output validation failed.');
  }

  // Test Swagger 2.0 compilation
  console.log('  B) Compiling to Swagger 2.0...');
  const swaggerCompilation = compileMergedSpecs(
    [specA, specB],
    selectedEndpointIds,
    graph,
    resolved,
    conflicts,
    { title: 'Gateway Spec', version: '1.0.0', description: 'Consolidated Spec' },
    { ...compatPolicy, targetOutputVersion: '2.0' }
  );
  console.log(`     - Root declaration in YAML: "${swaggerCompilation.yamlString.split('\n')[0]}" (Expected: swagger: '2.0')`);
  console.log(`     - Contains root definitions: ${swaggerCompilation.yamlString.includes('definitions:')}`);

  const swaggerRewrittenRef = swaggerCompilation.specObject.definitions.Payment.properties.userProfile['$ref'];
  console.log(`     - Internal $ref rewritten: "${swaggerRewrittenRef}" (Expected: #/definitions/BillingUser)`);
  if (swaggerCompilation.yamlString.startsWith('swagger:') && swaggerRewrittenRef === '#/definitions/BillingUser') {
    console.log('     * Sub-test SUCCESS: Swagger 2.0 output compiles and rewrites refs flawlessly!\n');
  } else {
    throw new Error('Swagger compiler output validation failed.');
  }

  console.log('=== ALL ARCHITECTURE INTEGRATION TESTS PASSED ===');
}

runTest();
