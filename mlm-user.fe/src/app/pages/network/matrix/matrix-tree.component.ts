import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService, MatrixNode } from '../../../services/network.service';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { TreeNode } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

interface FlatNode {
  id: string;
  username: string;
  package: 'basic' | 'premium' | 'vip' | null;
  level: number;
  status: 'active' | 'inactive' | 'empty';
  position?: 'left' | 'center' | 'right';
}

@Component({
  selector: 'app-matrix-tree',
  standalone: true,
  imports: [CommonModule, OrganizationChartModule, DialogModule, TableModule, ButtonModule, TooltipModule],
  templateUrl: './matrix-tree.component.html'
})
export class MatrixTreeComponent {
  private networkService = inject(NetworkService);
  private originalRoot = this.networkService.matrixTree();
  
  // Navigation state
  currentRootNode = signal<MatrixNode>(this.originalRoot);
  navigationStack = signal<MatrixNode[]>([]);
  nodeForModal = signal<MatrixNode | null>(null);
  
  /** Default zoom &lt; 1 so the full tree fits in view on load; user can zoom in from here. */
  zoomLevel = signal(0.5);

  // Computed: check if viewing original root
  isRootView = computed(() => {
    return this.currentRootNode().id === this.originalRoot.id;
  });

  // Computed: current matrix tree (from currentRootNode) converted to PrimeNG TreeNode format
  matrixTree = computed(() => {
    const root = this.currentRootNode();
    // Create a new root node with level 0 to display properly
    const adjustedRoot: MatrixNode = {
      ...root,
      level: 0,
      username: root.username === 'You' ? 'You' : root.username
    };
    // Convert to TreeNode array (OrganizationChart expects an array)
    return [this.convertToTreeNode(adjustedRoot)];
  });

  // Flattened list for mobile view
  flattenedNodes = computed(() => {
    const nodes: FlatNode[] = [];
    const root = this.currentRootNode();
    const adjustedRoot: MatrixNode = {
      ...root,
      level: 0,
      username: root.username === 'You' ? 'You' : root.username
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
      position: node.position
    });
    
    if (node.children) {
      for (const child of node.children) {
        this.flattenTree(child, result);
      }
    }
  }

  zoomIn() {
    this.zoomLevel.update(z => Math.min(z + 0.2, 2));
  }

  zoomOut() {
    this.zoomLevel.update(z => Math.max(z - 0.2, 0.4));
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
    
    // Add current root to navigation stack (only if different)
    const currentRoot = this.currentRootNode();
    if (currentRoot.id !== node.id) {
      this.navigationStack.update(stack => [...stack, currentRoot]);
    }
    
    // Find the full node structure from original tree
    // This ensures we get the complete node with all its children
    const fullNode = this.networkService.findNode(node.id);
    if (fullNode) {
      // Set as new root - the level will be adjusted to 0 in matrixTree computed
      this.currentRootNode.set(fullNode);
    } else {
      console.warn(`Node with id ${node.id} not found in tree structure`);
    }
  }

  // Navigate back to original root
  navigateBack() {
    if (this.navigationStack().length > 0) {
      const previousNode = this.navigationStack()[this.navigationStack().length - 1];
      this.navigationStack.update(stack => stack.slice(0, -1));
      this.currentRootNode.set(previousNode);
    } else {
      this.currentRootNode.set(this.originalRoot);
    }
  }

  // Navigate to top (original root)
  navigateToTop() {
    this.navigationStack.set([]);
    this.currentRootNode.set(this.originalRoot);
  }

  // Convert MatrixNode to PrimeNG TreeNode format
  private convertToTreeNode(matrixNode: MatrixNode): TreeNode {
    const treeNode: TreeNode = {
      label: '', // We'll use template for display
      expanded: true, // Always expanded to show full tree
      data: matrixNode, // Store original MatrixNode for navigation
      children: matrixNode.children?.map(child => this.convertToTreeNode(child))
    };
    return treeNode;
  }

  // Handle node selection from OrganizationChart
  onNodeSelect(event: any) {
    if (!event || !event.node) {
      return;
    }
    
    const treeNode = event.node;
    const matrixNode: MatrixNode = treeNode.data;
    
    // Don't navigate if node data is missing, empty slot, or already root
    if (!matrixNode || matrixNode.status === 'empty' || matrixNode.id === this.currentRootNode().id) {
      return;
    }
    
    this.navigateToNode(matrixNode);
  }

  // Handle direct node click from template (more reliable than onNodeSelect)
  handleNodeClick(matrixNode: MatrixNode) {
    // Don't navigate if it's empty or already root
    if (!matrixNode || matrixNode.status === 'empty' || matrixNode.id === this.currentRootNode().id) {
      return;
    }
    
    this.navigateToNode(matrixNode);
  }

  onNodeClick(node: MatrixNode) {
    // Don't navigate if it's the current root or empty slot
    if (node.status === 'empty' || node.id === this.currentRootNode().id) {
      return;
    }
    
    this.navigateToNode(node);
  }

  onListNodeClick(flatNode: FlatNode) {
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
      case 'active': return 'bg-emerald-50 text-emerald-600';
      case 'inactive': return 'bg-gray-100 text-gray-500';
      case 'empty': return 'bg-blue-50 text-blue-500';
      default: return 'bg-gray-100 text-gray-500';
    }
  }

  getPackageLabel(pkg: string | null): string {
    if (!pkg) return '—';
    switch (pkg) {
      case 'vip': return 'Gold';
      case 'premium': return 'Premium';
      case 'basic': return 'Silver';
      default: return pkg;
    }
  }

  getPackageBadgeClass(pkg: string | null): string {
    if (!pkg) return 'bg-gray-100 text-gray-400';
    switch (pkg) {
      case 'vip': return 'bg-amber-50 text-amber-600';
      case 'premium': return 'bg-violet-50 text-violet-600';
      case 'basic': return 'bg-slate-100 text-slate-600';
      default: return 'bg-gray-100 text-gray-500';
    }
  }

  // Helper methods for node rendering (from TreeNodeComponent)
  getPackageInitial(pkg: string | null): string {
    if (!pkg) return '';
    switch (pkg) {
      case 'vip': return 'G';
      case 'premium': return 'P';
      case 'basic': return 'S';
      default: return pkg.charAt(0).toUpperCase();
    }
  }

  getPackageBgClass(pkg: string | null): string {
    if (!pkg) return 'bg-gray-200 text-gray-500';
    switch (pkg) {
      case 'vip': return 'bg-amber-400 text-white';
      case 'premium': return 'bg-violet-500 text-white';
      case 'basic': return 'bg-slate-400 text-white';
      default: return 'bg-gray-300 text-white';
    }
  }

  getTooltipText(node: MatrixNode): string {
    if (node.status === 'empty') {
      return 'Empty slot available for placement';
    }
    const pkg = this.getPackageLabel(node.package);
    const status = node.status.charAt(0).toUpperCase() + node.status.slice(1);
    return `${node.username} | ${pkg} | Level ${node.level} | ${status}`;
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
}
