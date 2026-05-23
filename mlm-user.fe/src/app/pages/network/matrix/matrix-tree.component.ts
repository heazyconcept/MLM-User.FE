import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  effect,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService, MatrixNode, type StageMember, type FlowStageMember } from '../../../services/network.service';
import { type MatrixFlowStage } from '../../../services/referral.service';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { TreeNode } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogService } from 'primeng/dynamicdialog';
import { CreateReferralComponent } from '../create-referral/create-referral.component';

interface FlatNode {
  id: string;
  username: string;
  package: string | null;
  level: number;
  status: 'active' | 'inactive' | 'empty';
  position?: 'left' | 'center' | 'right';
  rank?: string;
  stage?: string;
}

type MatrixTabValue = 'entry' | number;

interface StageTab {
  label: string;
  value: MatrixTabValue;
}

@Component({
  selector: 'app-matrix-tree',
  standalone: true,
  imports: [
    CommonModule,
    OrganizationChartModule,
    DialogModule,
    TableModule,
    ButtonModule,
    TooltipModule,
    SkeletonModule,
  ],
  providers: [DialogService],
  templateUrl: './matrix-tree.component.html',
  styleUrl: './matrix-tree.component.css',
})
export class MatrixTreeComponent implements OnInit, AfterViewInit {
  private networkService = inject(NetworkService);
  private dialogService = inject(DialogService);
  originalRoot = computed(() => this.networkService.matrixTree());

  @ViewChild('matrixViewport', { static: true }) matrixViewport?: ElementRef<HTMLElement>;
  @ViewChild('mobileMatrixTree') mobileMatrixTree?: ElementRef<HTMLElement>;

  // Navigation state
  currentRootNode = signal<MatrixNode>(this.networkService.matrixTree());
  navigationStack = signal<MatrixNode[]>([]);
  nodeForModal = signal<MatrixNode | null>(null);
  showMatrixInfo = signal(false);

  windowWidth = signal(typeof window !== 'undefined' ? window.innerWidth : 360);
  mobileScale = computed(() => {
    const width = this.windowWidth();
    // 24px is total horizontal padding of mobile-matrix-tree (12px * 2)
    const availableWidth = width - 24;
    return Math.min(1, availableWidth / 510);
  });
  mobileZoom = signal(1.0);

  activeTab = signal<MatrixTabValue>('entry');
  stageMembers = signal<StageMember[]>([]);
  stageTotalMembers = signal(0);
  stageLoading = signal(false);
  entryRoot = signal<MatrixNode>(this.buildEntryRoot());
  stageRoot = signal<MatrixNode>(this.buildEmptyStageRoot(1));
  /** Maps UI stage number (1-6) to backend flow stage key */
  private readonly stageToFlowKey: Record<number, MatrixFlowStage> = {
    1: 'mentor',
    2: 'manager',
    3: 'senior_manager',
    4: 'director',
    5: 'senior_director',
    6: 'consultant',
  };

  readonly stageTabs: StageTab[] = [
    { label: 'Entry', value: 'entry' },
    { label: 'Mentor', value: 1 },
    { label: 'Manager', value: 2 },
    { label: 'Senior Manager', value: 3 },
    { label: 'Director', value: 4 },
    { label: 'Senior Director', value: 5 },
    { label: 'Consultant', value: 6 },
  ];

 mobileFitScale(): number {
  const width = window.innerWidth;

  if (width <= 360) return 0.28;
  if (width <= 380) return 0.3;
  if (width <= 430) return 0.34;
  if (width <= 480) return 0.38;
  if (width <= 640) return 0.44;

  return this.zoomLevel();
}

