export interface OpenAPISpec {
  id: string;
  name: string;
  content: string; // original raw text (YAML or JSON)
  parsed: any;     // parsed JS object representation
  version: string;  // e.g. '3.0.x' or '2.0' (Swagger)
}

export interface EndpointNode {
  id: string;        // unique key: specId + "::" + path + "::" + method
  specId: string;
  specName: string;
  path: string;
  method: string;    // 'get', 'post', 'put', 'delete', 'patch', etc.
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  security?: any[];
  refs: string[];    // direct $ref values like "#/components/schemas/User"
}

export interface SchemaNode {
  name: string;      // key inside components.schemas (e.g., "User")
  specId: string;
  specName: string;
  raw: any;          // raw schema JSON definition
  refs: string[];    // schemas referenced inside this schema (directly)
}

export interface SecurityNode {
  name: string;      // key inside components.securitySchemes
  specId: string;
  specName: string;
  raw: any;
}

export interface ParameterNode {
  name: string;      // key inside components.parameters
  specId: string;
  specName: string;
  raw: any;
}

export interface ResponseNode {
  name: string;      // key inside components.responses
  specId: string;
  specName: string;
  raw: any;
}

export interface DependencyGraph {
  endpoints: Map<string, EndpointNode>;
  schemas: Map<string, SchemaNode>;       // key is specId + "::" + schemaName
  securitySchemes: Map<string, SecurityNode>; // key is specId + "::" + name
  parameters: Map<string, ParameterNode>; // key is specId + "::" + name
  responses: Map<string, ResponseNode>;   // key is specId + "::" + name
}

export type ConflictType = 'schema' | 'path' | 'security';

export interface MergeConflict {
  id: string;        // unique clash identifier
  type: ConflictType;
  name: string;      // conflicting key, e.g. schema name "User" or path "/users::get"
  specAId: string;
  specAName: string;
  specBId: string;
  specBName: string;
  itemA: any;        // original definition in spec A
  itemB: any;        // original definition in spec B
  resolution: 'keepA' | 'keepB' | 'rename' | 'manual' | null;
  resolvedRename?: string;
  resolvedManualContent?: any;
}

export interface MergeSession {
  specs: OpenAPISpec[];
  selectedEndpoints: string[]; // array of EndpointNode.id
  conflicts: MergeConflict[];
  globalMetadata: {
    title: string;
    version: string;
    description: string;
  };
}

export interface ResolvedDependencies {
  schemas: Set<string>;        // set of "specId::schemaName" keys
  securitySchemes: Set<string>; // set of "specId::schemeName" keys
  parameters: Set<string>;     // set of "specId::paramName" keys
  responses: Set<string>;      // set of "specId::responseName" keys
}

export interface MergePolicy {
  allowCrossVersionMerge: boolean;
  allowMinorVersionMismatch: boolean;
  strictValidation: boolean;
  targetOutputVersion: '2.0' | '3.0.0' | '3.1.0';
}

export interface ValidationMatrixRow {
  specAName: string;
  specAVersion: string;
  specBName: string;
  specBVersion: string;
  status: 'compatible' | 'minor_warning' | 'incompatible';
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  matrix: ValidationMatrixRow[];
  migrationLogs: string[];
}

