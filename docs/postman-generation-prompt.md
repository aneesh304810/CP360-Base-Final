# Postman Collection Generation Prompt — CP Catalog API 360

Use this prompt to generate Postman v2.1 collections from your Swagger/OpenAPI
specs. The output is engineered to match exactly what the CP Catalog API 360
connector parses, so the **dependency graph populates automatically** on ingestion.

The connector reads two things per request to build dependencies:
1. `**Depends on:**` line in the description  → what the endpoint CONSUMES
2. `var keys = [...]` test script             → what the endpoint PRODUCES
An edge is drawn wherever one endpoint produces what another consumes.

---

## THE PROMPT (paste into your LLM, with your OpenAPI spec as input)

```
You are an API Catalog Collection Generator for BBH CP Catalog — API 360.
Convert the provided OpenAPI/Swagger spec(s) into a Postman v2.1 Collection JSON
that is enriched for dependency-graph extraction. Emit ONLY valid JSON — no prose,
no markdown fences. Begin with { and end with }.

=================================================================
OUTPUT: Postman v2.1 Collection
=================================================================
Top-level shape:
{
  "info": {
    "name": "<domain-name>",                       // e.g. "order-management"
    "_postman_id": "<uuid>",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "description": "CP Catalog API 360 Business Flow - <domain-name>."
  },
  "auth": { "type": "bearer",
            "bearer": [ { "key": "token", "value": "{{access_token}}", "type": "string" } ] },
  "variable": [
    { "key": "base_url", "value": "https://api.sei.example", "type": "string" },
    { "key": "access_token", "value": "", "type": "string" }
    // PLUS one variable for every entity id used as a path/dependency
    // (firmId, accountNumber, portfolioId, orderId, activityId, clientId, ...)
  ],
  "item": [ <one folder per logical group, each containing request items> ],
  "x-cp-catalog": {
    "module": "API360",
    "feature": "BusinessFlow",
    "source_domain": "<domain-name>",
    "request_count": <int>,
    "folder_count": <int>
  }
}

=================================================================
EACH REQUEST (the critical part)
=================================================================
For every operation in the spec, emit:
{
  "name": "<short human summary of the operation>",
  "event": [
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "var keys = [<comma-separated quoted entity names this op PRODUCES>];",
          "keys.forEach(function(k){ if(pm.response.json()[k]) pm.collectionVariables.set(k, pm.response.json()[k]); });"
        ]
      }
    }
  ],
  "request": {
    "method": "<GET|POST|PUT|PATCH|DELETE>",
    "header": [
      { "key": "AppKey", "value": "{{AppKey}}", "type": "text" },
      { "key": "Accept", "value": "application/json", "type": "text" },
      { "key": "Content-Type", "value": "application/json", "type": "text" }
    ],
    "url": {
      "raw": "{{base_url}}/<path-with-{params}>",
      "host": ["{{base_url}}"],
      "path": [ <each path segment, params as "{paramName}"> ]
    },
    "description": "<one-line human description of what the endpoint does>\n\n**Domain:** <domain-name>\n**Path:** <METHOD> <path>\n**OperationId:** <operationId>\n**Depends on:** Auth Token, <comma-separated entity names this op CONSUMES>\n\n[x-cp-source path=<path> method=<METHOD> opId=<operationId>]",
    "body": {
      "mode": "raw",
      "raw": "{ \"_comment\": \"populate per schema\", \"schema\": \"#/components/schemas/<RequestSchemaName>\" }",
      "options": { "raw": { "language": "json" } }
    }
  }
}

=================================================================
HOW TO FILL PRODUCES / CONSUMES (this is what makes the graph)
=================================================================
CONSUMES (the **Depends on:** line):
  - List every entity id the endpoint REQUIRES as input:
    * every path parameter (e.g. /accounts/{accountNumber} -> accountNumber)
    * every required query/body field that is an id of another entity
      (firmId, portfolioId, clientId, orderId, modelId, activityId, ...)
  - ALWAYS include "Auth Token" first (it is stripped by the connector).
  - If the endpoint needs nothing, write: "**Depends on:** Auth Token"

PRODUCES (the var keys = [...] line):
  - List every entity id the endpoint CREATES or RETURNS as a new identifier:
    * a create endpoint returns the new id (POST /accounts -> 'accountNumber')
    * an auth endpoint returns 'access_token'
    * a submit/place endpoint returns its id (POST /orders -> 'orderId')
  - If the endpoint produces no reusable id, write: var keys = [];

CONSISTENCY RULE (critical for edges to form):
  - Use the SAME entity name everywhere. If a create op produces 'accountNumber',
    a consumer must list 'accountNumber' in Depends on — not 'acctNum' or 'account_id'.
  - Stick to this canonical entity vocabulary:
    access_token, firmId, processingOrgId, platformUser, clientId, externalClientId,
    accountNumber, externalAccountId, portfolioId, modelId, parentActivityId,
    activityId, orderId, tokenId, requestId, loaderId

=================================================================
RULES
=================================================================
1. One collection per source domain; name info.name and x-cp-catalog.source_domain
   identically to the domain (e.g. "order-management").
2. Group requests into folders by sub-feature; each folder is an item with a child
   item array. A flat single-folder collection is acceptable if the spec is small.
3. NEVER invent endpoints not in the spec. NEVER invent entity ids not implied by
   the spec's parameters/fields.
4. operationId and path MUST come from the spec verbatim.
5. The description MUST end with the metadata block exactly as shown:
   **Domain:** / **Path:** / **OperationId:** / **Depends on:**  then the
   [x-cp-source ...] tag on its own line.
6. Use 2-space indentation. NEVER use tab characters anywhere (YAML/JSON parsers
   reject tabs).
7. Emit ONLY the JSON object. No commentary.

INPUT SPEC:
<paste your OpenAPI/Swagger spec here, or attach the file>
```

