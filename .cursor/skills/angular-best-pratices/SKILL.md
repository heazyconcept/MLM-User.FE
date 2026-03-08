---
name: Angular Control Flow Migration
description: Convert legacy Angular structural directives (*ngIf, *ngFor) to new control flow syntax (@if, @for)
---

# Angular Control Flow Migration Skill

This skill helps migrate Angular templates from the legacy structural directive syntax (`*ngIf`, `*ngFor`, `*ngSwitch`) to Angular's new built-in control flow syntax (`@if`, `@for`, `@switch`).

## When to Use This Skill

Use this skill when:
- You encounter Angular templates using `*ngIf`, `*ngFor`, or `*ngSwitch`
- The project is using Angular 17+ (which supports the new control flow syntax)
- You want to modernize the codebase for better performance and readability

## Migration Rules

### Converting `*ngIf` to `@if`

**Before:**
```html
<div *ngIf="condition">Content</div>
<div *ngIf="condition; else elseBlock">Content</div>
<ng-template #elseBlock>Else content</ng-template>
```

**After:**
```html
@if (condition) {
  <div>Content</div>
}

@if (condition) {
  <div>Content</div>
} @else {
  <div>Else content</div>
}
```

**With `as` syntax (aliasing):**
```html
<!-- Before -->
<div *ngIf="user$ | async as user">{{ user.name }}</div>

<!-- After -->
@if (user$ | async; as user) {
  <div>{{ user.name }}</div>
}
```

---

### Converting `*ngFor` to `@for`

**Before:**
```html
<div *ngFor="let item of items">{{ item }}</div>
<div *ngFor="let item of items; let i = index; let first = first; let last = last; trackBy: trackByFn">
  {{ i }}: {{ item }}
</div>
```

**After:**
```html
@for (item of items; track item) {
  <div>{{ item }}</div>
}

@for (item of items; track item.id; let i = $index, first = $first, last = $last) {
  <div>{{ i }}: {{ item }}</div>
}
```

**Important Notes for `@for`:**
1. **`track` is required** - You must specify what to track:
   - `track item` - for primitive values
   - `track item.id` - for objects with unique identifiers
   - `track $index` - fallback when no unique identifier exists

2. **Implicit variables changed:**
   - `index` → `$index`
   - `first` → `$first`
   - `last` → `$last`
   - `even` → `$even`
   - `odd` → `$odd`
   - `count` → `$count`

3. **Empty block (optional):**
```html
@for (item of items; track item) {
  <div>{{ item }}</div>
} @empty {
  <div>No items found</div>
}
```

---

### Converting `*ngSwitch` to `@switch`

**Before:**
```html
<div [ngSwitch]="value">
  <span *ngSwitchCase="'A'">Case A</span>
  <span *ngSwitchCase="'B'">Case B</span>
  <span *ngSwitchDefault>Default case</span>
</div>
```

**After:**
```html
@switch (value) {
  @case ('A') {
    <span>Case A</span>
  }
  @case ('B') {
    <span>Case B</span>
  }
  @default {
    <span>Default case</span>
  }
}
```

---

## Step-by-Step Migration Process

1. **Find all files with legacy directives:**
   ```
   Search for: *ngIf, *ngFor, *ngSwitch in .html files
   ```

2. **For each file, apply transformations:**
   - Replace `*ngIf` with `@if` blocks
   - Replace `*ngFor` with `@for` blocks (remember to add `track`)
   - Replace `*ngSwitch`/`*ngSwitchCase`/`*ngSwitchDefault` with `@switch`/@case`/`@default`

3. **Remove the directive from the element:**
   - Move the element inside the control flow block
   - Remove the `*ngIf`, `*ngFor`, or related attributes from the element

4. **Verify the changes:**
   - Run `ng serve` or `ng build` to check for compilation errors
   - Test the UI to ensure functionality is preserved

## Common Patterns

### Combining `*ngIf` and `*ngFor`
**Before:**
```html
<div *ngIf="items?.length">
  <div *ngFor="let item of items">{{ item }}</div>
</div>
```

**After:**
```html
@if (items?.length) {
  @for (item of items; track item) {
    <div>{{ item }}</div>
  }
}
```

### Using with `ng-container`
**Before:**
```html
<ng-container *ngIf="showContent">
  <div>Content 1</div>
  <div>Content 2</div>
</ng-container>
```

**After:**
```html
@if (showContent) {
  <div>Content 1</div>
  <div>Content 2</div>
}
```
Note: `ng-container` is no longer needed with the new syntax for grouping elements!

## Checklist for Migration

- [ ] Search and identify all `*ngIf` usages
- [ ] Search and identify all `*ngFor` usages  
- [ ] Search and identify all `*ngSwitch` usages
- [ ] Convert each directive to the new syntax
- [ ] Ensure all `@for` blocks have a `track` expression
- [ ] Update implicit variable names (`index` → `$index`, etc.)
- [ ] Remove unnecessary `ng-container` wrappers
- [ ] Verify the application builds successfully
- [ ] Test affected components in the browser
