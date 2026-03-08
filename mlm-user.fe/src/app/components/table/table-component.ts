import { Component, ContentChild, Input, TemplateRef, ViewChild } from '@angular/core';
import { TableModule, Table } from 'primeng/table';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ui-table',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './table-component.html',
})
export class UiTableComponent {
  @Input() value: any[] = [];
  @Input() headers: string[] = [];
  @Input() rows = 10;
  @Input() loading = false;
  @Input() rowsPerPageOptions = [10, 20, 50];

  @ContentChild('rowTemplate') rowTemplate!: TemplateRef<any>;
  @ContentChild('emptyTemplate') emptyTemplate?: TemplateRef<any>;
  @ViewChild(Table) private table!: Table;

  exportCSV(): void {
    this.table.exportCSV();
  }
}
