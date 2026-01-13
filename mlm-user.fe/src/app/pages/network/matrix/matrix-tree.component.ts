import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService, MatrixNode } from '../../../services/network.service';
import { TreeNodeComponent } from '../../../components/tree-node/tree-node.component';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

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
  imports: [CommonModule, TreeNodeComponent, DialogModule, TableModule, ButtonModule],
  templateUrl: './matrix-tree.component.html'
})
export class MatrixTreeComponent {
  private networkService = inject(NetworkService);
  private originalRoot = this.networkService.matrixTree();
  
  // Navigation state
  currentRootNode = signal<MatrixNode>(this.originalRoot);
  navigationStack = signal<MatrixNode[]>([]);
  
  zoomLevel = signal(1);

  // Computed: check if viewing original root
  isRootView = computed(() => {
    return this.currentRootNode().id === this.originalRoot.id;
  });

  // Computed: current matrix tree (from currentRootNode)
  matrixTree = computed(() => {
    const root = this.currentRootNode();
    // Create a new root node with level 0 to display properly
    return {
      ...root,
      level: 0,
      username: root.username === 'You' ? 'You' : root.username
    };
  });

  // Flattened list for mobile view
  flattenedNodes = computed(() => {
    const nodes: FlatNode[] = [];
    this.flattenTree(this.matrixTree(), nodes);
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
    if (node.status === 'empty') {
      return; // Don't navigate to empty slots
    }
    
    // Add current root to navigation stack
    this.navigationStack.update(stack => [...stack, this.currentRootNode()]);
    
    // Find the full node structure from original tree
    const fullNode = this.networkService.findNode(node.id);
    if (fullNode) {
      this.currentRootNode.set(fullNode);
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
}
