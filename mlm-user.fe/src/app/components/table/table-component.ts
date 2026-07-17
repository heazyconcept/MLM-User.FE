import { Component, ContentChild, Input, TemplateRef, ViewChild } from '@angular/core';
import { TableModule, Table } from 'primeng/table';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ui-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './table-component.html',
  styles: [
    `
      :host ::ng-deep .ui-clean-table.p-datatable .p-datatable-thead > tr > th {
        padding: 0.875rem 1.25rem;
        background-color: var(--color-mlm-background, #f9fafb);
        border-bottom: 1px solid var(--color-mlm-warm-200, #e7e5e4);
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-mlm-warm-600, #57534e);
        white-space: nowrap;
      }

      :host ::ng-deep .ui-clean-table.p-datatable .p-datatable-tbody > tr > td {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid var(--color-mlm-warm-100, #f5f5f4);
        vertical-align: top;
      }

      :host ::ng-deep .ui-clean-table.p-datatable .p-datatable-tbody > tr {
        transition: background-color 0.2s ease;
      }

      :host ::ng-deep .ui-clean-table.p-datatable .p-datatable-tbody > tr:hover {
        background-color: color-mix(in srgb, var(--color-mlm-background, #f9fafb) 70%, white);
      }

      :host ::ng-deep .ui-clean-table.p-datatable .p-paginator {
        border-top: 1px solid var(--color-mlm-warm-200, #e7e5e4);
        padding: 0.75rem 1.25rem;
      }

      /*
       * Stacked (card) layout on mobile. PrimeNG no longer adds a
       * "p-datatable-stack" class — it injects its own id-scoped media query —
       * so we mark stacked tables with our own "ui-table-stack" class.
       * !important is needed to beat PrimeNG's injected id-scoped rules and
       * the inline min-width used for desktop horizontal scrolling.
       */
      @media (max-width: 1024px) {
        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-table {
          border-collapse: separate;
          border-spacing: 0 0.75rem;
          min-width: 0 !important;
          width: 100%;
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-table-container {
          overflow-x: hidden;
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr {
          display: block;
          background: white;
          border: 1px solid var(--color-mlm-warm-200, #e7e5e4);
          border-radius: 1rem;
          overflow: hidden;
          box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr > td {
          display: flex;
          align-items: flex-start !important;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-mlm-warm-100, #f5f5f4) !important;
          text-align: right;
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr > td:last-child {
          border-bottom: none !important;
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr > td::before {
          content: attr(data-label);
          flex: 0 0 38%;
          max-width: 38%;
          text-align: left;
          font-size: 0.6875rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-mlm-warm-500, #78716c);
          padding-top: 0.125rem;
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr > td > * {
          flex: 1;
          min-width: 0;
        }

        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr > td .cell-value {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
          margin-left: auto;
        }

        /* Empty/message rows span all columns and must not become flex rows. */
        :host ::ng-deep .ui-clean-table.ui-table-stack .p-datatable-tbody > tr > td[colspan] {
          display: block !important;
          text-align: center;
        }

        :host
          ::ng-deep
          .ui-clean-table.ui-table-stack
          .p-datatable-tbody
          > tr
          > td[colspan]::before {
          content: none;
        }
      }
    `,
  ],
})
export class UiTableComponent {
  @Input() value: unknown[] = [];
  @Input() headers: string[] = [];
  @Input() rows = 10;
  @Input() loading = false;
  @Input() paginator = true;
  @Input() rowsPerPageOptions = [10, 20, 50];
  @Input() responsiveLayout: 'scroll' | 'stack' = 'scroll';
  @Input() breakpoint = '960px';
  @Input() rowHover = true;
  @Input() tableStyle: Record<string, string> | null = null;

  @ContentChild('rowTemplate') rowTemplate!: TemplateRef<unknown>;
  @ContentChild('emptyTemplate') emptyTemplate?: TemplateRef<unknown>;
  @ViewChild(Table) private table!: Table;

  resolvedTableStyle(): Record<string, string> {
    if (this.tableStyle) return this.tableStyle;
    return this.responsiveLayout === 'scroll' ? { 'min-width': '50rem' } : { 'min-width': '100%' };
  }

  resolvedStyleClass(): string {
    return this.responsiveLayout === 'stack' ? 'ui-clean-table ui-table-stack' : 'ui-clean-table';
  }

  exportCSV(): void {
    this.table.exportCSV();
  }
}