  private readonly STAGE_COLORS: Record<
    string | number,
    { accent: string; border: string; avatar: string; text: string }
  > = {
    entry: { accent: '#2d7a3a', border: '#2d7a3a', avatar: '#1f5a2a', text: '#1f5a2a' },
    1: { accent: '#0ea5e9', border: '#0ea5e9', avatar: '#0284c7', text: '#0369a1' },
    2: { accent: '#8b5cf6', border: '#8b5cf6', avatar: '#7c3aed', text: '#6d28d9' },
    3: { accent: '#f59e0b', border: '#f59e0b', avatar: '#d97706', text: '#b45309' },
    4: { accent: '#ef4444', border: '#ef4444', avatar: '#dc2626', text: '#b91c1c' },
    5: { accent: '#10b981', border: '#10b981', avatar: '#059669', text: '#047857' },
    6: { accent: '#f97316', border: '#f97316', avatar: '#ea580c', text: '#c2410c' },
    7: { accent: '#06b6d4', border: '#06b6d4', avatar: '#0891b2', text: '#0e7490' },
    8: { accent: '#ec4899', border: '#ec4899', avatar: '#db2777', text: '#be185d' },
    9: { accent: '#6366f1', border: '#6366f1', avatar: '#4f46e5', text: '#4338ca' },
    10: { accent: '#84cc16', border: '#84cc16', avatar: '#65a30d', text: '#4d7c0f' },
    11: { accent: '#14b8a6', border: '#14b8a6', avatar: '#0d9488', text: '#0f766e' },
    12: { accent: '#a855f7', border: '#a855f7', avatar: '#9333ea', text: '#7e22ce' },
    13: { accent: '#fb923c', border: '#fb923c', avatar: '#f97316', text: '#ea580c' },
  };

  readonly stageLegend = [
    { stage: 1, rank: 'Stakeholder', color: '#0ea5e9' },
    { stage: 2, rank: 'Mentor', color: '#8b5cf6' },
    { stage: 3, rank: 'Manager', color: '#f59e0b' },
    { stage: 4, rank: 'Director', color: '#ef4444' },
    { stage: 5, rank: 'Sr. Director', color: '#10b981' },
    { stage: 6, rank: 'Consultant', color: '#f97316' },
  ];

  openCreateReferralDialog(options?: {
    placementParentUsername?: string | null;
    focusNodeId?: string;
  }): void {
    const dialogRef = this.dialogService.open(CreateReferralComponent, {
      header: 'Create Referral',
      width: '520px',
      contentStyle: { 'max-height': '700px', overflow: 'auto' },
      baseZIndex: 10000,
      data: {
        returnUrl: '/network/matrix',
        placementParentUsername: options?.placementParentUsername ?? null,
      },
    });

    const focusNodeId = options?.focusNodeId ?? this.currentRootNode().id;
    dialogRef?.onClose.subscribe((created) => {
      if (created !== true) {
        return;
      }

      // The create dialog triggers network refresh; keep user on the branch where they initiated placement.
      this.restoreFocusedBranch(focusNodeId);
    });
  }

  /** Default zoom is overridden by auto-fit unless the user manually adjusts zoom. */
  zoomLevel = signal(typeof window !== 'undefined' && window.innerWidth < 640 ? 0.3 : 0.7);
  /** Natural (unscaled) chart dimensions, captured after render so we can size the wrapper. */
  chartNaturalWidth = signal(0);
  chartNaturalHeight = signal(0);
  scaledWidth = computed(() => Math.ceil(this.chartNaturalWidth() * this.zoomLevel()));
  scaledHeight = computed(() => Math.ceil(this.chartNaturalHeight() * this.zoomLevel()));
  private userAdjustedZoom = false;
  private autoFitDone = false;

  isLoading = computed(() => this.networkService.isLoading());
  error = computed(() => this.networkService.error() ?? null);
  activeStageNumber = computed(() =>
    typeof this.activeTab() === 'number' ? this.activeTab() : null,
  );
  displayRoot = computed(() =>
    this.activeTab() === 'entry' ? this.entryRoot() : this.stageRoot(),
  );

