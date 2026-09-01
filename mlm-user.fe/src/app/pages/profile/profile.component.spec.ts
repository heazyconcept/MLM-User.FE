import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ModalService } from '../../services/modal.service';
import { OnboardingService } from '../../services/onboarding.service';
import { UserService } from '../../services/user.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent transaction PIN deep link', () => {
  function create(
    hasTransactionPin: boolean,
    query: Record<string, string> = { pinAction: 'setup' },
    userOverrides: Record<string, unknown> = {},
  ) {
    const currentUser = signal({
      id: 'user-1',
      email: 'member@example.com',
      username: 'member',
      firstName: 'Test',
      lastName: 'Member',
      phoneNumber: '08000000000',
      hasTransactionPin,
      ...userOverrides,
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(query),
              fragment: 'transaction-pin',
            },
          },
        },
        {
          provide: UserService,
          useValue: {
            currentUser,
            needsProfileSetup: signal(userOverrides['isProfileComplete'] === false),
            updateProfile: vi.fn(),
            applyProfileCompleteness: vi.fn(),
          },
        },
        {
          provide: OnboardingService,
          useValue: {
            getBankDetails: vi.fn().mockReturnValue(of({})),
          },
        },
        {
          provide: ModalService,
          useValue: { open: vi.fn() },
        },
      ],
    });
    TestBed.overrideComponent(ProfileComponent, { set: { template: '' } });

    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('opens PIN setup when a user without a PIN follows the setup deep link', () => {
    const component = create(false);

    expect(component.pinFormState()).toBe('SETUP');
  });

  it('does not open PIN setup when the user already has a PIN', () => {
    const component = create(true);

    expect(component.pinFormState()).toBe('IDLE');
  });

  it('opens edit mode when setup=complete is in the query', () => {
    const component = create(true, { setup: 'complete' }, { isProfileComplete: false });

    expect(component.isEditMode()).toBe(true);
  });
});
