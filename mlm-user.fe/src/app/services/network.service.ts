import { Injectable, signal, computed } from '@angular/core';

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
  code: string;
  sponsorName: string;
}

export interface MatrixNode {
  id: string;
  username: string;
  package: 'basic' | 'premium' | 'vip' | null; // null for empty slot
  level: number;
  status: 'active' | 'inactive' | 'empty';
  avatar?: string;
  children?: MatrixNode[];
  parentId?: string;
  leftId?: string;
  rightId?: string;
  position?: 'left' | 'center' | 'right'; 
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
}

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  // Mock Data Signals
  readonly referralLink = signal<ReferralLink>({
    url: 'https://segulah.com/ref/pelumi123',
    code: 'pelumi123',
    sponsorName: 'Oluwapelumi'
  });

  readonly networkSummary = signal<NetworkSummary>({
    teamSize: 142,
    directReferrals: 3,
    activeLegs: 2,
    rank: 'Silver Director',
    nextRank: 'Gold Director',
    rankProgress: 65
  });

  readonly cpvSummary = signal<CpvSummary>({
    personalCpv: 150,
    teamCpv: 4500,
    requiredCpv: 5000,
    cycle: 'January 2026'
  });

  // Mock Matrix Tree (3×2 Matrix: Width = 3, 3 children per node)
  private _mockMatrix: MatrixNode = {
    id: 'root',
    username: 'You',
    package: 'vip',
    level: 0,
    status: 'active',
    children: [
      {
        id: 'l1',
        username: 'Sarah_J',
        package: 'premium',
        level: 1,
        status: 'active',
        position: 'left',
        children: [
          {
            id: 'l1-l2',
            username: 'Mike_T',
            package: 'basic',
            level: 2,
            status: 'active',
            position: 'left',
            children: []
          },
          {
            id: 'l1-c2',
            username: 'Emma_W',
            package: 'premium',
            level: 2,
            status: 'active',
            position: 'center',
            children: []
          },
          {
            id: 'l1-r2',
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            position: 'right',
            children: []
          }
        ]
      },
      {
        id: 'c1',
        username: 'David_B',
        package: 'vip',
        level: 1,
        status: 'active',
        position: 'center',
        children: [
          {
            id: 'c1-l2',
            username: 'Anna_K',
            package: 'premium',
            level: 2,
            status: 'active',
            position: 'left',
            children: []
          },
          {
            id: 'c1-c2',
            username: 'James_W',
            package: 'basic',
            level: 2,
            status: 'active',
            position: 'center',
            children: []
          },
          {
            id: 'c1-r2',
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            position: 'right',
            children: []
          }
        ]
      },
      {
        id: 'r1',
        username: 'Empty Slot',
        package: null,
        level: 1,
        status: 'empty',
        position: 'right',
        children: [
          {
            id: 'r1-l2',
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            position: 'left',
            children: []
          },
          {
            id: 'r1-c2',
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            position: 'center',
            children: []
          },
          {
            id: 'r1-r2',
            username: 'Empty Slot',
            package: null,
            level: 2,
            status: 'empty',
            position: 'right',
            children: []
          }
        ]
      }
    ]
  };

  readonly matrixTree = signal<MatrixNode>(this._mockMatrix);

  readonly downlineList = signal<DownlineMember[]>([
    { id: '1', username: 'Sarah_J', fullName: 'Sarah Jenkins', joinDate: new Date('2025-11-15'), status: 'active', level: 1, package: 'Premium', totalDirects: 5, teamSize: 45 },
    { id: '2', username: 'David_B', fullName: 'David Brown', joinDate: new Date('2025-11-20'), status: 'active', level: 1, package: 'VIP', totalDirects: 8, teamSize: 62 },
    { id: '3', username: 'Mike_T', fullName: 'Mike Tyson', joinDate: new Date('2025-12-01'), status: 'active', level: 2, package: 'Basic', totalDirects: 0, teamSize: 0 },
    { id: '4', username: 'Emma_W', fullName: 'Emma Wilson', joinDate: new Date('2025-12-02'), status: 'active', level: 2, package: 'Premium', totalDirects: 0, teamSize: 0 },
    { id: '5', username: 'Anna_K', fullName: 'Anna Kendrick', joinDate: new Date('2025-12-05'), status: 'active', level: 2, package: 'Premium', totalDirects: 2, teamSize: 12 },
    { id: '6', username: 'James_W', fullName: 'James Wilson', joinDate: new Date('2025-12-10'), status: 'active', level: 2, package: 'Basic', totalDirects: 1, teamSize: 4 },
  ]);

  constructor() { }

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
