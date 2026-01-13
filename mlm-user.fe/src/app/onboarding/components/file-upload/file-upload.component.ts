import { Component, input, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-onboarding-file-upload',
  imports: [CommonModule],
  template: `
    <div class="space-y-2">
      @if (label()) {
        <label class="block text-sm font-semibold text-slate-500 mb-2">{{ label() }}</label>
      }
      <div 
        (click)="fileInput.click()"
        (dragover)="$event.preventDefault(); isDragging.set(true)"
        (dragleave)="isDragging.set(false)"
        (drop)="onFileDrop($event)"
        [class]="isDragging() ? 'border-mlm-primary bg-mlm-primary/5' : 'border-slate-300 hover:border-mlm-primary/50 bg-slate-50'"
        class="relative w-full aspect-square md:aspect-video rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center cursor-pointer group overflow-hidden"
      >
        <input 
          #fileInput 
          type="file" 
          class="hidden" 
          [accept]="accept()" 
          (change)="onFileSelected($event)"
        />

        @if (previewUrl()) {
          <img [src]="previewUrl()" class="absolute inset-0 w-full h-full object-cover animate-fade-in" />
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
            <div class="flex flex-col items-center text-white">
              <i class="pi pi-camera text-2xl mb-2"></i>
              <span class="text-xs font-semibold">Change Photo</span>
            </div>
          </div>
        } @else {
          <div class="flex flex-col items-center text-slate-400 group-hover:text-mlm-primary transition-colors">
            <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-mlm-primary/10 transition-colors">
              <i [class]="'pi ' + icon() + ' text-xl'"></i>
            </div>
            <span class="text-sm font-semibold">{{ placeholder() }}</span>
            <span class="text-[11px] mt-1">PDF, JPG, PNG up to 5MB</span>
          </div>
        }
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

