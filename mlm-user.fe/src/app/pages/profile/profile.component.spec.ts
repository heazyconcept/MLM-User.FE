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
  function create(hasTransactionPin: boolean) {
    const currentUser = signal({
      id: 'user-1',
      email: 'member@example.com',
      username: 'member',
      firstName: 'Test',
      lastName: 'Member',
      phoneNumber: '08000000000',
      hasTransactionPin,
    });

    TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ pinAction: 'setup' }),
              fragment: 'transaction-pin',
            },
          },
        },
        {
          provide: UserService,
          useValue: {
            currentUser,
            updateProfile: vi.fn(),
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
});