  constructor() {
    effect(() => {
      const root = this.originalRoot();
      if (this.currentRootNode().id === 'root') {
        this.currentRootNode.set(root);
      }

      this.requestAutoFit();
    });

    // Re-run auto-fit whenever the rendered tree changes (entry/stage swaps, data reload)
    effect(() => {
      this.displayRoot();
      this.autoFitDone = false;
      this.userAdjustedZoom = false;
      this.requestAutoFit();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.windowWidth.set(window.innerWidth);
      });
    }
  }

  ngOnInit(): void {
    this.networkService.fetchNetworkData();
    this.loadEntryData();
  }

  // Pinch-to-zoom touch variables
  private initialTouchDistance = 0;
  private initialMobileZoom = 1.0;
  private isPinching = false;

  ngAfterViewInit(): void {
    this.requestAutoFit();

    const mobileEl = this.mobileMatrixTree?.nativeElement;
    if (mobileEl) {
      mobileEl.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: true });
      mobileEl.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
      mobileEl.addEventListener('touchend', () => this.onTouchEnd(), { passive: true });
      mobileEl.addEventListener('touchcancel', () => this.onTouchEnd(), { passive: true });
    }
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.isPinching = true;
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      this.initialTouchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      this.initialMobileZoom = this.mobileZoom();
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (this.isPinching && event.touches.length === 2) {
      // Prevent browser default whole-page scale zoom, allowing us to zoom ONLY the nodes tree
      event.preventDefault();

      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const currentDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

      if (this.initialTouchDistance > 0) {
        const ratio = currentDistance / this.initialTouchDistance;
        // Adjust the mobile zoom dynamically between 1.0 and 2.5
        const newZoom = Math.max(1.0, Math.min(10.0, this.initialMobileZoom * ratio));
        this.mobileZoom.set(newZoom);
      }
    }
  }

  onTouchEnd(): void {
    this.isPinching = false;
    this.initialTouchDistance = 0;
  }

  // Computed: check if viewing original root
  isRootView = computed(() => {
    return this.navigationStack().length === 0;
  });

  // Computed: current matrix tree (from currentRootNode) converted to PrimeNG TreeNode format
  matrixTree = computed(() => {
    const root = this.displayRoot();
    // Create a new root node with level 0 to display properly
    const adjustedRoot: MatrixNode = {
      ...root,
      level: 0,
      username: root.username === 'You' ? 'You' : root.username,
    };
    const desktopRoot = this.activeTab() === 'entry'
      ? this.stripEmptyNodes(adjustedRoot)
      : adjustedRoot;
    // Convert to TreeNode array (OrganizationChart expects an array)
    return [this.convertToTreeNode(desktopRoot)];
  });

  // Flattened list for mobile view
  flattenedNodes = computed(() => {
    const nodes: FlatNode[] = [];
    const root = this.displayRoot();
    const adjustedRoot: MatrixNode = {
      ...root,
      level: 0,
      username: root.username === 'You' ? 'You' : root.username,
    };
    this.flattenTree(adjustedRoot, nodes);
    return nodes;
  });

  private flattenTree(node: MatrixNode, result: FlatNode[]): void {
    result.push({
      id: node.id,
      username: node.username,
      package: node.package,
      level: node.level,
      status: node.status,
      position: node.position,
      rank: node.rank,
      stage: node.stage,
    });

    if (node.children) {
      for (const child of node.children) {
        this.flattenTree(child, result);
      }
    }
  }

  private stripEmptyNodes(node: MatrixNode): MatrixNode {
    const children = (node.children ?? [])
      .filter((child) => child.status !== 'empty')
      .map((child) => this.stripEmptyNodes(child));
    return { ...node, children };
  }

  zoomIn() {
    this.userAdjustedZoom = true;
    this.zoomLevel.update((z) => Math.min(z + 0.2, 2));
    this.mobileZoom.update((z) => Math.min(z + 0.25, 10.0));
  }

  zoomOut() {
    this.userAdjustedZoom = true;
    this.zoomLevel.update((z) => Math.max(z - 0.2, 0.4));
    this.mobileZoom.update((z) => Math.max(z - 0.25, 1.0));
  }

  onTabChange(tab: MatrixTabValue): void {
    if (tab === this.activeTab()) {
      return;
    }

    this.mobileZoom.set(1.0);
    this.activeTab.set(tab);
    if (tab === 'entry') {
      this.loadEntryData();
      this.requestAutoFit();
      return;
    }

    this.loadStageData(tab);
    this.autoFitDone = false;
    this.requestAutoFit();
  }

  loadStageData(stage: number): void {
    this.stageLoading.set(true);

    const flowKey = this.stageToFlowKey[stage];
    if (!flowKey) {
      // No mapping (shouldn't happen) — show empty
      this.stageMembers.set([]);
      this.stageTotalMembers.set(0);
      this.stageRoot.set(this.buildEmptyStageRoot(stage));
      this.stageLoading.set(false);
      return;
    }

    this.networkService.fetchMatrixFlow(flowKey).subscribe({
      next: (result) => {
        const rootSource = result.members.find((m) => m.isCurrentUser) ?? null;
        const rootMember: StageMember | null = rootSource
          ? {
              id: rootSource.id,
              username: rootSource.username,
              legs: 0,
              status: rootSource.status === 'ACTIVE' ? 'active' : 'inactive',
              stage,
              rank: rootSource.rank || undefined,
              stageLabel: rootSource.stageLabel || undefined,
            }
          : null;

        // Map FlowStageMember[] → StageMember[] for existing buildStageTree()
        const members: StageMember[] = result.members
          .filter((m) => !m.isCurrentUser)
          .map((m) => ({
            id: m.id,
            username: m.username,
            legs: 0, // flow endpoint doesn't return legs
            status: m.status === 'ACTIVE' ? 'active' : 'inactive',
            stage,
            rank: m.rank || undefined,
            stageLabel: m.stageLabel || undefined,
          }));
        this.stageMembers.set(members);
        this.stageTotalMembers.set(result.totalMembers);
        this.stageRoot.set(this.buildStageTreeFromUplines(stage, result.members));
        this.stageLoading.set(false);
      },
      error: () => {
        this.stageMembers.set([]);
        this.stageTotalMembers.set(0);
        this.stageRoot.set(this.buildEmptyStageRoot(stage));
        this.stageLoading.set(false);
      },
    });
  }

  private buildStageTreeFromUplines(stage: number, members: FlowStageMember[]): MatrixNode {
    if (!members.length) {
      return this.buildEmptyStageRoot(stage);
    }

    const rootSource =
      members.find((m) => m.isCurrentUser) ??
      members.find((m) => !m.uplineUsername) ??
      members[0];

    const nodes = new Map<string, MatrixNode>();
    for (const member of members) {
      const username = member.username?.trim();
      if (!username) continue;
      const status = member.status === 'ACTIVE' ? 'active' : 'inactive';
      nodes.set(username, {
        id: member.id,
        username,
        package: null,
        level: 0,
        status,
        rank: member.rank || undefined,
        stage: member.stageLabel || `Stage ${stage}`,
        children: [],
      });
    }

    const root = nodes.get(rootSource.username) ?? {
      id: rootSource.id,
      username: rootSource.username,
      package: null,
      level: 0,
      status: rootSource.status === 'ACTIVE' ? 'active' : 'inactive',
      rank: rootSource.rank || undefined,
      stage: rootSource.stageLabel || `Stage ${stage}`,
      children: [],
    };

    for (const member of members) {
      if (member.id === rootSource.id) continue;
      const childNode = nodes.get(member.username);
      if (!childNode) continue;
      const parentUsername = member.uplineUsername?.trim();
      const parentNode = parentUsername ? nodes.get(parentUsername) : undefined;
      const targetParent = parentNode ?? root;
      childNode.parentId = targetParent.id;
      targetParent.children = targetParent.children ?? [];
      targetParent.children.push(childNode);
    }

    this.assignStageLevels(root, 0);
    return root;
  }

  private assignStageLevels(node: MatrixNode, level: number): void {
    node.level = level;
    for (const child of node.children ?? []) {
      this.assignStageLevels(child, level + 1);
    }
  }

  getStageName(value: MatrixTabValue): string {
    const tab = this.stageTabs.find((t) => t.value === value);
    return tab ? tab.label : '';
  }

  private loadEntryData(): void {
    this.networkService.fetchMatrixFlow('entry').subscribe({
      next: (result) => {
        const rootSource = result.members.find((m) => m.isCurrentUser) ?? null;
        const rootMember: StageMember | null = rootSource
          ? {
              id: rootSource.id,
              username: rootSource.username,
              legs: 0,
              status: rootSource.status === 'ACTIVE' ? 'active' : 'inactive',
              stage: 0,
              rank: rootSource.rank || undefined,
              stageLabel: rootSource.stageLabel || undefined,
            }
          : null;

        const members: StageMember[] = result.members
          .filter((m) => !m.isCurrentUser)
          .map((m) => ({
            id: m.id,
            username: m.username,
            legs: 0,
            status: m.status === 'ACTIVE' ? 'active' : 'inactive',
            stage: 0,
            rank: m.rank || undefined,
            stageLabel: m.stageLabel || undefined,
          }));

        this.entryRoot.set(this.buildEntryTree(members, rootMember));
      },
      error: () => {
        this.entryRoot.set(this.buildEntryRoot());
      },
    });
  }

  // Navigate to a node (make it the new root)
  navigateToNode(node: MatrixNode) {
    if (!node || node.status === 'empty') {
      return; // Don't navigate to empty slots or invalid nodes
    }

    // Don't navigate if already at this node
    if (node.id === this.currentRootNode().id) {
      return;
    }

    this.mobileZoom.set(1.0);
    this.loadMatrixRoot(node.username, true);
  }

  // Navigate back to original root
  navigateBack() {
    if (this.navigationStack().length > 0) {
      const previousNode = this.navigationStack()[this.navigationStack().length - 1];
      this.navigationStack.update((stack) => stack.slice(0, -1));
      this.loadMatrixRoot(previousNode.username, false);
    } else {
      this.loadMatrixRoot(undefined, false);
    }
  }

  // Navigate to top (original root)
  navigateToTop() {
    this.navigationStack.set([]);
    this.loadMatrixRoot(undefined, false);
  }

  // Convert MatrixNode to PrimeNG TreeNode format
  private convertToTreeNode(matrixNode: MatrixNode): TreeNode {
    const treeNode: TreeNode = {
      label: '', // We'll use template for display
      expanded: true, // Always expanded to show full tree
      data: matrixNode, // Store original MatrixNode for navigation
      children: matrixNode.children?.map((child) => this.convertToTreeNode(child)),
    };
    return treeNode;
  }

  // Handle node selection from OrganizationChart
  onNodeSelect(event: any) {
    if (this.activeTab() !== 'entry') return;
    if (!event || !event.node) {
      return;
    }

    const treeNode = event.node;
    const matrixNode: MatrixNode = treeNode.data;

    // Don't navigate if node data is missing, empty slot, or already root
    if (
      !matrixNode ||
      matrixNode.status === 'empty' ||
      matrixNode.id === this.currentRootNode().id
    ) {
      return;
    }

    this.navigateToNode(matrixNode);
  }

  // Handle direct node click from template (more reliable than onNodeSelect)
  handleNodeClick(matrixNode: MatrixNode) {
    if (this.activeTab() !== 'entry') return;
    // Don't navigate if it's empty or already root
    if (
      !matrixNode ||
      matrixNode.status === 'empty' ||
      matrixNode.id === this.currentRootNode().id
    ) {
      return;
    }

    this.navigateToNode(matrixNode);
  }

  onNodeClick(node: MatrixNode) {
    if (this.activeTab() !== 'entry') return;
    // Don't navigate if it's the current root or empty slot
    if (node.status === 'empty' || node.id === this.currentRootNode().id) {
      return;
    }

    this.navigateToNode(node);
  }

  onListNodeClick(flatNode: FlatNode) {
    if (this.activeTab() !== 'entry') return;
    // Don't navigate if it's empty or the current root
    if (flatNode.status === 'empty' || flatNode.id === this.currentRootNode().id) {
      return;
    }

    // Find the original node in the tree
    const node = this.networkService.findNode(flatNode.id);
    if (node) {
      this.navigateToNode(node);
    }
  }

  isRootNode(nodeId: string): boolean {
    return nodeId === this.currentRootNode().id;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-600';
      case 'inactive':
        return 'bg-gray-100 text-gray-500';
      case 'empty':
        return 'bg-blue-50 text-blue-500';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  }

  getPackageLabel(pkg: string | null): string {
    if (!pkg || pkg === '—') return '—';
    return pkg.charAt(0) + pkg.slice(1).toLowerCase();
  }

  getPackageBadgeClass(pkg: string | null): string {
    if (!pkg) return 'bg-gray-100 text-gray-400';
    switch (pkg.toUpperCase()) {
      case 'DIAMOND':
        return 'bg-sky-50 text-sky-600';
      case 'RUBY':
        return 'bg-rose-50 text-rose-600';
      case 'PLATINUM':
        return 'bg-violet-50 text-violet-600';
      case 'GOLD':
        return 'bg-amber-50 text-amber-600';
      case 'SILVER':
        return 'bg-slate-100 text-slate-600';
      case 'NICKEL':
        return 'bg-stone-100 text-stone-500';
      default:
        return 'bg-gray-100 text-gray-500';
    }
  }

  // Helper methods for node rendering
  getPackageInitial(pkg: string | null): string {
    if (!pkg || pkg === '—') return '';
    return pkg.charAt(0).toUpperCase();
  }

  getPackageBgClass(pkg: string | null): string {
    if (!pkg) return 'bg-gray-200 text-gray-500';
    switch (pkg.toUpperCase()) {
      case 'DIAMOND':
        return 'bg-sky-500 text-white';
      case 'RUBY':
        return 'bg-rose-500 text-white';
      case 'PLATINUM':
        return 'bg-violet-500 text-white';
      case 'GOLD':
        return 'bg-amber-400 text-white';
      case 'SILVER':
        return 'bg-slate-400 text-white';
      case 'NICKEL':
        return 'bg-stone-400 text-white';
      default:
        return 'bg-gray-300 text-white';
    }
  }

  getTooltipText(node: MatrixNode): string {
    if (node.status === 'empty') {
      return 'Empty slot available for placement';
    }
    const pkg = this.getPackageLabel(node.package);
    const status = node.status.charAt(0).toUpperCase() + node.status.slice(1);
    const rank = node.rank ?? '—';
    const stage = node.stage ?? '';
    return `${node.username} | ${pkg} | ${rank}${stage ? ' | ' + stage : ''} | ${status}`;
  }

  onOpenSlotClick(node: MatrixNode): void {
    if (this.activeTab() !== 'entry') return;
    if (!node || node.status !== 'empty') {
      return;
    }

    const placementParentUsername = this.getPlacementParentUsernameFromEmptyNode(node);
    const focusNodeId = this.getFocusNodeIdFromEmptyNode(node);

    this.openCreateReferralDialog({
      placementParentUsername,
      focusNodeId,
    });
  }

  private getPlacementParentUsernameFromEmptyNode(node: MatrixNode): string | null {
    const parentId = node.parentId;
    if (
      !parentId ||
      parentId === 'root' ||
      parentId.startsWith('empty-') ||
      parentId.startsWith('e-')
    ) {
      return null;
    }
    const parentNode = this.networkService.findNode(parentId);
    return parentNode?.username ?? null;
  }

  private getFocusNodeIdFromEmptyNode(node: MatrixNode): string {
    const parentId = node.parentId;
    if (!parentId || parentId.startsWith('empty-') || parentId.startsWith('e-')) {
      return this.currentRootNode().id;
    }
    return parentId;
  }

  private restoreFocusedBranch(nodeId: string): void {
    if (nodeId === 'root') {
      this.navigationStack.set([]);
      this.currentRootNode.set(this.originalRoot());
      return;
    }

    const tryRestore = (attempt = 0) => {
      // Wait for the new network data to finish loading before attempting to find the node
      if (this.networkService.isLoading()) {
        if (attempt < 40) {
          window.setTimeout(() => tryRestore(attempt + 1), 100);
        }
        return;
      }

      const nextNode = this.networkService.findNode(nodeId);
      if (nextNode) {
        this.navigationStack.set([]);
        this.currentRootNode.set(nextNode);
        return;
      }

      if (attempt < 40) {
        window.setTimeout(() => tryRestore(attempt + 1), 100);
      }
    };

    tryRestore();
  }

  private requestAutoFit(): void {
    if (this.userAdjustedZoom || this.autoFitDone) return;
    if (typeof window === 'undefined') return;
    // Give PrimeNG time to render the updated tree before measuring
    window.setTimeout(() => this.autoFitZoom(), 50);
  }

  private autoFitZoom(): void {
    if (this.userAdjustedZoom || this.autoFitDone) return;

    const viewport = this.matrixViewport?.nativeElement;
    if (!viewport) return;

    // wait for DOM render
    requestAnimationFrame(() => {
      const chartElement = viewport.querySelector('.p-organizationchart') as HTMLElement;

      if (!chartElement) return;

      const viewportRect = viewport.getBoundingClientRect();

      const treeWidth = chartElement.scrollWidth;
      const treeHeight = chartElement.scrollHeight;

      if (!treeWidth || !treeHeight) return;

      // Capture natural chart dimensions so we can size the scaled wrapper box.
      this.chartNaturalWidth.set(treeWidth);
      this.chartNaturalHeight.set(treeHeight);

      // Padding buffer — none on mobile so the tree uses the full viewport.
      const isMobileViewport = viewportRect.width < 640;
      const horizontalPadding = isMobileViewport ? 8 : 120;
      const verticalPadding = isMobileViewport ? 8 : 80;

      const scaleX = (viewportRect.width - horizontalPadding) / treeWidth;
      const scaleY = (viewportRect.height - verticalPadding) / treeHeight;

      const scale = Math.min(scaleX, scaleY, 1);

      // On mobile we MUST fit fully — no minimum floor.
      // On desktop keep a readable floor.
      const finalScale = isMobileViewport ? scale : Math.max(scale, 0.35);

      this.zoomLevel.set(finalScale);

      // Center scroll position (desktop only — mobile viewport has overflow:hidden).
      if (!isMobileViewport) {
        setTimeout(() => {
          const scaledWidth = treeWidth * finalScale;
          const scaledHeight = treeHeight * finalScale;
          viewport.scrollLeft = (scaledWidth - viewport.clientWidth) / 2;
          viewport.scrollTop = (scaledHeight - viewport.clientHeight) / 2;
        });
      }

      this.autoFitDone = true;
    });
  }

  private getTreeMetrics(root: MatrixNode): { levels: number; maxNodes: number } {
    const levelCounts = new Map<number, number>();
    const queue: Array<{ node: MatrixNode; level: number }> = [{ node: root, level: 0 }];
    let maxLevel = 0;

    while (queue.length) {
      const item = queue.shift();
      if (!item) break;
      maxLevel = Math.max(maxLevel, item.level);
      levelCounts.set(item.level, (levelCounts.get(item.level) ?? 0) + 1);

      for (const child of item.node.children ?? []) {
        queue.push({ node: child, level: item.level + 1 });
      }
    }

    let maxNodes = 1;
    for (const count of levelCounts.values()) {
      maxNodes = Math.max(maxNodes, count);
    }

    return { levels: maxLevel + 1, maxNodes };
  }

  isCurrentRoot(nodeId: string): boolean {
    return nodeId === this.currentRootNode().id;
  }

  openNodeDetails(node: MatrixNode): void {
    if (!node || node.status === 'empty') return;
    this.nodeForModal.set(node);
  }

  openDetailsForFlat(flatNode: FlatNode): void {
    if (flatNode.status === 'empty') return;
    const node = this.networkService.findNode(flatNode.id);
    if (node) this.nodeForModal.set(node);
  }

  closeNodeDetails(): void {
    this.nodeForModal.set(null);
  }

  onDialogVisibleChange(visible: boolean): void {
    if (!visible) this.closeNodeDetails();
  }

  getStageStatusLabel(status: 'active' | 'inactive'): string {
    return status === 'active' ? 'ACTIVE' : 'INACTIVE';
  }

  formatLegs(count: number): string {
    const safeCount = Number.isFinite(count) ? count : 0;
    return `${safeCount} leg${safeCount === 1 ? '' : 's'}`;
  }

  getCompactStageLabel(stage?: string | null): string {
    if (!stage) return '';
    return stage
      .replace(/stage/gi, 'St.')
      .replace(/level/gi, 'Lvl')
      .replace(/\s*,\s*/g, ', ')
      .trim();
  }

  private getStageKey(node: MatrixNode): string | number {
    const tab = this.activeTab();
    if (tab !== 'entry') return tab as number;

    if (node.stage) {
      const match = node.stage.match(/\d+/);
      if (match) return parseInt(match[0], 10);
    }
    return 'entry';
  }

  getNodeAccent(node: MatrixNode): string {
    const colors = this.STAGE_COLORS[this.getStageKey(node)];
    return colors?.accent ?? '#2d7a3a';
  }

  getNodeBorderColor(node: MatrixNode): string {
    const colors = this.STAGE_COLORS[this.getStageKey(node)];
    return colors?.border ?? '#2d7a3a';
  }

  getAvatarColor(node: MatrixNode): string {
    const colors = this.STAGE_COLORS[this.getStageKey(node)];
    return colors?.avatar ?? '#1f5a2a';
  }

  getNodeBg(_node: MatrixNode): string {
    return '#ffffff';
  }

  getNodeAccentText(node: MatrixNode): string {
    const colors = this.STAGE_COLORS[this.getStageKey(node)];
    return colors?.text ?? '#1f5a2a';
  }

  private buildStageTree(
    stage: number,
    members: StageMember[],
    rootMember?: StageMember | null,
  ): MatrixNode {
    const root: MatrixNode = {
      id: rootMember?.id ?? `stage-${stage}-you`,
      username: rootMember?.username ?? 'You',
      package: null,
      level: 0,
      status: rootMember?.status ?? 'active',
      rank: rootMember?.rank,
      stage: rootMember?.stageLabel ?? `Stage ${stage}`,
      children: [],
    };

    const filteredMembers = members
      .filter((member) => member.id !== root.id)
      .slice(0, 12);

    const levelOneNodes: MatrixNode[] = [];
    let cursor = 0;
    for (let i = 0; i < 3; i += 1) {
      const member = filteredMembers[cursor];
      if (!member) break;
      levelOneNodes.push({
        id: member.id,
        username: member.username,
        package: null,
        level: 1,
        status: member.status === 'active' ? 'active' : 'inactive',
        rank: member.rank,
        stage: member.stageLabel ?? `Stage ${stage}`,
        parentId: root.id,
        position: this.getStagePositionByIndex(i),
        children: [],
      });
      cursor += 1;
    }

    for (let parentIndex = 0; parentIndex < levelOneNodes.length; parentIndex += 1) {
      const parent = levelOneNodes[parentIndex];
      parent.children = [];
      for (let childIndex = 0; childIndex < 3; childIndex += 1) {
        const member = filteredMembers[cursor];
        if (!member) break;
        parent.children.push({
          id: member.id,
          username: member.username,
          package: null,
          level: 2,
          status: member.status === 'active' ? 'active' : 'inactive',
          rank: member.rank,
          stage: member.stageLabel ?? `Stage ${stage}`,
          parentId: parent.id,
          position: this.getStagePositionByIndex(childIndex),
          children: [],
        });
        cursor += 1;
      }
    }

    root.children = levelOneNodes;
    this.fillStageEmptySlots(root, 2, stage);
    return root;
  }

  private buildEntryTree(members: StageMember[], rootMember?: StageMember | null): MatrixNode {
    const rootStage = rootMember?.stageLabel ?? 'Entry level';
    const root: MatrixNode = {
      id: rootMember?.id ?? 'entry-root',
      username: rootMember?.username ?? 'You',
      package: null,
      level: 0,
      status: rootMember?.status ?? 'active',
      rank: rootMember?.rank,
      stage: rootStage,
      children: [],
    };

    const filteredMembers = members
      .filter((member) => member.id !== root.id)
      .slice(0, 3);

    root.children = filteredMembers.map((member, index) => ({
      id: member.id,
      username: member.username,
      package: null,
      level: 1,
      status: member.status === 'active' ? 'active' : 'inactive',
      rank: member.rank,
      stage: member.stageLabel ?? rootStage,
      parentId: root.id,
      position: this.getStagePositionByIndex(index),
      children: [],
    }));
    this.fillStageEmptySlots(root, 2, 0);
    return root;
  }

  private getTreeDepth(root: MatrixNode): number {
    let maxDepth = 0;
    const queue: Array<{ node: MatrixNode; depth: number }> = [{ node: root, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      maxDepth = Math.max(maxDepth, current.depth);
      for (const child of current.node.children ?? []) {
        queue.push({ node: child, depth: current.depth + 1 });
      }
    }
    return Math.max(1, maxDepth);
  }

  private fillStageEmptySlots(root: MatrixNode, maxDepth: number, stage: number): void {
    const queue: Array<{ node: MatrixNode; depth: number }> = [{ node: root, depth: 0 }];
    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      const { node, depth } = current;
      const children = node.children ?? [];
      if (depth < maxDepth) {
        while (children.length < 3) {
          const emptyIndex = children.length;
          children.push({
            id: `stage-${stage}-empty-${node.id}-${emptyIndex}`,
            username: 'Empty Slot',
            package: null,
            level: depth + 1,
            status: 'empty',
            stage: `Stage ${stage}`,
            parentId: node.id,
            position: this.getStagePositionByIndex(emptyIndex),
            children: [],
          });
        }
        node.children = children;
      }

      for (const child of children) {
        if (child.status !== 'empty') {
          queue.push({ node: child, depth: depth + 1 });
        }
      }
    }
  }

  private buildEmptyStageRoot(stage: number): MatrixNode {
    const root: MatrixNode = {
      id: `stage-root-${stage}`,
      username: `Stage ${stage}`,
      package: null,
      level: 0,
      status: 'active',
      stage: `Stage ${stage}`,
      children: [],
    };
    this.fillStageEmptySlots(root, 2, stage);
    return root;
  }

  private buildEntryRoot(): MatrixNode {
    const root: MatrixNode = {
      id: 'entry-root',
      username: 'You',
      package: null,
      level: 0,
      status: 'active',
      stage: 'Entry',
      children: [],
    };
    this.fillStageEmptySlots(root, 2, 0);
    return root;
  }

  private getStagePositionByIndex(index: number): 'left' | 'center' | 'right' {
    if (index === 0) return 'left';
    if (index === 1) return 'center';
    return 'right';
  }

  private loadMatrixRoot(username?: string, pushStack = false): void {
    if (pushStack) {
      const currentRoot = this.currentRootNode();
      if (currentRoot.id) {
        this.navigationStack.update((stack) => [...stack, currentRoot]);
      }
    }

    this.networkService.fetchMatrixTree(username).subscribe((tree) => {
      this.currentRootNode.set(tree);
      this.autoFitDone = false;
      this.requestAutoFit();
    });
  }
}
