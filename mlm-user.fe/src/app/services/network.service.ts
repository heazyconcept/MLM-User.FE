import { Injectable, signal, computed, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { ReferralService, type DownlineItem, type SponsorInfo, type PlacementInfo, type UplineNode } from './referral.service';
import { UserService } from './user.service';
import { EarningsService } from './earnings.service';

export interface NetworkSummary {
  teamSize: number;
  directReferrals: number;
  activeLegs: number;
  rank: string;
  nextRank: string;
  rankProgress: number;
}

export interface CpvSummary {
  personalCpv: number;
  teamCpv: number;
  requiredCpv: number;
  cycle: string;
}

export interface ReferralLink {
  url: string;
  /** Slug used in `/ref/{username}` — always username, never referralCode */
  referralUsername: string;
  sponsorName: string;
}

export interface MatrixNode {
  id: string;
  username: string;
  package: string | null;
  level: number;
  status: 'active' | 'inactive' | 'empty';
  avatar?: string;
  children?: MatrixNode[];
  parentId?: string;
  leftId?: string;
  rightId?: string;
  position?: 'left' | 'center' | 'right';
  rank?: string;
  stage?: string;
  directReferrals?: number;
  teamSize?: number;
}

export interface DownlineMember {
  id: string;
  username: string;
  fullName: string;
  joinDate: Date;
  status: 'active' | 'inactive';
  level: number;
  package: string;
  totalDirects: number;
  teamSize: number;
  rank?: string;
  stage?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private referralService = inject(ReferralService);
  private userService = inject(UserService);
  private earningsService = inject(EarningsService);

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly referralLink = signal<ReferralLink>({
    url: '',
    referralUsername: '',
    sponsorName: ''
  });

  readonly networkSummary = signal<NetworkSummary>({
    teamSize: 0,
    directReferrals: 0,
    activeLegs: 0,
    rank: '—',
    nextRank: '—',
    rankProgress: 0
  });

  readonly cpvSummary = signal<CpvSummary>({
    personalCpv: 0,
    teamCpv: 0,
    requiredCpv: 0,
    cycle: ''
  });

  /** Default empty matrix when no data */
  private _emptyMatrix: MatrixNode = {
    id: 'root',
    username: 'You',
    package: null,
    level: 0,
    status: 'active',
    children: []
  };

  readonly matrixTree = signal<MatrixNode>(this._emptyMatrix);
  readonly downlineList = signal<DownlineMember[]>([]);
  readonly sponsorInfo = signal<SponsorInfo | null>(null);
  readonly placementInfo = signal<PlacementInfo | null>(null);
  readonly uplineChain = signal<UplineNode[]>([]);

  private _inFlight = false;

  constructor() {}

  fetchNetworkData(): void {
    if (this._inFlight) return;
    this._inFlight = true;
    this.isLoading.set(true);
    this.error.set(null);

    const refInfo$ = this.referralService.getReferralInfo();
    const sponsor$ = this.referralService.getSponsor();
    const downlines$ = this.referralService.getDownlines();
    const placement$ = this.referralService.getPlacement();
    const upline$ = this.referralService.getUpline();
    const cpv$ = this.earningsService.fetchCpvSummary();
    const earnings$ = this.earningsService.fetchEarningsSummary();
    const profile$ = this.userService.fetchProfile().pipe(catchError(() => of(null)));

    forkJoin({
      refInfo: refInfo$,
      sponsor: sponsor$,
      downlines: downlines$,
      placement: placement$,
      upline: upline$,
      cpv: cpv$,
      earnings: earnings$,
      profile: profile$
    })
      .pipe(
        tap(({ refInfo, sponsor, downlines, placement, upline, cpv, profile }) => {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          const currentUsername = (
            (profile as Record<string, unknown> | null)?.['username'] as string | undefined
            ?? this.userService.currentUser()?.username
            ?? ''
          ).trim();
          const fromReferralEndpoint = refInfo.referralUsername?.trim() ?? '';
          const linkUsername = fromReferralEndpoint || currentUsername;
          const url = linkUsername ? `${baseUrl}/ref/${linkUsername}` : '';
          this.referralLink.set({
            url,
            referralUsername: linkUsername,
            sponsorName: sponsor?.sponsorEmail ?? refInfo.referrerName ?? ''
          });

          this.sponsorInfo.set(sponsor);
          this.placementInfo.set(placement);
          this.uplineChain.set(upline);

          this.downlineList.set(downlines as DownlineMember[]);
          this.cpvSummary.set({
            personalCpv: cpv.personalCpv,
            teamCpv: cpv.teamCpv,
            requiredCpv: cpv.requiredCpv,
            cycle: cpv.cycle
          });

          const user = profile ?? this.userService.currentUser();
          const teamSize = downlines.length;
          const directRefs = user?.directReferrals ?? downlines.filter((d) => d.level === 1).length;
          const activeLegs = user?.activeLegs ?? Math.min(directRefs, 2);
          const rank = user?.rank ?? '—';
          const requiredCpv = cpv.requiredCpv || 1;
          const rankProgress = requiredCpv > 0 ? Math.min(100, (cpv.teamCpv / requiredCpv) * 100) : 0;

          this.networkSummary.set({
            teamSize: teamSize || directRefs,
            directReferrals: directRefs,
            activeLegs,
            rank,
            nextRank: rank,
            rankProgress
          });

          this.matrixTree.set(this.buildTreeFromDownlines(downlines, profile as any));
        }),
        catchError((err) => {
          this.error.set('Failed to load network data. Please try again.');
          if (typeof ngDevMode !== 'undefined' && ngDevMode) {
            console.error('[NetworkService] fetchNetworkData failed:', err);
          }
          return of(null);
        }),
        finalize(() => {
          this._inFlight = false;
          this.isLoading.set(false);
        })
      )
      .subscribe();
  }

  private buildTreeFromDownlines(downlines: DownlineItem[], profile?: Record<string, unknown> | null): MatrixNode {
    const level1 = downlines.filter((d) => d.level === 1);
    const level2 = downlines.filter((d) => d.level === 2);
    const positions: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];

    // Distribute L2 children using each L1 member's actual totalDirects count
    let l2Offset = 0;
    const children: MatrixNode[] = level1.slice(0, 3).map((d, i) => {
      const pos = positions[i];
      const childCount = Math.min(d.totalDirects, 3); // max 3 per slot in ternary tree
      const childNodes: MatrixNode[] = level2
        .slice(l2Offset, l2Offset + childCount)
        .map((d2, j) => ({
          id: d2.id,
          username: d2.username,
          package: d2.package ?? null,
          level: 2,
          status: d2.status,
          parentId: d.id,
          position: positions[j],
          rank: d2.rank,
          stage: d2.stage,
          directReferrals: d2.totalDirects,
          teamSize: d2.teamSize,
          children: []
        }));
      l2Offset += childCount;

      while (childNodes.length < 3) {
        childNodes.push({
          id: `empty-${d.id}-${childNodes.length}`,
          username: 'Empty Slot',
          package: null,
          level: 2,
          status: 'empty',
          parentId: d.id,
          position: positions[childNodes.length],
          children: []
        });
      }
      return {
        id: d.id,
        username: d.username,
        package: d.package ?? null,
        level: 1,
        status: d.status,
        parentId: 'root',
        position: pos,
        rank: d.rank,
        stage: d.stage,
        directReferrals: d.totalDirects,
        teamSize: d.teamSize,
        children: childNodes
      };
    });

    while (children.length < 3) {
      children.push({
        id: `empty-${children.length}`,
        username: 'Empty Slot',
        package: null,
        level: 1,
        status: 'empty',
        parentId: 'root',
        position: positions[children.length],
        children: [
          { id: `e-${children.length}-0`, username: 'Empty Slot', package: null, level: 2, status: 'empty', parentId: `empty-${children.length}`, position: 'left', children: [] },
          { id: `e-${children.length}-1`, username: 'Empty Slot', package: null, level: 2, status: 'empty', parentId: `empty-${children.length}`, position: 'center', children: [] },
          { id: `e-${children.length}-2`, username: 'Empty Slot', package: null, level: 2, status: 'empty', parentId: `empty-${children.length}`, position: 'right', children: [] }
        ]
      });
    }

    // Root node — pull rank/stage from profile if available
    const rootRank = profile ? String((profile as any)['rank'] ?? '') : undefined;
    const rootStage = profile ? String((profile as any)['stage'] ?? '') : undefined;

    return {
      id: 'root',
      username: 'You',
      package: null,
      level: 0,
      status: 'active',
      rank: rootRank || undefined,
      stage: rootStage || undefined,
      children
    };
  }

  getReferralLink() {
    return this.referralLink();
  }

  // Helper to flatten tree if needed or find a node
  findNode(id: string, node: MatrixNode = this.matrixTree()): MatrixNode | null {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  }
}
