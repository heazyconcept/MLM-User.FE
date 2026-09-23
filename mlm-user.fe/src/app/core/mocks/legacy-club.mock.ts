import {
  LegacyCashoutLedgerItem,
  LegacyCashoutResponse,
  LegacyCashoutTransferRequest,
  LegacyCashoutTransferResponse,
  LegacyCashoutWithdrawRequest,
  LegacyCompanyBankAccount,
  LegacyCurrency,
  LegacyJoinPreview,
  LegacyJoinStartRequest,
  LegacyLifecycle,
  LegacyMe,
  LegacyMemberLookup,
  LegacyPackage,
  LegacyPackageCode,
  LegacyPackagesResponse,
  LegacyPaymentRecord,
  LegacyPaymentWalletRequest,
  LegacySponsorSource,
  LegacySponsorValidateResponse,
  LegacySuccesslinesResponse,
  LegacyVoucherResponse,
  LEGACY_ERROR_CODES,
} from '../models/legacy-club.models';

export interface LegacyMockCartLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  pv: number;
  image?: string;
}

export interface LegacyMockProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: LegacyCurrency;
  pv: number;
  directReferralPv: number;
  cpv: number;
  category: string;
  images: string[];
  inStock: boolean;
  purchasable: boolean;
}

export class LegacyClubHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'LegacyClubHttpError';
    this.status = status;
    this.code = code;
  }
}

const PACKAGE_DEFS: LegacyPackage[] = [
  {
    code: 'VIP',
    name: 'VIP Member',
    isActive: true,
    purchaseAmount: 60000,
    instantCommission: 20000,
    monthlyCommission: 30000,
    sixMonthTotal: 200000,
    successlineBonusPercent: 10,
    autoshipAmount: 10000,
    cycleMonths: 6,
    minDirectsToIncreaseMonthly: 3,
  },
  {
    code: 'EXECUTIVE',
    name: 'Executive Member',
    isActive: true,
    purchaseAmount: 200000,
    instantCommission: 80000,
    monthlyCommission: 120000,
    sixMonthTotal: 800000,
    successlineBonusPercent: 20,
    autoshipAmount: 40000,
    cycleMonths: 6,
    minDirectsToIncreaseMonthly: 3,
  },
  {
    code: 'SUPREME',
    name: 'Supreme Member',
    isActive: true,
    purchaseAmount: 500000,
    instantCommission: 200000,
    monthlyCommission: 250000,
    sixMonthTotal: 1700000,
    successlineBonusPercent: 30,
    autoshipAmount: 80000,
    cycleMonths: 6,
    minDirectsToIncreaseMonthly: 3,
  },
];

const MOCK_PRODUCTS: LegacyMockProduct[] = [
  {
    id: 'legacy-prod-1',
    name: 'Segulah Herbal Tea',
    description: 'Daily wellness blend for Legacy Club join carts.',
    price: 15000,
    currency: 'NGN',
    pv: 15,
    directReferralPv: 5,
    cpv: 2,
    category: 'health',
    images: ['/assets/products/tea.png'],
    inStock: true,
    purchasable: true,
  },
  {
    id: 'legacy-prod-2',
    name: 'Segulah Capsules',
    description: 'Premium capsules for Legacy Club marketplace.',
    price: 25000,
    currency: 'NGN',
    pv: 25,
    directReferralPv: 8,
    cpv: 3,
    category: 'health',
    images: ['/assets/products/capsules.png'],
    inStock: true,
    purchasable: true,
  },
  {
    id: 'legacy-prod-3',
    name: 'Segulah Wellness Kit',
    description: 'Bundle to reach package purchase floors quickly.',
    price: 45000,
    currency: 'NGN',
    pv: 45,
    directReferralPv: 12,
    cpv: 5,
    category: 'lifestyle',
    images: ['/assets/products/kit.png'],
    inStock: true,
    purchasable: true,
  },
];

/** Known Legacy sponsors for MANUAL validation. */
const LEGACY_SPONSORS: Record<string, LegacyPackageCode> = {
  ada: 'SUPREME',
  bode: 'EXECUTIVE',
  chioma: 'VIP',
};

interface MockState {
  me: LegacyMe;
  cart: LegacyMockCartLine[];
  cashBalance: number;
  registrationWalletBalance: number;
  ledger: LegacyCashoutLedgerItem[];
  successlines: LegacySuccesslinesResponse['successlines'];
  currentUsername: string;
  pendingPayments: LegacyPaymentRecord[];
}

