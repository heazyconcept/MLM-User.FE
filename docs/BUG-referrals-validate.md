# Backend Bug: `POST /referrals/validate` – Broken DTO (Empty Schema)

## Summary

The `POST /referrals/validate` endpoint rejects **all** body properties with a 400 error. The frontend sends `{ referralCode: "..." }` as documented in `API.md`, but the backend's validation pipe strips/rejects it.

## Evidence

**API.md documentation** (line 151) says:
> `POST /referrals/validate` | None | Validate referral code; body: `referralCode`

**Live OpenAPI spec** (`GET /api/docs-json`) shows:
```json
"/referrals/validate": {
  "post": {
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": { "$ref": "#/components/schemas/Function" }
        }
      }
    }
  }
}
```

The `Function` schema is:
```json
"Function": { "type": "object", "properties": {} }
```

This means the DTO serialized as an **empty object** with no allowed properties.

## Error Responses

Sending `{ referralCode: "I2TRAVSX" }`:
```json
{
  "statusCode": 400,
  "message": ["property referralCode should not exist"],
  "error": "Bad Request",
  "path": "/referrals/validate"
}
```

Sending `{ code: "I2TRAVSX" }`:
```json
{
  "statusCode": 400,
  "message": ["property code should not exist"],
  "error": "Bad Request",
  "path": "/referrals/validate"
}
```

## Root Cause (Likely)

The `ValidateReferralCodeDto` class is not being picked up by `@nestjs/swagger`. The OpenAPI codegen falls back to the generic `Function` schema (empty object). Combined with `whitelist: true` + `forbidNonWhitelisted: true` in the global validation pipe, **every** body property is rejected.

## Fix (Backend)

1. Ensure `ValidateReferralCodeDto` has `@ApiProperty()` decorators on its fields.
2. Make sure the DTO class is properly imported/referenced in the controller method's `@Body()` parameter.
3. Verify the DTO has at least: `@IsString() @IsNotEmpty() referralCode: string;`
4. Re-generate the OpenAPI spec and confirm the schema is no longer `Function`.

## Frontend Status

The frontend is coded per the API.md documentation:
- `POST /referrals/validate` with body `{ referralCode }` 
- `catchError` gracefully returns `{ valid: false }` so the app doesn't break
- Once the backend is fixed, validation will work automatically — no frontend changes needed
