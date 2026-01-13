import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipModule } from 'primeng/tooltip';
import { MatrixNode } from '../../services/network.service';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  templateUrl: './tree-node.component.html',
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: MatrixNode;
  @Input() isRoot: boolean = false; // Flag to indicate if this is the current root node
  @Output() nodeClick = new EventEmitter<MatrixNode>();

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

  getPackageLabel(pkg: string | null): string {
    if (!pkg) return 'None';
    switch (pkg) {
      case 'vip': return 'Gold';
      case 'premium': return 'Premium';
      case 'basic': return 'Silver';
      default: return pkg;
    }
  }

  getTooltipText(): string {
    if (this.node.status === 'empty') {
      return 'Empty slot available for placement';
    }
    const pkg = this.getPackageLabel(this.node.package);
    const status = this.node.status.charAt(0).toUpperCase() + this.node.status.slice(1);
    return `${this.node.username} | ${pkg} | Level ${this.node.level} | ${status}`;
  }

  onNodeClick() {
    // Don't emit click for empty slots or root node
    if (this.node.status === 'empty' || this.isRoot) {
      return;
    }
    this.nodeClick.emit(this.node);
  }

  hasOnlyEmptyChildren(): boolean {
    return this.node.children?.every(c => c.status === 'empty') ?? false;
  }

  getPreviousChild(child: MatrixNode): MatrixNode | null {
    if (!this.node.children) return null;
    const index = this.node.children.findIndex(c => c.id === child.id);
    if (index > 0) {
      return this.node.children[index - 1];
    }
    return null;
  }
}
