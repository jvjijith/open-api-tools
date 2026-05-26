export const USERS_SERVICE_TEMPLATE = `openapi: 3.0.0
info:
  title: Users Service API
  version: 1.4.0
  description: Microservice managing user accounts, profiles, and permissions.
paths:
  /users:
    get:
      summary: Retrieve all users
      tags:
        - Users
      parameters:
        - name: limit
          in: query
          description: Limit the number of users returned
          required: false
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: A list of users
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
        '500':
          description: Internal error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    post:
      summary: Create a new user
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserCreate'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: Invalid request body
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /users/{id}:
    get:
      summary: Retrieve user by ID
      tags:
        - Users
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: User details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      name: X-API-Key
      in: header
  schemas:
    User:
      type: object
      required:
        - id
        - username
        - email
      properties:
        id:
          type: integer
          format: int64
          example: 10243
        username:
          type: string
          example: developer_neo
        email:
          type: string
          format: email
          example: neo@matrix.io
        status:
          type: string
          enum: [ACTIVE, SUSPENDED, PENDING]
          default: ACTIVE
        address:
          $ref: '#/components/schemas/Address'
    
    UserCreate:
      type: object
      required:
        - username
        - email
      properties:
        username:
          type: string
        email:
          type: string
        address:
          $ref: '#/components/schemas/Address'

    Address:
      type: object
      properties:
        street:
          type: string
          example: 101 Antigravity Way
        city:
          type: string
          example: Silicon Valley
        zipcode:
          type: string
          example: "94025"

    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          example: 500
        message:
          type: string
          example: An unexpected system error occurred.
`;

export const PAYMENTS_SERVICE_TEMPLATE = `openapi: 3.0.0
info:
  title: Billing & Payments API
  version: 2.1.0
  description: Microservice handling payment records, invoices, and billing subscriptions.
paths:
  /payments:
    get:
      summary: Fetch transaction logs
      tags:
        - Billing
      security:
        - ApiKeyAuth: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [PAID, FAILED, PENDING]
      responses:
        '200':
          description: List of transactions
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Payment'
        '401':
          description: Unauthorized
        '500':
          description: Server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /users/{id}/payments:
    get:
      summary: Retrieve invoices for a specific user
      tags:
        - Billing
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Array of billing schemas
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Payment'
        '404':
          description: Billing records not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      name: Authorization
      in: header
  schemas:
    Payment:
      type: object
      required:
        - id
        - amount
        - userId
        - status
      properties:
        id:
          type: string
          example: txn_7b82f9c
        amount:
          type: number
          format: double
          example: 99.95
        currency:
          type: string
          default: USD
        userId:
          type: string
          description: Link to User.id (UUID string version)
        status:
          type: string
          enum: [PAID, FAILED, PENDING]
        userProfile:
          $ref: '#/components/schemas/User'

    User:
      type: object
      required:
        - id
        - name
        - activeBilling
      properties:
        id:
          type: string
          format: uuid
          example: "e6f859a1-cb3a-4db3-96b0"
        name:
          type: string
          example: Thomas Anderson
        activeBilling:
          type: boolean
          default: true
        tier:
          type: string
          enum: [FREE, PROFESSIONAL, ENTERPRISE]
          default: FREE

    Error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          example: 500
        message:
          type: string
          example: An unexpected system error occurred.
`;