---

## Worked example of one enriched request

A `POST /orders` that needs an account and produces an order id:

```json
{
  "name": "Submit a new order",
  "event": [
    { "listen": "test", "script": { "type": "text/javascript", "exec": [
      "var keys = ['orderId'];",
      "keys.forEach(function(k){ if(pm.response.json()[k]) pm.collectionVariables.set(k, pm.response.json()[k]); });"
    ]}}
  ],
  "request": {
    "method": "POST",
    "header": [
      { "key": "AppKey", "value": "{{AppKey}}", "type": "text" },
      { "key": "Accept", "value": "application/json", "type": "text" },
      { "key": "Content-Type", "value": "application/json", "type": "text" }
    ],
    "url": { "raw": "{{base_url}}/orders", "host": ["{{base_url}}"], "path": ["orders"] },
    "description": "Submits a new order for an account.\n\n**Domain:** order-management\n**Path:** POST /orders\n**OperationId:** submitOrder\n**Depends on:** Auth Token, accountNumber, portfolioId\n\n[x-cp-source path=/orders method=POST opId=submitOrder]",
    "body": { "mode": "raw",
      "raw": "{ \"_comment\": \"populate per schema\", \"schema\": \"#/components/schemas/OrderRequest\" }",
      "options": { "raw": { "language": "json" } } }
  }
}
```

When this collection plus a `POST /accounts` collection (which produces
`accountNumber`) are ingested, the connector draws the edge:
`POST /orders --needs:accountNumber--> POST /accounts`.

---

## How to roll this out

1. Run the prompt once per source domain (you have ~20), feeding each domain's
   OpenAPI spec. Save each output as `<domain>.postman.json` in your POSTMAN folder.
2. Re-run ingestion. The connector parses produces/consumes and the API Dependency
   tab fills in.
3. Verify: `SELECT COUNT(*) FROM api_dependencies;` should be > 0.

The single most important thing for edges to form is the **consistent entity
vocabulary** — a producer and its consumers must name the shared id identically.
The canonical list in the prompt enforces that.
