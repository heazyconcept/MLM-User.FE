# Frontend Integration — Merchant Locations (by category)

**Feature:** Observation 1 — merchant category location rules  
**Audience:** Merchant app + customer pickup UI + admin merchant detail  
**Related:** [merchant-flow-frontend.md](./merchant-flow-frontend.md), [frontend-integration-customer-checkout-pickup.md](./frontend-integration-customer-checkout-pickup.md), [PICKUP_MERCHANTS_BY_STATE_API.md](./PICKUP_MERCHANTS_BY_STATE_API.md)

---

## 1. Summary

Merchants now have structured **locations** (primary + optional coverage sites). Rules depend on merchant tier:

| Type         | Locations allowed                     | Geography                                                   | Required details                                      |
| ------------ | ------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------- |
| **REGIONAL** | Exactly **1**; no service-area picker | Primary subdivision in selected home country                | Primary `address`                                     |
| **NATIONAL** | 1+ (one primary)                      | One selected home country; distinct subdivisions            | Each written location needs `address`                 |
| **GLOBAL**   | 1+ (one primary)                      | HQ in home country; additional locations may span countries | Each written location needs `address` + `phoneNumber` |

**Vocabulary**

- **Home country** = required merchant residence/HQ country (`homeCountryCode`).
- **Primary location** = main business / HQ address (`isPrimary: true`). It must be in the home country and is mirrored on `Merchant.address` / `phoneNumber`.
- **Coverage locations** = other states/countries where the merchant can serve pickup. Each should have its own address (and phone for GLOBAL).

Legacy `serviceAreas: string[]` remains on read responses as a **compat mirror** of location states. Prefer sending `locations` on write.

---

## 2. Location object

```ts
type MerchantLocation = {
  id?: string; // present on reads
  countryCode: string; // ISO alpha-2; e.g. "NG"
  subdivisionCode: string; // code returned by the geography API; e.g. "LA"
  country: string; // display/legacy mirror
  state: string; // display/legacy mirror
  address: string;
  phoneNumber: string;
  isPrimary: boolean;
  detailsComplete: boolean; // read-only: address set; GLOBAL also needs phone
};
```

Profile / admin also expose:

- `locationsComplete: boolean` — all locations have `detailsComplete === true`

Wildcard `"*"` is **not** allowed on new writes. Existing `"*"` in `serviceAreas` still matches any state for discovery until the merchant replaces locations.

Load canonical options from:

- `GET /geography/countries`
- `GET /geography/countries/:countryCode/subdivisions`

Submit codes returned by these endpoints. Do not derive or invent subdivision codes in the frontend.

---

## 3. Apply / update

### Preferred: `locations`

**`POST /merchants/apply`**

```json
{
  "businessName": "Herb World Ventures",
  "phoneNumber": "+2348012345678",
  "type": "NATIONAL",
  "homeCountryCode": "NG",
  "locations": [
    {
      "countryCode": "NG",
      "subdivisionCode": "LA",
      "country": "Nigeria",
      "state": "Lagos",
      "address": "12 Market Road, Ikeja, Lagos",
      "phoneNumber": "+2348012345678",
      "isPrimary": true
    },
    {
      "countryCode": "NG",
      "subdivisionCode": "FC",
      "country": "Nigeria",
      "state": "Abuja",
      "address": "15 Maitama Avenue, Abuja",
      "phoneNumber": "+2348012345678",
      "isPrimary": false
    }
  ]
}
```

**REGIONAL example** — only one location:

```json
{
  "businessName": "Ikeja Hub",
  "phoneNumber": "+2348011111111",
  "type": "REGIONAL",
  "homeCountryCode": "NG",
  "locations": [
    {
      "countryCode": "NG",
      "subdivisionCode": "LA",
      "country": "Nigeria",
      "state": "Lagos",
      "address": "12 Market Road, Lagos",
      "isPrimary": true
    }
  ]
}
```

**GLOBAL example** — country + phone per site:

```json
{
  "businessName": "West Africa Stockist",
  "phoneNumber": "+2348010000000",
  "type": "GLOBAL",
  "homeCountryCode": "NG",
  "locations": [
    {
      "countryCode": "NG",
      "subdivisionCode": "LA",
      "country": "Nigeria",
      "state": "Lagos",
      "address": "HQ Lagos",
      "phoneNumber": "+2348010000000",
      "isPrimary": true
    },
    {
      "countryCode": "GH",
      "subdivisionCode": "AA",
      "country": "Ghana",
      "state": "Accra",
      "address": "12 Independence Ave, Accra",
      "phoneNumber": "+233201234567",
      "isPrimary": false
    }
  ]
}
```

### Legacy: `serviceAreas` + top-level `address`

Still accepted when `locations` is omitted:

```json
{
  "businessName": "Herb World",
  "phoneNumber": "+2348012345678",
  "address": "12 Market Road, Lagos",
  "type": "NATIONAL",
  "serviceAreas": ["Lagos", "Abuja"]
}
```

Behaviour:

- First area → primary (gets `address` / phone)
- Extra areas → coverage rows with **empty** address (incomplete until merchant fills them)
- REGIONAL cannot submit `serviceAreas` or more than one location
- NATIONAL locations must all use `homeCountryCode`
- GLOBAL primary location must use `homeCountryCode`; additional locations may use other countries

### `PATCH /merchants/me`

- May send `locations` (replaces all), or legacy `serviceAreas` / `address` / `phoneNumber`
- Unpaid DRAFT/PENDING: may also change `type` (re-validates locations against new tier)
- After fee paid: cannot change `type` (use category upgrade)

When `locations` is sent, every row must satisfy category complete-detail rules (no incomplete extras).

---

## 4. Profile / admin response additions

`GET /merchants/me` and `GET /admin/merchants/:id` include:

```json
{
  "address": "12 Market Road, Lagos",
  "phoneNumber": "+2348012345678",
  "serviceAreas": ["Lagos", "Abuja"],
  "locations": [
    {
      "id": "uuid",
      "country": "Nigeria",
      "state": "Lagos",
      "address": "12 Market Road, Lagos",
      "phoneNumber": "+2348012345678",
      "isPrimary": true,
      "detailsComplete": true
    },
    {
      "id": "uuid",
      "country": "Nigeria",
      "state": "Abuja",
      "address": "",
      "phoneNumber": "",
      "isPrimary": false,
      "detailsComplete": false
    }
  ],
  "locationsComplete": false
}
```

**Merchant UI:** when `locationsComplete === false`, prompt the merchant to complete coverage addresses (and phones for GLOBAL).

---

## 5. Pickup discovery (graceful fallback)

`GET /merchants/available?state=Ibadan` (and checkout availability) resolve contact for the **matched** location:

| Case                                 | `address` / `phoneNumber` returned | `usingPrimaryAddressFallback` |
| ------------------------------------ | ---------------------------------- | ----------------------------- |
| Matched location has its own address | That location’s details            | `false`                       |
| Matched location incomplete (legacy) | **Primary** location details       | `true`                        |

Also returns `locations[]` and `locationsComplete` on each merchant.

**Customer UI guidance**

- Always show the returned `address` / `phoneNumber` for the selected state (do not assume HQ).
- Optionally badge when `usingPrimaryAddressFallback === true` (“Confirm address with merchant” / incomplete coverage).

---

## 6. Frontend checklist

- [x] Load country/subdivision options from `/geography`
- [x] Apply / edit forms require `homeCountryCode`
- [x] REGIONAL captures one primary business subdivision in the selected home country
- [x] NATIONAL loads subdivisions only from the selected home country
- [x] GLOBAL allows multiple service countries and subdivisions
- [x] Reject wildcard `"*"` in the UI
- [x] Profile shows `locationsComplete` and incomplete-locations banner when false
- [ ] Pickup list uses API `address` for the chosen state; surface fallback flag _(out of scope for user app registration)_
- [ ] Admin merchant detail shows full `locations` list _(admin app)_
- [x] Keep sending consistent state labels (same spelling as checkout `state`)