function baseNoneAuto(): LegacyMe {
  return {
    status: 'NONE',
    currency: 'NGN',
    sponsorResolution: 'AUTO',
    defaultSponsor: { username: 'ada', legacyPackage: 'SUPREME' },
    membership: null,
    legacyCashout: null,
    legacyVoucher: { balance: 0, status: 'ACTIVE' },
    instantReceived: 0,
    directSuccesslineCount: 0,
    minDirectsToIncreaseMonthly: 3,
    canCashoutLegacy: false,
    pendingJoin: null,
  };
}

function createInitialState(): MockState {
  return {
    me: baseNoneAuto(),
    cart: [],
    cashBalance: 500000,
    registrationWalletBalance: 500000,
    ledger: [],
    successlines: [],
    currentUsername: 'demo_member',
    pendingPayments: [],
  };
}

let state: MockState = createInitialState();

function packageByCode(code: LegacyPackageCode): LegacyPackage {
  const pkg = PACKAGE_DEFS.find((p) => p.code === code);
  if (!pkg) {
    throw new LegacyClubHttpError(400, LEGACY_ERROR_CODES.PACKAGE_INACTIVE, 'Package not found.');
  }
  return pkg;
}

function cartSubtotal(): number {
  return state.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

function syncPendingJoinCart(): void {
  const pending = state.me.pendingJoin;
  if (!pending) return;
  const subtotal = cartSubtotal();
  state.me = {
    ...state.me,
    pendingJoin: {
      ...pending,
      legacyCartSubtotal: subtotal,
      remainingToJoin: Math.max(0, pending.purchaseRequired - subtotal),
    },
  };
}

function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function rejectDelay(error: LegacyClubHttpError, ms = 80): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(error), ms));
}

