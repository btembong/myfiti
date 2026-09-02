import type { OpenAPIV3 } from 'openapi-types'

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Myfiti / GymFlow API',
    version: '1.0.0',
    description: `
## Overview
The GymFlow API powers gym management, member self-service, and public registration.

**Base URL:** \`https://api.myfiti.fit/api\`

## Authentication
Most endpoints require a **Bearer JWT token** in the \`Authorization\` header.

\`\`\`
Authorization: Bearer <token>
\`\`\`

Tokens are obtained from \`POST /auth/login\` (owner/staff) or \`POST /auth/member/verify-otp\` (members).

## Multi-Tenancy
Admin endpoints require the gym's slug in the \`X-Tenant-Slug\` header:

\`\`\`
X-Tenant-Slug: korafit
\`\`\`

## Roles
- **owner** – Full access to all admin endpoints
- **admin** – Most admin endpoints (no billing/account deletion)
- **receptionist** – Check-in, members, day passes
- **trainer** – Classes, check-ins, member view
- **member** – Self-service endpoints only (\`/member/me/*\`, \`/member/wallet/*\`)
    `,
    contact: { name: 'Myfiti Support', email: 'support@myfiti.fit' },
  },
  servers: [
    { url: 'https://api.myfiti.fit/api', description: 'Production' },
    { url: 'http://localhost:4000/api', description: 'Local development' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from /auth/login or /auth/member/verify-otp',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Member not found.' },
        },
      },
      Member: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'expiring_soon', 'grace_period', 'expired', 'suspended', 'pending'] },
          gender: { type: 'string', enum: ['male', 'female', 'other'], nullable: true },
          date_of_birth: { type: 'string', format: 'date', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          price: { type: 'number' },
          currency: { type: 'string', example: 'XAF' },
          duration_days: { type: 'integer' },
          cycle: { type: 'string', enum: ['monthly', 'quarterly', 'biannual', 'annual', 'custom'] },
          is_active: { type: 'boolean' },
        },
      },
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          member_id: { type: 'string', format: 'uuid' },
          plan_id: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['active', 'pending', 'expiring_soon', 'grace_period', 'expired', 'cancelled'] },
          started_at: { type: 'string', format: 'date-time' },
          expires_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          member_id: { type: 'string', format: 'uuid' },
          amount: { type: 'number' },
          currency: { type: 'string', example: 'XAF' },
          method: { type: 'string', enum: ['cash', 'mobile_money', 'wallet', 'card'] },
          status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
          reference: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      GymInfo: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          logo_url: { type: 'string', nullable: true },
          primary_color: { type: 'string', example: '#6366f1' },
          currency: { type: 'string', example: 'XAF' },
          address: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
        },
      },
    },
    parameters: {
      TenantSlug: {
        name: 'X-Tenant-Slug',
        in: 'header',
        required: true,
        schema: { type: 'string', example: 'korafit' },
        description: 'Gym slug for tenant resolution',
      },
    },
  },
  tags: [
    { name: 'Public', description: 'No authentication required. Used by kiosk, member self-registration, and renewal pages.' },
    { name: 'Auth', description: 'Login, registration, OTP verification, and password reset.' },
    { name: 'Onboarding', description: 'Owner onboarding flow — complete gym setup after registration.' },
    { name: 'Members', description: 'Admin member management — list, create, update, import.' },
    { name: 'Subscriptions', description: 'Subscription plans and member subscription management.' },
    { name: 'Payments', description: 'Payment records, Tranzak payment initiation, receipts, and refunds.' },
    { name: 'Check-in', description: 'QR code check-in, PIN check-in, kiosk flows, and live event streams.' },
    { name: 'Classes', description: 'Class scheduling, booking, and attendance.' },
    { name: 'Day Passes', description: 'Day pass issuance, kiosk payment, and wallet-based passes.' },
    { name: 'Vouchers', description: 'Discount voucher generation and management.' },
    { name: 'Analytics', description: 'Dashboard metrics, revenue, retention, and capacity reports.' },
    { name: 'Settings', description: 'Gym profile, staff management, billing, integrations, and notifications.' },
    { name: 'Announcements', description: 'Push announcements to members.' },
    { name: 'Member Self-Service', description: 'Authenticated member endpoints — profile, bookings, renew, wallet.' },
    { name: 'Member Wallet', description: 'Member wallet — balance, top-up, transfer, cashout, subscription payment.' },
    { name: 'Webhooks', description: 'Incoming webhooks from Tranzak payment gateway.' },
    { name: 'SuperAdmin', description: 'Platform administration — gyms, revenue, billing, flags, impersonation.' },
  ],
  paths: {

    // ─── PUBLIC ──────────────────────────────────────────────────────────────

    '/public/gym/{slug}': {
      get: {
        tags: ['Public'],
        summary: 'Get gym info',
        description: 'Returns gym name, logo, colors, and contact info. Used by kiosk and public pages.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, example: 'korafit' }],
        responses: {
          200: { description: 'Gym info', content: { 'application/json': { schema: { type: 'object', properties: { gym: { $ref: '#/components/schemas/GymInfo' } } } } } },
          404: { description: 'Gym not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    '/public/gym/{slug}/plans': {
      get: {
        tags: ['Public'],
        summary: 'List active membership plans',
        description: 'Returns all active plans for the gym. Used on kiosk and self-registration page.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Plans list', content: { 'application/json': { schema: { type: 'object', properties: { plans: { type: 'array', items: { $ref: '#/components/schemas/Plan' } } } } } } },
        },
      },
    },

    '/public/gym/{slug}/member': {
      get: {
        tags: ['Public'],
        summary: 'Look up member by email or ID',
        description: 'Returns member info and active subscription. Used by renewal page to pre-fill details.',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'email', in: 'query', schema: { type: 'string', format: 'email' }, description: 'Member email address' },
          { name: 'mid', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Member ID (from renewal email link)' },
        ],
        responses: {
          200: {
            description: 'Member found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    member: { $ref: '#/components/schemas/Member' },
                    subscription: { $ref: '#/components/schemas/Subscription' },
                    wallet_balance: { type: 'number' },
                  },
                },
              },
            },
          },
          404: { description: 'Member not found' },
        },
      },
    },

    '/public/gym/{slug}/renew': {
      post: {
        tags: ['Public'],
        summary: 'Member self-renewal',
        description: 'Renews a membership via wallet, mobile money (Tranzak hosted), or cash. No auth required.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['member_id', 'plan_id', 'payment_method'],
                properties: {
                  member_id: { type: 'string', format: 'uuid' },
                  plan_id: { type: 'string', format: 'uuid' },
                  payment_method: { type: 'string', enum: ['wallet', 'mobile_money', 'cash'] },
                  otp_code: { type: 'string', description: 'Required for wallet payments (6-digit OTP)' },
                },
              },
              examples: {
                wallet: { value: { member_id: 'uuid', plan_id: 'uuid', payment_method: 'wallet', otp_code: '123456' } },
                mobile_money: { value: { member_id: 'uuid', plan_id: 'uuid', payment_method: 'mobile_money' } },
                cash: { value: { member_id: 'uuid', plan_id: 'uuid', payment_method: 'cash' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Renewal initiated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    method: { type: 'string', enum: ['wallet', 'mobile_money', 'cash'] },
                    expires_at: { type: 'string', format: 'date-time', description: 'Wallet only — new expiry' },
                    payment_url: { type: 'string', description: 'Mobile money only — Tranzak hosted page' },
                    payment_id: { type: 'string', description: 'Mobile money only — Tranzak requestId for polling' },
                    reference: { type: 'string', description: 'Cash only — reference code for staff' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error or insufficient balance' },
          502: { description: 'Payment provider error' },
        },
      },
    },

    '/public/gym/{slug}/send-otp': {
      post: {
        tags: ['Public'],
        summary: 'Send OTP for wallet renewal',
        description: 'Sends a 6-digit OTP to the member\'s email before debiting their wallet on the renewal page.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['member_id'], properties: { member_id: { type: 'string', format: 'uuid' } } } } },
        },
        responses: {
          200: { description: 'OTP sent', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, sent_to: { type: 'string', example: 'bt****@shibmats.cm' } } } } } },
          404: { description: 'Member not found' },
        },
      },
    },

    '/public/gym/{slug}/verify-otp': {
      post: {
        tags: ['Public'],
        summary: 'Verify wallet OTP',
        description: 'Verifies the OTP sent to the member\'s email. Call this before POSTing to /renew with payment_method=wallet.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['member_id', 'code'], properties: { member_id: { type: 'string', format: 'uuid' }, code: { type: 'string', example: '482931' } } } } },
        },
        responses: {
          200: { description: 'OTP valid', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
          400: { description: 'Invalid or expired OTP' },
        },
      },
    },

    '/public/gym/{slug}/payment-status': {
      get: {
        tags: ['Public'],
        summary: 'Poll Tranzak payment status',
        description: 'Polls Tranzak for payment status after member returns from hosted payment page. Activates the pending subscription on success.',
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'pid', in: 'query', required: true, schema: { type: 'string' }, description: 'Tranzak requestId' },
          { name: 'mid', in: 'query', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Member ID' },
        ],
        responses: {
          200: {
            description: 'Payment status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['successful', 'pending', 'failed'] },
                    expires_at: { type: 'string', format: 'date-time', description: 'Present when status=successful' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/public/gym/{slug}/register': {
      post: {
        tags: ['Public'],
        summary: 'Public member self-registration',
        description: 'Creates a new member account and initiates payment. Used by the /join/{slug} page.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'plan_id', 'payment_method'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string', nullable: true },
                  plan_id: { type: 'string', format: 'uuid' },
                  payment_method: { type: 'string', enum: ['cash', 'mobile_money', 'wallet'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration initiated' },
          409: { description: 'Email already registered' },
        },
      },
    },

    '/public/gym/{slug}/register-with-tranzak': {
      post: {
        tags: ['Public'],
        summary: 'Register with Tranzak USSD push',
        description: 'Creates member and triggers a USSD mobile money push on the member\'s phone.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'plan_id', 'phone'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string', example: '237655123456' },
                  plan_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'USSD push sent' },
          409: { description: 'Email already registered' },
        },
      },
    },

    '/public/invoice/{invoiceId}': {
      get: {
        tags: ['Public'],
        summary: 'Get invoice details',
        description: 'Returns invoice details for the public payment page.',
        parameters: [{ name: 'invoiceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Invoice details' },
          404: { description: 'Invoice not found' },
        },
      },
    },

    '/public/invoice/{invoiceId}/pay': {
      post: {
        tags: ['Public'],
        summary: 'Pay an invoice via Tranzak',
        description: 'Initiates Tranzak hosted payment for a myfiti platform invoice.',
        parameters: [{ name: 'invoiceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Payment URL returned', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, payment_url: { type: 'string' } } } } } },
        },
      },
    },

    // ─── AUTH ────────────────────────────────────────────────────────────────

    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Owner / staff login',
        description: 'Authenticates an owner or staff member. Returns JWT token and tenant info.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', format: 'password' },
                },
              },
              example: { email: 'owner@mygym.cm', password: 'secret123' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    tenant: { type: 'object', properties: { id: { type: 'string' }, slug: { type: 'string' }, name: { type: 'string' } } },
                    user: { type: 'object', properties: { id: { type: 'string' }, email: { type: 'string' }, role: { type: 'string' } } },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },

    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Owner registration',
        description: 'Creates a new gym owner account. Sends OTP verification email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created — OTP sent to email' },
          409: { description: 'Email already registered' },
        },
      },
    },

    '/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify owner email with OTP',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'code'], properties: { email: { type: 'string' }, code: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Email verified — token returned' },
          400: { description: 'Invalid or expired OTP' },
        },
      },
    },

    '/auth/resend-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Resend email verification OTP',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'OTP resent' } },
      },
    },

    '/auth/member/request-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Request member login OTP',
        description: 'Sends a one-time login code to the member\'s email or phone.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' }, gym_slug: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'OTP sent' }, 404: { description: 'Member not found' } },
      },
    },

    '/auth/member/verify-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Verify member OTP and get token',
        description: 'Verifies the OTP and returns a member JWT token.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'code'], properties: { email: { type: 'string' }, code: { type: 'string' }, gym_slug: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Token returned', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' }, member: { $ref: '#/components/schemas/Member' } } } } } },
          400: { description: 'Invalid OTP' },
        },
      },
    },

    '/auth/member/login-with-pin': {
      post: {
        tags: ['Auth'],
        summary: 'Member login with PIN',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'pin'], properties: { email: { type: 'string' }, pin: { type: 'string' }, gym_slug: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Token returned' }, 401: { description: 'Invalid PIN' } },
      },
    },

    '/auth/staff/login': {
      post: {
        tags: ['Auth'],
        summary: 'Staff login (kiosk)',
        description: 'Staff login for kiosk and receptionist screens.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'password', 'gym_slug'], properties: { email: { type: 'string' }, password: { type: 'string' }, gym_slug: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Staff token returned' }, 401: { description: 'Invalid credentials' } },
      },
    },

    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request password reset',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } },
        },
        responses: { 200: { description: 'Reset link sent if email exists' } },
      },
    },

    '/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['token', 'password'], properties: { token: { type: 'string' }, password: { type: 'string', minLength: 8 } } } } },
        },
        responses: { 200: { description: 'Password reset successful' }, 400: { description: 'Invalid or expired token' } },
      },
    },

    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout (invalidate session)',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Logged out' } },
      },
    },

    // ─── ONBOARDING ──────────────────────────────────────────────────────────

    '/onboarding/complete': {
      post: {
        tags: ['Onboarding'],
        summary: 'Complete gym onboarding',
        description: 'Creates tenant schema, gym record, and initial settings after owner email verification.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['gym_name', 'slug', 'currency'],
                properties: {
                  gym_name: { type: 'string' },
                  slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
                  currency: { type: 'string', example: 'XAF' },
                  address: { type: 'string' },
                  phone: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Onboarding complete — tenant created' },
          409: { description: 'Slug already taken' },
        },
      },
    },

    // ─── MEMBERS ─────────────────────────────────────────────────────────────

    '/members': {
      get: {
        tags: ['Members'],
        summary: 'List all members',
        description: 'Returns paginated member list with optional filters.',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name or email' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'expiring_soon', 'expired', 'suspended', 'pending'] } },
          { name: 'plan_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          200: {
            description: 'Members list',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    members: { type: 'array', items: { $ref: '#/components/schemas/Member' } },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    pages: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Members'],
        summary: 'Create a member',
        description: 'Creates a new member. Sends welcome email with QR code.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'] },
                  date_of_birth: { type: 'string', format: 'date' },
                  plan_id: { type: 'string', format: 'uuid' },
                  payment_method: { type: 'string', enum: ['cash', 'mobile_money', 'wallet'] },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Member created', content: { 'application/json': { schema: { type: 'object', properties: { member: { $ref: '#/components/schemas/Member' } } } } } },
          409: { description: 'Email already registered' },
        },
      },
    },

    '/members/with-payment': {
      post: {
        tags: ['Members'],
        summary: 'Create member with payment (payment-first flow)',
        description: 'Creates an inactive member and payment record. Member activates after payment confirmation.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'plan_id', 'payment_method', 'amount'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  plan_id: { type: 'string', format: 'uuid' },
                  payment_method: { type: 'string', enum: ['cash', 'mobile_money', 'wallet'] },
                  amount: { type: 'number' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Member created (inactive), awaiting payment' },
          409: { description: 'Email already registered' },
        },
      },
    },

    '/members/import': {
      post: {
        tags: ['Members'],
        summary: 'Bulk import members',
        description: 'Imports multiple members from a JSON array. Sends welcome emails.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['members'],
                properties: {
                  members: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['name', 'email'],
                      properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, plan_name: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Import results with success/error counts' } },
      },
    },

    '/members/export': {
      get: {
        tags: ['Members'],
        summary: 'Export members as CSV',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'CSV file', content: { 'text/csv': {} } } },
      },
    },

    '/members/{id}': {
      get: {
        tags: ['Members'],
        summary: 'Get member by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Member details', content: { 'application/json': { schema: { type: 'object', properties: { member: { $ref: '#/components/schemas/Member' } } } } } }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Members'],
        summary: 'Update member',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  gender: { type: 'string', enum: ['male', 'female', 'other'] },
                  status: { type: 'string', enum: ['active', 'suspended'] },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Member updated' } },
      },
      delete: {
        tags: ['Members'],
        summary: 'Delete member',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Member deleted' } },
      },
    },

    '/members/{id}/resend-welcome': {
      post: {
        tags: ['Members'],
        summary: 'Resend welcome email',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Welcome email resent' } },
      },
    },

    '/members/{id}/confirm-payment': {
      post: {
        tags: ['Members'],
        summary: 'Confirm pending member payment',
        description: 'Activates a pending member after manual payment confirmation by staff.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { payment_method: { type: 'string', enum: ['cash', 'mobile_money'] }, reference: { type: 'string' } } } } } },
        responses: { 200: { description: 'Member activated' } },
      },
    },

    '/members/{id}/checkins': {
      get: {
        tags: ['Members'],
        summary: 'Get member check-in history',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Check-in history list' } },
      },
    },

    '/members/{id}/subscriptions': {
      get: {
        tags: ['Members'],
        summary: 'Get member subscriptions',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Subscription history' } },
      },
    },

    '/members/{id}/wallet': {
      get: {
        tags: ['Members'],
        summary: 'Get member wallet balance and transactions',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Wallet info' } },
      },
    },

    // ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────

    '/subscriptions/plans': {
      get: {
        tags: ['Subscriptions'],
        summary: 'List membership plans',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Plans list', content: { 'application/json': { schema: { type: 'object', properties: { plans: { type: 'array', items: { $ref: '#/components/schemas/Plan' } } } } } } } },
      },
      post: {
        tags: ['Subscriptions'],
        summary: 'Create a membership plan',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'price', 'duration_days'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  duration_days: { type: 'integer' },
                  cycle: { type: 'string', enum: ['monthly', 'quarterly', 'biannual', 'annual', 'custom'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Plan created' } },
      },
    },

    '/subscriptions/plans/{id}': {
      patch: {
        tags: ['Subscriptions'],
        summary: 'Update a plan',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, price: { type: 'number' }, is_active: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Plan updated' } },
      },
      delete: {
        tags: ['Subscriptions'],
        summary: 'Delete a plan',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Plan deleted' } },
      },
    },

    '/subscriptions': {
      get: {
        tags: ['Subscriptions'],
        summary: 'List all subscriptions',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'member_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Subscriptions list' } },
      },
      post: {
        tags: ['Subscriptions'],
        summary: 'Create a subscription',
        description: 'Manually assigns a subscription to a member.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['member_id', 'plan_id'], properties: { member_id: { type: 'string', format: 'uuid' }, plan_id: { type: 'string', format: 'uuid' }, started_at: { type: 'string', format: 'date' } } } } },
        },
        responses: { 201: { description: 'Subscription created' } },
      },
    },

    '/subscriptions/{id}': {
      get: {
        tags: ['Subscriptions'],
        summary: 'Get subscription by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Subscription details' } },
      },
      patch: {
        tags: ['Subscriptions'],
        summary: 'Update subscription',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' }, expires_at: { type: 'string', format: 'date-time' } } } } } },
        responses: { 200: { description: 'Subscription updated' } },
      },
    },

    // ─── PAYMENTS ────────────────────────────────────────────────────────────

    '/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List payments',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'member_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Payments list', content: { 'application/json': { schema: { type: 'object', properties: { payments: { type: 'array', items: { $ref: '#/components/schemas/Payment' } }, total: { type: 'integer' } } } } } } },
      },
      post: {
        tags: ['Payments'],
        summary: 'Record a payment',
        description: 'Records a cash or manual payment for a member.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['member_id', 'amount', 'method'],
                properties: {
                  member_id: { type: 'string', format: 'uuid' },
                  plan_id: { type: 'string', format: 'uuid' },
                  amount: { type: 'number' },
                  method: { type: 'string', enum: ['cash', 'mobile_money', 'wallet', 'card'] },
                  reference: { type: 'string' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Payment recorded' } },
      },
    },

    '/payments/tranzak/initiate': {
      post: {
        tags: ['Payments'],
        summary: 'Initiate Tranzak hosted payment',
        description: 'Creates a Tranzak payment request and returns a redirect URL.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['member_id', 'amount', 'plan_id'], properties: { member_id: { type: 'string' }, plan_id: { type: 'string' }, amount: { type: 'number' } } } } },
        },
        responses: { 200: { description: 'Payment URL', content: { 'application/json': { schema: { type: 'object', properties: { payment_url: { type: 'string' }, request_id: { type: 'string' } } } } } } },
      },
    },

    '/payments/tranzak/charge': {
      post: {
        tags: ['Payments'],
        summary: 'Tranzak USSD push (S2S)',
        description: 'Triggers a USSD mobile money push to the member\'s phone.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['member_id', 'amount', 'phone'], properties: { member_id: { type: 'string' }, amount: { type: 'number' }, phone: { type: 'string', example: '237655123456' } } } } },
        },
        responses: { 200: { description: 'USSD push sent', content: { 'application/json': { schema: { type: 'object', properties: { request_id: { type: 'string' } } } } } } },
      },
    },

    '/payments/{id}': {
      get: {
        tags: ['Payments'],
        summary: 'Get payment by ID',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Payment details' } },
      },
      patch: {
        tags: ['Payments'],
        summary: 'Update payment status',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['completed', 'failed', 'refunded'] }, reference: { type: 'string' } } } } } },
        responses: { 200: { description: 'Payment updated' } },
      },
    },

    '/payments/{id}/resend-receipt': {
      post: {
        tags: ['Payments'],
        summary: 'Resend payment receipt email',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Receipt resent' } },
      },
    },

    '/payments/{id}/refund': {
      post: {
        tags: ['Payments'],
        summary: 'Refund a payment',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Refund recorded' } },
      },
    },

    // ─── CHECK-IN ────────────────────────────────────────────────────────────

    '/checkin/verify-qr': {
      post: {
        tags: ['Check-in'],
        summary: 'Verify QR code check-in',
        description: 'Validates a member QR code. Used by the kiosk scanner.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['qr_data', 'gym_slug'], properties: { qr_data: { type: 'string' }, gym_slug: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Check-in result with member info' }, 403: { description: 'Membership inactive or expired' } },
      },
    },

    '/checkin/verify-pin': {
      post: {
        tags: ['Check-in'],
        summary: 'Verify PIN check-in',
        description: 'Checks in a member using their 4-digit PIN.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['pin', 'gym_slug'], properties: { pin: { type: 'string' }, gym_slug: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Check-in successful' }, 403: { description: 'Invalid PIN or inactive membership' } },
      },
    },

    '/checkin/lookup': {
      post: {
        tags: ['Check-in'],
        summary: 'Lookup member for check-in',
        description: 'Searches for a member by name, email, or phone for manual check-in.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['query', 'gym_slug'], properties: { query: { type: 'string' }, gym_slug: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Matching members list' } },
      },
    },

    '/checkin/live': {
      get: {
        tags: ['Check-in'],
        summary: 'Live check-in feed (last 50)',
        description: 'Returns the most recent check-ins for the live kiosk display.',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Recent check-ins' } },
      },
    },

    '/checkin/events': {
      get: {
        tags: ['Check-in'],
        summary: 'SSE stream for live check-ins',
        description: 'Server-sent events stream. Connect to receive real-time check-in events.',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'SSE stream (text/event-stream)' } },
      },
    },

    '/checkin/manual': {
      post: {
        tags: ['Check-in'],
        summary: 'Manual check-in by staff',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['member_id'], properties: { member_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { 200: { description: 'Checked in' } },
      },
    },

    '/checkin/undo-last': {
      delete: {
        tags: ['Check-in'],
        summary: 'Undo last check-in',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Last check-in undone' } },
      },
    },

    // ─── CLASSES ─────────────────────────────────────────────────────────────

    '/classes': {
      get: {
        tags: ['Classes'],
        summary: 'List classes',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Classes list' } },
      },
      post: {
        tags: ['Classes'],
        summary: 'Create a class',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'starts_at', 'duration_minutes', 'capacity'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  trainer_id: { type: 'string', format: 'uuid' },
                  starts_at: { type: 'string', format: 'date-time' },
                  duration_minutes: { type: 'integer' },
                  capacity: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Class created' } },
      },
    },

    '/classes/schedule': {
      get: {
        tags: ['Classes'],
        summary: 'Get class schedule (public)',
        description: 'Returns upcoming classes for members to browse. No auth required.',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Upcoming classes' } },
      },
    },

    '/classes/{id}/book': {
      post: {
        tags: ['Classes'],
        summary: 'Book a class',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['member_id'], properties: { member_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { 201: { description: 'Booked' }, 409: { description: 'Class full or already booked' } },
      },
    },

    '/classes/{id}/attendance': {
      post: {
        tags: ['Classes'],
        summary: 'Mark attendance',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['member_id'], properties: { member_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { 200: { description: 'Attendance marked' } },
      },
    },

    // ─── DAY PASSES ──────────────────────────────────────────────────────────

    '/day-passes/pricing': {
      get: {
        tags: ['Day Passes'],
        summary: 'Get day pass pricing',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Day pass price config' } },
      },
    },

    '/day-passes/kiosk-issue': {
      post: {
        tags: ['Day Passes'],
        summary: 'Issue day pass from kiosk (mobile money)',
        description: 'Triggers USSD push for day pass payment at the kiosk.',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['phone', 'name'], properties: { phone: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'USSD push sent' } },
      },
    },

    '/day-passes/wallet-issue': {
      post: {
        tags: ['Day Passes'],
        summary: 'Issue day pass via wallet',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['member_id'], properties: { member_id: { type: 'string', format: 'uuid' } } } } },
        },
        responses: { 200: { description: 'Day pass issued' } },
      },
    },

    '/day-passes/verify': {
      post: {
        tags: ['Day Passes'],
        summary: 'Verify day pass QR code',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pass_code'], properties: { pass_code: { type: 'string' } } } } } },
        responses: { 200: { description: 'Pass valid' }, 404: { description: 'Pass not found or expired' } },
      },
    },

    '/day-passes/payment-status/{ref}': {
      get: {
        tags: ['Day Passes'],
        summary: 'Poll day pass payment status',
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'ref', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Payment status' } },
      },
    },

    // ─── VOUCHERS ────────────────────────────────────────────────────────────

    '/vouchers': {
      get: {
        tags: ['Vouchers'],
        summary: 'List vouchers',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Vouchers list' } },
      },
    },

    '/vouchers/generate': {
      post: {
        tags: ['Vouchers'],
        summary: 'Generate a voucher',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['discount_type', 'discount_value'],
                properties: {
                  discount_type: { type: 'string', enum: ['percent', 'fixed'] },
                  discount_value: { type: 'number' },
                  expires_at: { type: 'string', format: 'date' },
                  max_uses: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Voucher created with code' } },
      },
    },

    '/vouchers/{id}/cancel': {
      patch: {
        tags: ['Vouchers'],
        summary: 'Cancel a voucher',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Voucher cancelled' } },
      },
    },

    // ─── ANALYTICS ───────────────────────────────────────────────────────────

    '/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Dashboard summary',
        description: 'Returns key metrics: active members, revenue, check-ins, renewals due.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Dashboard metrics' } },
      },
    },

    '/analytics/revenue': {
      get: {
        tags: ['Analytics'],
        summary: 'Revenue over time',
        security: [{ BearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/TenantSlug' },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Revenue data series' } },
      },
    },

    '/analytics/members': {
      get: {
        tags: ['Analytics'],
        summary: 'Member growth over time',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Member growth data' } },
      },
    },

    '/analytics/checkins': {
      get: {
        tags: ['Analytics'],
        summary: 'Check-in volume over time',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Check-in data series' } },
      },
    },

    '/analytics/retention': {
      get: {
        tags: ['Analytics'],
        summary: 'Member retention rate',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Retention cohort data' } },
      },
    },

    '/analytics/outstanding': {
      get: {
        tags: ['Analytics'],
        summary: 'Outstanding payments',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Outstanding amounts by member' } },
      },
    },

    '/analytics/capacity': {
      get: {
        tags: ['Analytics'],
        summary: 'Gym capacity / peak hours',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Capacity data by hour' } },
      },
    },

    '/analytics/wallet': {
      get: {
        tags: ['Analytics'],
        summary: 'Wallet analytics',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Wallet balance and transaction stats' } },
      },
    },

    // ─── SETTINGS ────────────────────────────────────────────────────────────

    '/settings': {
      get: {
        tags: ['Settings'],
        summary: 'Get gym settings',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Full gym settings object' } },
      },
      patch: {
        tags: ['Settings'],
        summary: 'Update gym settings',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  address: { type: 'string' },
                  phone: { type: 'string' },
                  currency: { type: 'string' },
                  primary_color: { type: 'string' },
                  grace_period_days: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Settings updated' } },
      },
    },

    '/settings/staff': {
      get: {
        tags: ['Settings'],
        summary: 'List staff members',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Staff list' } },
      },
      post: {
        tags: ['Settings'],
        summary: 'Add a staff member',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'role'],
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'receptionist', 'trainer'] },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Staff member created — invite email sent' } },
      },
    },

    '/settings/staff/{id}': {
      patch: {
        tags: ['Settings'],
        summary: 'Update staff member',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' } } } } } },
        responses: { 200: { description: 'Staff updated' } },
      },
      delete: {
        tags: ['Settings'],
        summary: 'Remove staff member',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }, { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Staff removed' } },
      },
    },

    '/settings/profile': {
      get: {
        tags: ['Settings'],
        summary: 'Get owner profile',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Owner profile' } },
      },
      patch: {
        tags: ['Settings'],
        summary: 'Update owner profile',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' } } } } } },
        responses: { 200: { description: 'Profile updated' } },
      },
    },

    '/settings/notifications': {
      get: {
        tags: ['Settings'],
        summary: 'Get notification preferences',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Notification settings' } },
      },
      patch: {
        tags: ['Settings'],
        summary: 'Update notification preferences',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { expiry_reminders: { type: 'boolean' }, payment_alerts: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Preferences updated' } },
      },
    },

    '/settings/billing/invoices': {
      get: {
        tags: ['Settings'],
        summary: 'List myfiti platform invoices',
        description: 'Returns billing invoices for the gym\'s myfiti subscription.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Invoices list' } },
      },
    },

    '/settings/export': {
      post: {
        tags: ['Settings'],
        summary: 'Export gym data',
        description: 'Queues a full data export (members, payments, subscriptions) sent to owner email.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Export queued' } },
      },
    },

    // ─── ANNOUNCEMENTS ───────────────────────────────────────────────────────

    '/announcements': {
      get: {
        tags: ['Announcements'],
        summary: 'List announcements',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        responses: { 200: { description: 'Announcements list' } },
      },
      post: {
        tags: ['Announcements'],
        summary: 'Send an announcement',
        description: 'Sends a push notification to all or filtered members.',
        security: [{ BearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/TenantSlug' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'message'],
                properties: {
                  title: { type: 'string' },
                  message: { type: 'string' },
                  audience: { type: 'string', enum: ['all', 'active', 'expiring', 'expired'], default: 'all' },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Announcement sent' } },
      },
    },

    // ─── MEMBER SELF-SERVICE ─────────────────────────────────────────────────

    '/member/me': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'Get my profile',
        description: 'Returns authenticated member\'s profile, subscription, and wallet balance.',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Member profile with subscription and wallet' } },
      },
      patch: {
        tags: ['Member Self-Service'],
        summary: 'Update my profile',
        security: [{ BearerAuth: [] }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, avatar_url: { type: 'string' } } } } } },
        responses: { 200: { description: 'Profile updated' } },
      },
    },

    '/member/me/renew': {
      post: {
        tags: ['Member Self-Service'],
        summary: 'Renew my membership (in-app)',
        description: 'Renews membership via wallet, mobile money (USSD), or cash from the mobile app.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['plan_id', 'payment_method'],
                properties: {
                  plan_id: { type: 'string', format: 'uuid' },
                  payment_method: { type: 'string', enum: ['wallet', 'mobile_money', 'cash'] },
                  phone: { type: 'string', description: 'Required for mobile_money' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Renewal result' } },
      },
    },

    '/member/me/payment/{paymentId}': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'Poll my payment status',
        description: 'Polls status of a pending mobile money payment. Activates subscription on success.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'paymentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Payment status', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['pending', 'completed', 'failed'] } } } } } } },
      },
    },

    '/member/me/plans': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'List available plans',
        description: 'Returns active plans the member can renew to.',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Plans list' } },
      },
    },

    '/member/me/receipts': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'My payment receipts',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Receipts list' } },
      },
    },

    '/member/me/schedule': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'My class schedule',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Upcoming booked classes' } },
      },
    },

    '/member/me/notifications': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'My notifications',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Notifications list' } },
      },
    },

    '/member/me/notifications/{id}/read': {
      patch: {
        tags: ['Member Self-Service'],
        summary: 'Mark notification as read',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Marked as read' } },
      },
    },

    '/member/me/checkin': {
      post: {
        tags: ['Member Self-Service'],
        summary: 'Self check-in',
        description: 'Member checks themselves in from the app.',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Checked in' }, 403: { description: 'Membership inactive' } },
      },
    },

    '/member/me/checkin-history': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'My check-in history',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Check-in history' } },
      },
    },

    '/member/me/referral': {
      get: {
        tags: ['Member Self-Service'],
        summary: 'My referral code and stats',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Referral info' } },
      },
    },

    '/member/me/pin': {
      post: {
        tags: ['Member Self-Service'],
        summary: 'Set or update PIN',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['pin'], properties: { pin: { type: 'string', minLength: 4, maxLength: 6 } } } } } },
        responses: { 200: { description: 'PIN set' } },
      },
      delete: {
        tags: ['Member Self-Service'],
        summary: 'Remove PIN',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'PIN removed' } },
      },
    },

    '/member/me/push-token': {
      post: {
        tags: ['Member Self-Service'],
        summary: 'Register push notification token',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } } } },
        responses: { 200: { description: 'Token registered' } },
      },
      delete: {
        tags: ['Member Self-Service'],
        summary: 'Remove push notification token',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Token removed' } },
      },
    },

    '/member/me/redeem-voucher': {
      post: {
        tags: ['Member Self-Service'],
        summary: 'Redeem a discount voucher',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } } } } },
        responses: { 200: { description: 'Voucher applied' }, 404: { description: 'Invalid or expired code' } },
      },
    },

    // ─── MEMBER WALLET ───────────────────────────────────────────────────────

    '/member/wallet': {
      get: {
        tags: ['Member Wallet'],
        summary: 'Get wallet balance and transactions',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Wallet info' } },
      },
    },

    '/member/wallet/topup': {
      post: {
        tags: ['Member Wallet'],
        summary: 'Top up wallet via mobile money',
        description: 'Triggers a Tranzak USSD push to add funds to the member\'s wallet.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['amount', 'phone'], properties: { amount: { type: 'number' }, phone: { type: 'string', example: '237655123456' } } } } },
        },
        responses: { 200: { description: 'USSD push sent', content: { 'application/json': { schema: { type: 'object', properties: { request_id: { type: 'string' } } } } } } },
      },
    },

    '/member/wallet/pay-subscription': {
      post: {
        tags: ['Member Wallet'],
        summary: 'Pay subscription from wallet',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['plan_id'], properties: { plan_id: { type: 'string', format: 'uuid' } } } } } },
        responses: { 200: { description: 'Subscription paid' }, 400: { description: 'Insufficient balance' } },
      },
    },

    '/member/wallet/transfer': {
      post: {
        tags: ['Member Wallet'],
        summary: 'Transfer to another member wallet',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['to_member_id', 'amount'], properties: { to_member_id: { type: 'string', format: 'uuid' }, amount: { type: 'number' }, note: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Transfer complete' }, 400: { description: 'Insufficient balance' } },
      },
    },

    '/member/wallet/cashout': {
      post: {
        tags: ['Member Wallet'],
        summary: 'Cash out wallet to mobile money',
        description: 'Disburses wallet balance to the member\'s mobile money number.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['amount', 'phone'], properties: { amount: { type: 'number' }, phone: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'Cashout initiated' }, 400: { description: 'Insufficient balance or below minimum' } },
      },
    },

    '/member/wallet/lookup': {
      get: {
        tags: ['Member Wallet'],
        summary: 'Look up another member\'s wallet',
        description: 'Returns name and masked email for transfer confirmation.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'member_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Member wallet info' }, 404: { description: 'Member not found' } },
      },
    },

    // ─── WEBHOOKS ────────────────────────────────────────────────────────────

    '/webhooks/tranzak': {
      post: {
        tags: ['Webhooks'],
        summary: 'Tranzak payment webhook',
        description: `
Called by Tranzak when a payment status changes. Validates HMAC signature.

**Context types** (via \`?ctx=\` query param):
- \`member-payment\` — member wallet top-up
- \`subscription\` — admin-initiated subscription payment
- \`public-renew\` — member self-renewal (detected from \`ren-\` prefix on merchantTransactionRef)
- \`day-pass\` — day pass payment
- \`invoice\` — myfiti platform invoice
        `,
        parameters: [
          { name: 'ctx', in: 'query', schema: { type: 'string', enum: ['member-payment', 'subscription', 'public-renew', 'day-pass', 'invoice'] } },
          { name: 'tenant', in: 'query', schema: { type: 'string' }, description: 'Tenant slug' },
          { name: 'id', in: 'query', schema: { type: 'string' }, description: 'Resource ID (payment/subscription/pass)' },
        ],
        requestBody: {
          description: 'Raw Tranzak webhook payload',
          content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object' } } } } },
        },
        responses: { 200: { description: 'Webhook processed' }, 401: { description: 'Invalid signature' } },
      },
    },

    // ─── SUPERADMIN ──────────────────────────────────────────────────────────

    '/superadmin/login': {
      post: {
        tags: ['SuperAdmin'],
        summary: 'SuperAdmin login',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } },
        },
        responses: { 200: { description: 'SuperAdmin token returned' }, 401: { description: 'Invalid credentials' } },
      },
    },

    '/superadmin/overview': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Platform overview',
        description: 'Total gyms, members, revenue, and MRR.',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Platform metrics' } },
      },
    },

    '/superadmin/gyms': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'List all gyms',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'trial', 'suspended'] } },
        ],
        responses: { 200: { description: 'Gyms list' } },
      },
    },

    '/superadmin/gyms/{id}': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Get gym details',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Gym details with member/revenue stats' } },
      },
      patch: {
        tags: ['SuperAdmin'],
        summary: 'Update gym (suspend/activate)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'trial', 'suspended'] }, plan: { type: 'string' } } } } } },
        responses: { 200: { description: 'Gym updated' } },
      },
      delete: {
        tags: ['SuperAdmin'],
        summary: 'Delete a gym',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Gym deleted' } },
      },
    },

    '/superadmin/impersonate/{tenantId}': {
      post: {
        tags: ['SuperAdmin'],
        summary: 'Impersonate a gym owner',
        description: 'Returns a short-lived JWT that acts as the gym owner.',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Impersonation token' } },
      },
    },

    '/superadmin/revenue': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Platform revenue overview',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Revenue breakdown by gym and period' } },
      },
    },

    '/superadmin/audit-log': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Platform audit log',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Audit events' } },
      },
    },

    '/superadmin/flags': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Feature flags',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'All feature flags with per-tenant overrides' } },
      },
    },

    '/superadmin/flags/{key}': {
      patch: {
        tags: ['SuperAdmin'],
        summary: 'Update a feature flag',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { enabled: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Flag updated' } },
      },
    },

    '/superadmin/invoices': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'List platform invoices',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Invoices list' } },
      },
    },

    '/superadmin/invoices/generate': {
      post: {
        tags: ['SuperAdmin'],
        summary: 'Generate monthly invoices for all gyms',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Invoices generated' } },
      },
    },

    '/superadmin/support/tickets': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'List support tickets',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Support tickets' } },
      },
    },

    '/superadmin/sessions': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Active sessions across platform',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Active sessions' } },
      },
    },

    '/superadmin/analytics': {
      get: {
        tags: ['SuperAdmin'],
        summary: 'Platform-wide analytics',
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Aggregate platform metrics' } },
      },
    },

  },
}
