import { Injectable, signal, computed, inject } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { tap, catchError, finalize, map } from 'rxjs/operators';
import {
  ReferralService,
  type DownlineItem,
  type SponsorInfo,
  type PlacementInfo,
  type UplineNode,
  type MatrixTreeResponse,
  type MatrixStageResponse,
  type MatrixFlowStage,
  type MatrixFlowResponse,
} from './referral.service';
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
  status: string;
  level: number;
  package: string;
  totalDirects: number;
  teamSize: number;
  rank?: string;
  stage?: string;
  isDirectReferral: boolean;
}

export interface StageMember {
  id: string;
  username: string;
  legs: number;
  status: 'active' | 'inactive';
  stage: number;
  rank?: string;
  stageLabel?: string;
}

export interface FlowStageMember {
  id: string;
  username: string;
  joinDate: string;
  status: 'ACTIVE' | 'UNPAID' | 'SUSPENDED';
  rank: string;
  stageLabel: string;
  rankingLevel: number;
  isCurrentUser: boolean;
  uplineUsername?: string | null;
}

@Injectable({
  providedIn: 'root',
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
    sponsorName: '',
  });

  readonly networkSummary = signal<NetworkSummary>({
    teamSize: 0,
    directReferrals: 0,
    activeLegs: 0,
    rank: '—',
    nextRank: '—',
    rankProgress: 0,
  });

  readonly cpvSummary = signal<CpvSummary>({
    personalCpv: 0,
    teamCpv: 0,
    requiredCpv: 0,
    cycle: '',
  });

  /** Default empty matrix when no data */
  private _emptyMatrix: MatrixNode = {
    id: 'root',
    username: 'You',
    package: null,
    level: 0,
    status: 'active',
    children: [],
  };

  readonly matrixTree = signal<MatrixNode>(this._emptyMatrix);
  readonly downlineList = signal<DownlineMember[]>([]);
  readonly sponsorInfo = signal<SponsorInfo | null>(null);
  readonly placementInfo = signal<PlacementInfo | null>(null);
  readonly uplineChain = signal<UplineNode[]>([]);

  private _inFlight = false;
  private _matrixInFlight = false;

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
    const matrix$ = this.referralService.getMatrixTree();
    const upline$ = this.referralService.getUpline();
    const cpv$ = this.earningsService.fetchCpvSummary();
    const earnings$ = this.earningsService.fetchEarningsSummary();
    const profile$ = this.userService.fetchProfile().pipe(catchError(() => of(null)));

    forkJoin({
      refInfo: refInfo$,
      sponsor: sponsor$,
      downlines: downlines$,
      matrix: matrix$,
      placement: placement$,
      upline: upline$,
      cpv: cpv$,
      earnings: earnings$,
      profile: profile$,
    })
      .pipe(
        tap(({ refInfo, sponsor, downlines, matrix, placement, upline, cpv, profile }) => {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          const currentUsername = (
            ((profile as Record<string, unknown> | null)?.['username'] as string | undefined) ??
            this.userService.currentUser()?.username ??
            ''
          ).trim();
          const fromReferralEndpoint = refInfo.referralUsername?.trim() ?? '';
          const linkUsername = fromReferralEndpoint || currentUsername;
          const url = linkUsername ? `${baseUrl}/ref/${linkUsername}` : '';
          this.referralLink.set({
            url,
            referralUsername: linkUsername,
            sponsorName: sponsor?.sponsorEmail ?? refInfo.referrerName ?? '',
          });

          this.sponsorInfo.set(sponsor);
          this.placementInfo.set(placement);
          this.uplineChain.set(upline);

          this.downlineList.set(downlines as DownlineMember[]);
          this.cpvSummary.set({
            personalCpv: cpv.personalCpv,
            teamCpv: cpv.teamCpv,
            requiredCpv: cpv.requiredCpv,
            cycle: cpv.cycle,
          });

          const user = profile ?? this.userService.currentUser();
          const teamSize = downlines.length;
          const directRefs = user?.directReferrals ?? downlines.filter((d) => d.level === 1).length;
          const activeLegs = user?.activeLegs ?? Math.min(directRefs, 2);
          const rank = user?.rank ?? '—';
          const requiredCpv = cpv.requiredCpv || 1;
          const rankProgress =
            requiredCpv > 0 ? Math.min(100, (cpv.teamCpv / requiredCpv) * 100) : 0;

          this.networkSummary.set({
            teamSize: teamSize || directRefs,
            directReferrals: directRefs,
            activeLegs,
            rank,
            nextRank: rank,
            rankProgress,
          });

          const matrixResponse = (matrix as MatrixTreeResponse | null) ?? { levels: [] };
          const matrixTree = this.buildTreeFromMatrixResponse(
            matrixResponse,
            profile as Record<string, unknown> | null,
          );
          const fallbackTree = this.buildTreeFromDownlines(downlines, profile as any);
          const hasMatrixLevels = (matrixResponse.levels?.length ?? 0) > 0;
          this.matrixTree.set(hasMatrixLevels ? matrixTree : fallbackTree);
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
        }),
      )
      .subscribe();
  }

  fetchMatrixTree(username?: string) {
    if (this._matrixInFlight) return of(this.matrixTree());
    this._matrixInFlight = true;
    this.isLoading.set(true);
    this.error.set(null);

    return this.referralService.getMatrixTree(username).pipe(
      map((response) => this.buildTreeFromMatrixResponse(response ?? { levels: [] }, null)),
      tap((tree) => {
        this.matrixTree.set(tree);
      }),
      catchError((err) => {
        this.error.set('Failed to load matrix tree. Please try again.');
        if (typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('[NetworkService] fetchMatrixTree failed:', err);
        }
        return of(this.matrixTree());
      }),
      finalize(() => {
        this._matrixInFlight = false;
        this.isLoading.set(false);
      }),
    );
  }

  fetchMatrixStage(stage: number) {
    const targetStage = this.clampStage(stage);
    return this.referralService.getMatrixStage(targetStage).pipe(
      map((response) => this.normalizeStageResponse(response, targetStage)),
      catchError(() => this.buildStageFallback(targetStage)),
    );
  }

  fetchMatrixFlow(stage: MatrixFlowStage) {
    return this.referralService.getMatrixFlow(stage).pipe(
      map((response) => {
        if (!response?.data) {
          return { members: [] as FlowStageMember[], totalMembers: 0, stageLabel: '' };
        }
        const members: FlowStageMember[] = (response.data.users ?? []).map((user) => {
          const normalized = String(user.status ?? '').trim().toUpperCase();
          const status: 'ACTIVE' | 'UNPAID' | 'SUSPENDED' =
            normalized === 'ACTIVE' ? 'ACTIVE' : normalized === 'SUSPENDED' ? 'SUSPENDED' : 'UNPAID';
          return {
            id: user.id,
            username: user.username,
            joinDate: user.joinDate,
            status,
            rank: user.rank,
            stageLabel: user.stageLabel,
            rankingLevel: user.rankingLevel,
            isCurrentUser: user.isCurrentUser,
            uplineUsername: user.uplineUsername ?? null,
          };
        });
        return {
          members,
          totalMembers: Number.isFinite(Number(response.data.totalUsers))
            ? Number(response.data.totalUsers)
            : members.length,
          stageLabel: response.data.stageLabel ?? '',
        };
      }),
      catchError(() => of({ members: [] as FlowStageMember[], totalMembers: 0, stageLabel: '' })),
    );
  }

  private buildTreeFromDownlines(
    downlines: DownlineItem[],
    profile?: Record<string, unknown> | null,
  ): MatrixNode {
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
          status: d2.status.toLowerCase().includes('active') ? 'active' : 'inactive',
          parentId: d.id,
          position: positions[j],
          rank: d2.rank,
          stage: d2.stage,
          directReferrals: d2.totalDirects,
          teamSize: d2.teamSize,
          children: [],
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
          children: [],
        });
      }
      return {
        id: d.id,
        username: d.username,
        package: d.package ?? null,
        level: 1,
        status: d.status.toLowerCase().includes('active') ? 'active' : 'inactive',
        parentId: 'root',
        position: pos,
        rank: d.rank,
        stage: d.stage,
        directReferrals: d.totalDirects,
        teamSize: d.teamSize,
        children: childNodes,
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
          {
            id: `e-${children.length}-0`,
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            parentId: `empty-${children.length}`,
            position: 'left',
            children: [],
          },
          {
            id: `e-${children.length}-1`,
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            parentId: `empty-${children.length}`,
            position: 'center',
            children: [],
          },
          {
            id: `e-${children.length}-2`,
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            parentId: `empty-${children.length}`,
            position: 'right',
            children: [],
          },
        ],
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
      children,
    };
  }

  private buildTreeFromMatrixResponse(
    response: MatrixTreeResponse,
    profile?: Record<string, unknown> | null,
  ): MatrixNode {
    const levels = response.levels ?? [];
    if (!levels.length) {
      return this._emptyMatrix;
    }

    const nodesByUsername = new Map<string, MatrixNode>();
    const nodesById = new Map<string, MatrixNode>();
    let maxLevel = 0;

    for (const levelEntry of levels) {
      const levelNumber = Number(levelEntry.level ?? 0);
      maxLevel = Math.max(maxLevel, levelNumber);
      for (const user of levelEntry.users ?? []) {
        const username = String(user.username ?? '').trim();
        if (!username) {
          continue;
        }
        const userId = String(user.userId ?? username);
        const status = user.isActive === false ? 'inactive' : 'active';
        const node: MatrixNode = {
          id: userId,
          username,
          package: null,
          level: user.relativeLevel != null ? Number(user.relativeLevel) : levelNumber,
          status,
          rank: user.rank ?? undefined,
          stage: user.stageLabel ?? undefined,
          children: [],
        };
        nodesByUsername.set(username, node);
        nodesById.set(node.id, node);
      }
    }

    for (const levelEntry of levels) {
      for (const user of levelEntry.users ?? []) {
        const username = String(user.username ?? '').trim();
        if (!username) continue;
        const parentUsername = String(user.parentUsername ?? '').trim();
        if (!parentUsername) continue;

        const parent = nodesByUsername.get(parentUsername);
        const child = nodesByUsername.get(username);
        if (!parent || !child) continue;

        child.parentId = parent.id;
        parent.children = parent.children ?? [];
        parent.children.push(child);
      }
    }

    for (const node of nodesById.values()) {
      const children = node.children ?? [];
      children.forEach((child, index) => {
        child.position = this.getPositionByIndex(index);
      });

      if (node.level < maxLevel) {
        while (children.length < 3) {
          const emptyIndex = children.length;
          children.push({
            id: `empty-${node.id}-${emptyIndex}`,
            username: 'Empty Slot',
            package: null,
            level: node.level + 1,
            status: 'empty',
            parentId: node.id,
            position: this.getPositionByIndex(emptyIndex),
            children: [],
          });
        }
      }
    }

    const rootUsername = String(response.rootUsername ?? '').trim();
    const rootNode =
      (rootUsername && nodesByUsername.get(rootUsername)) ||
      (this.userService.currentUser()?.username &&
        nodesByUsername.get(String(this.userService.currentUser()?.username))) ||
      (levels[0]?.users?.[0]?.username
        ? nodesByUsername.get(String(levels[0].users[0].username))
        : undefined);

    if (!rootNode) {
      return this._emptyMatrix;
    }
    return rootNode;
  }

  private getPositionByIndex(index: number): 'left' | 'center' | 'right' {
    if (index === 0) return 'left';
    if (index === 1) return 'center';
    return 'right';
  }

  private normalizeStageResponse(
    response: MatrixStageResponse,
    stage: number,
  ): { members: StageMember[]; totalMembers: number } {
    if (!response?.data) {
      return { members: [], totalMembers: 0 };
    }

    const stageValue = Number(response.data.stage ?? stage);
    const members = (response.data.members ?? []).map((member) => {
      const parsedStage = this.readStageNumber(member.stage) ?? stageValue;
      return {
        id: member.id,
        username: member.username,
        legs: Number(member.legs ?? 0),
        status: this.normalizeStageStatus(member.status),
        stage: parsedStage,
        rank: member.rank ?? undefined,
      } as StageMember;
    });

    const totalMembers = Number.isFinite(Number(response.data.totalMembers))
      ? Number(response.data.totalMembers)
      : members.length;

    return {
      members,
      totalMembers,
    };
  }

  private buildStageFallback(stage: number) {
    const cachedDownlines = this.downlineList();
    const downlines$ = cachedDownlines.length
      ? of(cachedDownlines)
      : this.referralService.getDownlines();

    return downlines$.pipe(
      map((downlines) => {
        const members = downlines
          .map((item) => this.mapDownlineToStageMember(item, stage))
          .filter((member): member is StageMember => member !== null);

        return {
          members,
          totalMembers: members.length,
        };
      }),
    );
  }

  private mapDownlineToStageMember(item: DownlineItem, stage: number): StageMember | null {
    const parsedStage = this.readStageNumber(item.stage) ?? item.level;
    if (parsedStage !== stage) {
      return null;
    }

    return {
      id: item.id,
      username: item.username,
      legs: item.totalDirects,
      status: item.status.toLowerCase().includes('active') ? 'active' : 'inactive',
      stage,
      rank: item.rank,
    };
  }

  private normalizeStageStatus(status: unknown): 'active' | 'inactive' {
    if (status === true) return 'active';
    const normalized = String(status ?? '')
      .trim()
      .toLowerCase();
    if (!normalized) return 'inactive';
    if (['active', 'paid', 'enabled', 'approved'].includes(normalized)) return 'active';
    return 'inactive';
  }

  private readStageNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const stageMatch = trimmed.match(/stage\s*(\d+)/i);
      if (stageMatch?.[1]) return Number(stageMatch[1]);
      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber)) return Math.trunc(asNumber);
    }

    return null;
  }

  private clampStage(stage: number): number {
    const numeric = Number(stage);
    if (!Number.isFinite(numeric)) return 1;
    return Math.min(13, Math.max(1, Math.trunc(numeric)));
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
