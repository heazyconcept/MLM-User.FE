import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ModalService } from '../../../services/modal.service';
import { UserService } from '../../../services/user.service';
import { SettingsSecurityComponent } from './settings-security.component';

describe('SettingsSecurityComponent transaction PIN management', () => {
  it('links to Profile instead of rendering duplicate PIN forms', () => {
    TestBed.configureTestingModule({
      imports: [SettingsSecurityComponent],
      providers: [
        provideRouter([]),
        {
          provide: UserService,
          useValue: {
            currentUser: signal({ hasTransactionPin: false }),
            changePassword: vi.fn(),
          },
        },
        {
          provide: ModalService,
          useValue: { open: vi.fn() },
        },
      ],
    });

    const fixture = TestBed.createComponent(SettingsSecurityComponent);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector(
      '[data-testid="security-pin-profile-link"]',
    ) as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toContain('/profile');
    expect(fixture.nativeElement.querySelector('#setup-pin')).toBeNull();
    expect(fixture.nativeElement.querySelector('#pin-old')).toBeNull();
    expect(fixture.nativeElement.querySelector('#reset-otp')).toBeNull();
  });
});
