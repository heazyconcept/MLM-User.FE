import { Component, input, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-onboarding-file-upload',
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-[6px]">
      @if (label()) {
        <label class="text-[0.8rem] font-semibold text-slate-500 flex items-center gap-1">{{ label() }}</label>
      }
      <div
        (click)="fileInput.click()"
        (dragover)="$event.preventDefault(); isDragging.set(true)"
        (dragleave)="isDragging.set(false)"
        (drop)="onFileDrop($event)"
        [class]="isDragging() ? 'border-[#2d7a3a] bg-white' : 'border-[#ede9e3] bg-[#f9f8f6] hover:border-[#2d7a3a]/50'"
        class="flex items-center gap-[18px] p-[18px] border-[1.5px] rounded-xl cursor-pointer transition-[border-color,background,box-shadow] duration-200 hover:bg-white focus-within:border-[#2d7a3a] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(45,122,58,0.1)]"
      >
        <input
          #fileInput
          type="file"
          class="hidden"
          [accept]="accept()"
          (change)="onFileSelected($event)"
        />

        <!-- Avatar / preview -->
        <div class="w-[68px] h-[68px] rounded-2xl border-2 border-[#ede9e3] bg-[#ede9e3] flex items-center justify-center shrink-0 overflow-hidden">
          @if (previewUrl()) {
            <img [src]="previewUrl()" alt="" class="w-full h-full object-cover" />
          } @else {
            <i [class]="'pi ' + icon() + ' text-[26px] text-slate-400'"></i>
          }
        </div>

        <!-- Meta + button -->
        <div class="flex-1 min-w-0">
          <p class="text-[13.5px] font-bold text-slate-800 mb-0.5">{{ previewUrl() ? 'Profile Photo' : label() || 'Profile Photo' }}</p>
          <span class="text-[11.5px] text-slate-400 block mb-2.5">JPG, PNG or GIF — max 5MB</span>
          <button
            type="button"
            (click)="fileInput.click(); $event.stopPropagation()"
            class="inline-flex items-center gap-[7px] py-[7px] px-4 bg-white border-[1.5px] border-[#ede9e3] rounded-[10px] font-dm-sans text-[13px] font-semibold text-slate-600 cursor-pointer transition-all duration-200 hover:border-[#2d7a3a] hover:text-[#2d7a3a] hover:bg-[#e8f5ea]"
          >
            <i class="pi pi-paperclip text-sm"></i>
            {{ previewUrl() ? 'Change photo' : 'Choose photo' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class FileUploadComponent {
  label = input<string>();
  icon = input<string>('pi-cloud-upload');
  placeholder = input<string>('Click to upload');
  accept = input<string>('image/*');
  
  fileSelected = output<File>();
  
  previewUrl = signal<string | null>(null);
  isDragging = signal<boolean>(false);

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  private processFile(file: File) {
    this.fileSelected.emit(file);
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.previewUrl.set(e.target.result);
    };
    reader.readAsDataURL(file);
  }
}