export const legacyClubMockStore = {
  reset(options?: { sponsorResolution?: 'AUTO' | 'MANUAL'; username?: string }): void {
    state = createInitialState();
    if (options?.username) state.currentUsername = options.username;
    if (options?.sponsorResolution === 'MANUAL') {
      state.me = {
        ...baseNoneAuto(),
        sponsorResolution: 'MANUAL',
        defaultSponsor: null,
      };
    }
  },

  /** Test helper: jump straight to ACTIVE with zero successlines. */
  seedActive(options?: { package?: LegacyPackageCode; cashoutBalance?: number }): void {
    const pkg = packageByCode(options?.package ?? 'VIP');
    const balance = options?.cashoutBalance ?? pkg.instantCommission;
    const weeklyIncreased = Math.round(pkg.monthlyCommission / 4);
    const weeklyAutoship = Math.round(pkg.autoshipAmount / 4);
    const nextDueCashout = weeklyIncreased - weeklyAutoship;
    const nextDueVoucherNet = Math.round(weeklyAutoship * 0.9);
    state.me = {
      status: 'ACTIVE',
      currency: 'NGN',
      sponsorResolution: 'AUTO',
      defaultSponsor: null,
      membership: {
        package: pkg.code,
        sponsorUsername: 'ada',
        sponsorSource: 'AUTO',
        joinedAt: '2026-09-18T10:00:00.000Z',
        cycleStartedAt: '2026-09-18T10:00:00.000Z',
        joinOrderId: 'mock-join-order-1',
      },
      legacyCashout: { balance, status: 'ACTIVE' },
      legacyVoucher: { balance: 5000, status: 'ACTIVE' },
      instantReceived: pkg.instantCommission,
      directSuccesslineCount: 0,
      minDirectsToIncreaseMonthly: 3,
      canCashoutLegacy: true,
      pendingJoin: null,
      shopMode: 'SHOP',
      cycle: {
        startedAt: '2026-09-18T10:00:00.000Z',
        cycleMonths: 6,
        cycleWeeks: 24,
        issuedCount: 3,
        droppedCount: 3,
        pendingCount: 0,
        pendingAmount: 0,
        nextDueAt: '2026-10-09T10:00:00.000Z',
        nextDueAmount: weeklyIncreased,
        nextDueCashoutAmount: nextDueCashout,
        nextDueVoucherNet,
        nextDueRateTier: 'BASE',
        isCycleComplete: false,
      },
      monthlyQualify: {
        directSuccesslineCount: 0,
        required: 3,
        qualifiedAt: null,
        isQualified: false,
      },
      autoship: {
        requiredAmount: weeklyAutoship,
        weeklyAutoshipAmount: weeklyAutoship,
        lastAutoshipAt: null,
        shopMode: 'SHOP',
      },
      priorPending: { count: 0, amount: 0 },
      lifecycle: {
        status: 'ACTIVE',
        earningEligible: true,
        cashoutEligible: true,
        canReactivate: false,
        startedAt: '2026-09-18T10:00:00.000Z',
        earningEndsAt: '2027-03-18T10:00:00.000Z',
        suspensionDueAt: null,
        reactivationSecondsRemaining: 0,
      },
    };
    state.ledger = [
      {
        id: 'ledger-instant-1',
        date: '2026-09-18T10:05:00.000Z',
        description: `Legacy Club Instant Membership Commission (${pkg.code})`,
        type: 'Credit',
        amount: pkg.instantCommission,
        currency: 'NGN',
      },
    ];
    state.cart = [];
    state.successlines = [];
  },

  getProducts(): LegacyMockProduct[] {
    return [...MOCK_PRODUCTS];
  },

  getProduct(id: string): LegacyMockProduct | undefined {
    return MOCK_PRODUCTS.find((p) => p.id === id);
  },

  async getPackages(): Promise<LegacyPackagesResponse> {
    return delay({
      currency: 'NGN',
      fxRateNgnPerUsd: 1000,
      packages: PACKAGE_DEFS.map((p) => ({ ...p })),
    });
  },

  async getMe(): Promise<LegacyMe> {
    syncPendingJoinCart();
    return delay({ ...state.me, pendingJoin: state.me.pendingJoin ? { ...state.me.pendingJoin } : null });
  },

  async validateSponsor(username: string): Promise<LegacySponsorValidateResponse> {
    const normalized = username.trim().toLowerCase();
    if (state.me.sponsorResolution === 'AUTO') {
      return rejectDelay(
        new LegacyClubHttpError(
          400,
          LEGACY_ERROR_CODES.SPONSOR_MUST_BE_AUTO,
          'Your Segulah sponsor is already in Legacy Club.',
        ),
      );
    }
    if (!normalized) {
      return rejectDelay(
        new LegacyClubHttpError(400, LEGACY_ERROR_CODES.SPONSOR_NOT_FOUND, 'We could not find that username.'),
      );
    }
    if (normalized === state.currentUsername.toLowerCase()) {
      return rejectDelay(
        new LegacyClubHttpError(400, LEGACY_ERROR_CODES.SPONSOR_SELF, 'You cannot register yourself.'),
      );
    }
    const pkg = LEGACY_SPONSORS[normalized];
    if (!pkg) {
      const knownSegulah = ['nobody_legacy'];
      if (knownSegulah.includes(normalized) || normalized.startsWith('notlegacy')) {
        return rejectDelay(
          new LegacyClubHttpError(
            400,
            LEGACY_ERROR_CODES.SPONSOR_NOT_LEGACY,
            'That member has not joined Legacy Club yet.',
          ),
        );
      }
      return rejectDelay(
        new LegacyClubHttpError(400, LEGACY_ERROR_CODES.SPONSOR_NOT_FOUND, 'We could not find that username.'),
      );
    }
    return delay({ valid: true as const, username: normalized, legacyPackage: pkg });
  },

  async startJoin(body: LegacyJoinStartRequest): Promise<void> {
    if (state.me.status === 'ACTIVE') {
      return rejectDelay(
        new LegacyClubHttpError(400, LEGACY_ERROR_CODES.ALREADY_ACTIVE, 'You are already in Legacy Club.'),
      );
    }
    const pkg = packageByCode(body.package);
    if (!pkg.isActive) {
      return rejectDelay(
        new LegacyClubHttpError(400, LEGACY_ERROR_CODES.PACKAGE_INACTIVE, 'That package is not available.'),
      );
    }

    let sponsorUsername: string;
    let sponsorSource: LegacySponsorSource;

    if (state.me.sponsorResolution === 'AUTO') {
      if (
        body.sponsorUsername &&
        body.sponsorUsername.toLowerCase() !== state.me.defaultSponsor?.username.toLowerCase()
      ) {
        return rejectDelay(
          new LegacyClubHttpError(
            400,
            LEGACY_ERROR_CODES.SPONSOR_MUST_BE_AUTO,
            'Your Segulah sponsor is already in Legacy Club.',
          ),
        );
      }
      sponsorUsername = state.me.defaultSponsor!.username;
      sponsorSource = 'AUTO';
    } else {
      if (!body.sponsorUsername?.trim()) {
        return rejectDelay(
          new LegacyClubHttpError(
            400,
            LEGACY_ERROR_CODES.SPONSOR_USERNAME_REQUIRED,
            'Enter a Legacy Club username.',
          ),
        );
      }
      const validated = await this.validateSponsor(body.sponsorUsername);
      sponsorUsername = validated.username;
      sponsorSource = 'CHOSEN';
    }

    const voucher = state.me.legacyVoucher ?? { balance: 0, status: 'ACTIVE' as const };
    state.me = {
      ...state.me,
      status: 'PENDING_JOIN',
      shopMode: 'JOIN',
      pendingJoin: {
        package: pkg.code,
        sponsorUsername,
        sponsorSource,
        purchaseRequired: pkg.purchaseAmount,
        legacyCartSubtotal: 0,
        remainingToJoin: pkg.purchaseAmount,
      },
      pendingPayment: {
        purpose: 'JOIN',
        status: 'PENDING',
        paymentRequired: pkg.purchaseAmount,
        paymentMethods: ['REGISTRATION_WALLET', 'MANUAL_BANK'],
      },
      legacyVoucher: voucher,
    };
    return delay(undefined);
  },

  async getJoinPreview(): Promise<LegacyJoinPreview> {
    return delay({
      sponsorResolution: state.me.sponsorResolution,
      defaultSponsor: state.me.defaultSponsor,
      paymentRequired: state.me.pendingJoin?.purchaseRequired,
    });
  },

  async getLifecycle(): Promise<LegacyLifecycle> {
    const me = state.me;
    return delay(
      me.lifecycle ?? {
        status: me.status,
        earningEligible: me.status === 'ACTIVE',
        cashoutEligible: me.canCashoutLegacy,
        canReactivate: !!me.canReactivate,
        startedAt: me.membership?.joinedAt ?? null,
        earningEndsAt: null,
        suspensionDueAt: null,
        reactivationSecondsRemaining: 0,
      },
    );
  },

  async getCompanyBankAccount(): Promise<LegacyCompanyBankAccount> {
    return delay({
      bankName: 'GTBank',
      accountNumber: '0123456789',
      accountName: 'Segulah Global Herbal Ltd',
    });
  },

  async getPendingPayments(): Promise<LegacyPaymentRecord[]> {
    return delay([...state.pendingPayments]);
  },

  async payWithWallet(body: LegacyPaymentWalletRequest): Promise<void> {
    const me = state.me;
    const amount =
      me.pendingPayment?.paymentRequired ??
      me.pendingJoin?.purchaseRequired ??
      me.pendingUpgrade?.paymentRequired ??
      0;
    if (amount <= 0) {
      return rejectDelay(new LegacyClubHttpError(400, 'NO_PAYMENT', 'No payment due.'));
    }
    if (state.registrationWalletBalance < amount) {
      return rejectDelay(
        new LegacyClubHttpError(400, LEGACY_ERROR_CODES.INSUFFICIENT_BALANCE, 'Insufficient registration wallet balance.'),
      );
    }
    state.registrationWalletBalance -= amount;
    if (body.purpose === 'JOIN') {
      await this.activateFromJoin();
      return delay(undefined);
    }
    if (body.purpose === 'UPGRADE') {
      state.me = {
        ...state.me,
        pendingPayment: null,
        pendingUpgrade: null,
        shopMode: 'SHOP',
      };
      return delay(undefined);
    }
    state.me = {
      ...state.me,
      status: 'ACTIVE',
      pendingPayment: null,
      canReactivate: false,
      canCashoutLegacy: true,
      shopMode: 'SHOP',
      lifecycle: {
        status: 'ACTIVE',
        earningEligible: true,
        cashoutEligible: true,
        canReactivate: false,
        startedAt: new Date().toISOString(),
        earningEndsAt: null,
        suspensionDueAt: null,
        reactivationSecondsRemaining: 0,
      },
    };
    return delay(undefined);
  },

  async payManual(formData: FormData): Promise<LegacyPaymentRecord> {
    const purpose = String(formData.get('purpose') ?? 'JOIN') as LegacyPaymentRecord['purpose'];
    const record: LegacyPaymentRecord = {
      id: `pay-${Date.now()}`,
      purpose,
      status: 'PENDING',
      amount: state.me.pendingPayment?.paymentRequired ?? 0,
      currency: state.me.currency,
      createdAt: new Date().toISOString(),
    };
    state.pendingPayments.push(record);
    return delay(record);
  },

  async activateFromJoin(): Promise<void> {
    const pending = state.me.pendingJoin;
    if (!pending) {
      throw new LegacyClubHttpError(400, 'NO_PENDING_JOIN', 'No join in progress.');
    }
    const pkg = packageByCode(pending.package);
    const orderId = `legacy-order-${Date.now()}`;
    const weeklyIncreased = Math.round(pkg.monthlyCommission / 4);
    const weeklyAutoship = Math.round(pkg.autoshipAmount / 4);
    const nextDueCashout = weeklyIncreased - weeklyAutoship;
    const nextDueVoucherNet = Math.round(weeklyAutoship * 0.9);
    const startedAt = new Date().toISOString();
    const voucher = state.me.legacyVoucher ?? { balance: 0, status: 'ACTIVE' as const };

    state.me = {
      status: 'ACTIVE',
      currency: 'NGN',
      sponsorResolution: state.me.sponsorResolution,
      defaultSponsor: null,
      membership: {
        package: pkg.code,
        sponsorUsername: pending.sponsorUsername,
        sponsorSource: pending.sponsorSource,
        joinedAt: startedAt,
        cycleStartedAt: startedAt,
        joinOrderId: orderId,
      },
      legacyCashout: { balance: pkg.instantCommission, status: 'ACTIVE' },
      legacyVoucher: { balance: nextDueVoucherNet, status: 'ACTIVE' },
      instantReceived: pkg.instantCommission,
      directSuccesslineCount: 0,
      minDirectsToIncreaseMonthly: 3,
      canCashoutLegacy: true,
      pendingJoin: null,
      pendingPayment: null,
      shopMode: 'SHOP',
      cycle: {
        startedAt,
        cycleMonths: 6,
        cycleWeeks: 26,
        issuedCount: 0,
        droppedCount: 0,
        pendingCount: 0,
        pendingAmount: 0,
        nextDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        nextDueAmount: weeklyIncreased,
        nextDueCashoutAmount: nextDueCashout,
        nextDueVoucherNet,
        nextDueRateTier: 'BASE',
        isCycleComplete: false,
      },
      monthlyQualify: {
        directSuccesslineCount: 0,
        required: 3,
        qualifiedAt: null,
        isQualified: false,
      },
      autoship: {
        requiredAmount: weeklyAutoship,
        weeklyAutoshipAmount: weeklyAutoship,
        lastAutoshipAt: null,
        shopMode: 'SHOP',
      },
      priorPending: { count: 0, amount: 0 },
      lifecycle: {
        status: 'ACTIVE',
        earningEligible: true,
        cashoutEligible: true,
        canReactivate: false,
        startedAt,
        earningEndsAt: null,
        suspensionDueAt: null,
        reactivationSecondsRemaining: 0,
      },
    };
    state.ledger = [
      {
        id: `ledger-instant-${Date.now()}`,
        date: new Date().toISOString(),
        description: `Legacy Club Instant Membership Commission (${pkg.code})`,
        type: 'Credit',
        amount: pkg.instantCommission,
        currency: 'NGN',
      },
    ];
    state.pendingPayments = [];
    state.cart = [];
  },

  async lookupMember(username: string): Promise<LegacyMemberLookup> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) {
      return delay({
        username: '',
        exists: false,
        isRegistrationPaid: false,
        legacyStatus: 'NONE',
      });
    }
    if (LEGACY_SPONSORS[normalized]) {
      return delay({
        username: normalized,
        exists: true,
        isRegistrationPaid: true,
        legacyStatus: 'ACTIVE',
      });
    }
    if (normalized === 'unpaid_user') {
      return delay({
        username: normalized,
        exists: true,
        isRegistrationPaid: false,
        legacyStatus: 'NONE',
      });
    }
    if (normalized.startsWith('ready')) {
      return delay({
        username: normalized,
        exists: true,
        isRegistrationPaid: true,
        legacyStatus: 'NONE',
      });
    }
    return delay({
      username: normalized,
      exists: false,
      isRegistrationPaid: false,
      legacyStatus: 'NONE',
    });
  },

  async getSuccesslines(
    page = 1,
    limit = 20,
    search = '',
  ): Promise<LegacySuccesslinesResponse> {
    const q = search.trim().toLowerCase();
    let rows = [...state.successlines];
    if (q) rows = rows.filter((r) => r.username.toLowerCase().includes(q));
    const totalRecords = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / limit) || 1);
    const start = (page - 1) * limit;
    const slice = rows.slice(start, start + limit);
    return delay({
      summary: {
        directSuccesslineCount: state.me.directSuccesslineCount,
        minDirectsToIncreaseMonthly: state.me.minDirectsToIncreaseMonthly,
      },
      pagination: {
        totalRecords,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      successlines: slice,
    });
  },

  async getCashout(): Promise<LegacyCashoutResponse> {
    if (!state.me.legacyCashout) {
      return rejectDelay(
        new LegacyClubHttpError(404, 'NOT_FOUND', 'Legacy account not found.'),
      );
    }
    return delay({
      currency: state.me.currency,
      balance: state.me.legacyCashout.balance,
      walletStatus: state.me.legacyCashout.status,
      canCashoutLegacy: true,
      directSuccesslineCount: state.me.directSuccesslineCount,
      items: [...state.ledger],
      nextCursor: null,
    });
  },

  async withdrawCashout(body: LegacyCashoutWithdrawRequest): Promise<{ withdrawalId: string }> {
    if (!state.me.legacyCashout) {
      return rejectDelay(new LegacyClubHttpError(404, 'NOT_FOUND', 'Legacy account not found.'));
    }
    if (body.amount > state.me.legacyCashout.balance) {
      return rejectDelay(
        new LegacyClubHttpError(400, 'INSUFFICIENT_BALANCE', 'Insufficient Legacy account balance.'),
      );
    }
    if (!body.pin || body.pin.length < 4) {
      return rejectDelay(new LegacyClubHttpError(400, 'INVALID_PIN', 'Invalid PIN.'));
    }
    const nextBalance = state.me.legacyCashout.balance - body.amount;
    state.me = {
      ...state.me,
      legacyCashout: { ...state.me.legacyCashout, balance: nextBalance },
    };
    state.ledger = [
      {
        id: `ledger-wd-${Date.now()}`,
        date: new Date().toISOString(),
        description: 'Legacy account cash out',
        type: 'Debit',
        amount: body.amount,
        currency: body.currency,
      },
      ...state.ledger,
    ];
    return delay({ withdrawalId: `wd-${Date.now()}` });
  },

  async transferCashout(body: LegacyCashoutTransferRequest): Promise<LegacyCashoutTransferResponse> {
    if (!state.me.legacyCashout) {
      return rejectDelay(new LegacyClubHttpError(404, 'NOT_FOUND', 'Legacy account not found.'));
    }
    if (body.amount > state.me.legacyCashout.balance) {
      return rejectDelay(
        new LegacyClubHttpError(400, 'INSUFFICIENT_BALANCE', 'Insufficient Legacy account balance.'),
      );
    }
    if (!body.pin || body.pin.length < 4) {
      return rejectDelay(new LegacyClubHttpError(400, 'INVALID_PIN', 'Invalid PIN.'));
    }
    const nextBalance = state.me.legacyCashout.balance - body.amount;
    state.me = {
      ...state.me,
      legacyCashout: { ...state.me.legacyCashout, balance: nextBalance },
    };
    if (body.toWalletType === 'LEGACY_VOUCHER') {
      const voucher = state.me.legacyVoucher ?? { balance: 0, status: 'ACTIVE' as const };
      state.me = {
        ...state.me,
        legacyVoucher: { ...voucher, balance: voucher.balance + body.amount },
      };
    } else if (body.toWalletType === 'CASH') {
      state.cashBalance += body.amount;
    }
    state.ledger = [
      {
        id: `ledger-tr-${Date.now()}`,
        date: new Date().toISOString(),
        description: `Move to ${body.toWalletType}`,
        type: 'Debit',
        amount: body.amount,
        currency: body.currency,
      },
      ...state.ledger,
    ];
    return delay({ transferId: `tr-${Date.now()}` });
  },

  async getVoucher(): Promise<LegacyVoucherResponse> {
    const voucher = state.me.legacyVoucher ?? { balance: 0, status: 'ACTIVE' as const };
    return delay({
      currency: state.me.currency,
      balance: voucher.balance,
      status: voucher.status,
    });
  },

  async fundVoucherFromCash(amount: number, currency: LegacyCurrency): Promise<{ transferId: string }> {
    if (amount <= 0) {
      return rejectDelay(new LegacyClubHttpError(400, 'INVALID_AMOUNT', 'Enter a valid amount.'));
    }
    if (amount > state.cashBalance) {
      return rejectDelay(
        new LegacyClubHttpError(400, 'INSUFFICIENT_BALANCE', 'Insufficient CASH balance.'),
      );
    }
    state.cashBalance -= amount;
    const voucher = state.me.legacyVoucher ?? { balance: 0, status: 'ACTIVE' as const };
    state.me = {
      ...state.me,
      legacyVoucher: { ...voucher, balance: voucher.balance + amount },
    };
    return delay({ transferId: `fund-${Date.now()}` });
  },

  getCashBalance(): number {
    return state.cashBalance;
  },

  async getCart(): Promise<{ items: LegacyMockCartLine[]; subtotal: number }> {
    if (state.me.shopMode !== 'SHOP' && state.me.status !== 'ACTIVE') {
      return rejectDelay(
        new LegacyClubHttpError(
          403,
          LEGACY_ERROR_CODES.LEGACY_SHOP_JOIN_ONLY,
          'Finish membership payment before shopping.',
        ),
      );
    }
    return delay({ items: [...state.cart], subtotal: cartSubtotal() });
  },

  async putCartItem(productId: string, quantity: number): Promise<{ items: LegacyMockCartLine[]; subtotal: number }> {
    if (state.me.shopMode !== 'SHOP' && state.me.status !== 'ACTIVE') {
      return rejectDelay(
        new LegacyClubHttpError(
          403,
          LEGACY_ERROR_CODES.LEGACY_JOIN_REQUIRED,
          'Start your Legacy join first.',
        ),
      );
    }
    const product = MOCK_PRODUCTS.find((p) => p.id === productId);
    if (!product) {
      return rejectDelay(new LegacyClubHttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found.'));
    }
    const existing = state.cart.findIndex((l) => l.productId === productId);
    if (quantity <= 0) {
      if (existing >= 0) state.cart.splice(existing, 1);
    } else if (existing >= 0) {
      state.cart[existing] = {
        ...state.cart[existing],
        quantity,
      };
    } else {
      state.cart.push({
        productId,
        quantity,
        unitPrice: product.price,
        name: product.name,
        pv: product.pv,
        image: product.images[0],
      });
    }
    syncPendingJoinCart();
    return delay({ items: [...state.cart], subtotal: cartSubtotal() });
  },

  async clearCart(): Promise<void> {
    state.cart = [];
    syncPendingJoinCart();
    return delay(undefined);
  },

  async checkoutAndPay(walletType: string): Promise<{ checkoutId: string; orderId: string }> {
    if (walletType !== 'LEGACY_VOUCHER') {
      return rejectDelay(
        new LegacyClubHttpError(
          400,
          LEGACY_ERROR_CODES.LEGACY_VOUCHER_REQUIRED,
          'Pay with Legacy product voucher only.',
        ),
      );
    }

    const subtotal = cartSubtotal();
    if (subtotal <= 0) {
      return rejectDelay(
        new LegacyClubHttpError(400, 'EMPTY_CART', 'Add products before checkout.'),
      );
    }
    const voucher = state.me.legacyVoucher ?? { balance: 0, status: 'ACTIVE' as const };
    if (voucher.balance < subtotal) {
      return rejectDelay(
        new LegacyClubHttpError(
          400,
          'INSUFFICIENT_BALANCE',
          'Fund your Legacy product voucher, then return here.',
        ),
      );
    }
    state.me = {
      ...state.me,
      legacyVoucher: { ...voucher, balance: voucher.balance - subtotal },
    };
    state.cart = [];
    return delay({ checkoutId: `checkout-${Date.now()}`, orderId: `legacy-order-${Date.now()}` });
  },
};
