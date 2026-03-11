import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { A2UIRendererComponent } from './a2ui-renderer.component';
import { SurfaceState, UserAction } from '../../models/a2ui.models';

function makeSurface(components: Record<string, unknown>, root: string): SurfaceState {
  const componentMap = new Map<string, unknown>();
  for (const [id, comp] of Object.entries(components)) {
    componentMap.set(id, comp);
  }
  return {
    surfaceId: 'main',
    rootComponentId: root,
    componentMap: componentMap as Map<string, never>,
    dataModel: {},
  };
}

@Component({
  standalone: true,
  imports: [A2UIRendererComponent],
  template: `
    <app-a2ui-renderer
      [componentId]="componentId"
      [surface]="surface"
      (actionTriggered)="onAction($event)"
    />
  `,
})
class TestHostComponent {
  componentId = 'root';
  surface!: SurfaceState;
  lastAction: UserAction | null = null;
  onAction(action: UserAction) { this.lastAction = action; }
}

describe('A2UIRendererComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
  });

  it('renders a Card containing a Text child', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.surface = makeSurface({
      'root': { type: 'Card', child: 'txt-1' },
      'txt-1': { type: 'Text', text: { literalString: 'Hello A2UI' }, usageHint: 'body' },
    }, 'root');
    fixture.detectChanges();
    const text = fixture.debugElement.query(By.css('p'));
    expect(text.nativeElement.textContent.trim()).toBe('Hello A2UI');
  });

  it('silently skips unknown component types (security)', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.surface = makeSurface({
      'root': { type: 'Script', html: '<script>alert(1)</script>' },
    }, 'root');
    fixture.detectChanges();
    const scripts = fixture.debugElement.nativeElement.querySelectorAll('script');
    expect(scripts.length).toBe(0);
  });

  it('emits UserAction with correct name and context on Button click', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.surface = makeSurface({
      'root': {
        type: 'Button',
        primary: true,
        child: 'lbl',
        action: { name: 'book_hotel', context: [{ key: 'hotelId', value: { literalString: 'H1' } }] },
      },
      'lbl': { type: 'Text', text: { literalString: 'Book' } },
    }, 'root');
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();
    expect(fixture.componentInstance.lastAction?.name).toBe('book_hotel');
    expect(fixture.componentInstance.lastAction?.context?.['hotelId']).toBe('H1');
  });

  it('resolves Text content from dataModel via path binding', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    const surface = makeSurface({
      'root': { type: 'Text', text: { path: '/hotel/name' }, usageHint: 'h3' },
    }, 'root');
    surface.dataModel = { hotel: { name: 'Le Meurice' } };
    fixture.componentInstance.surface = surface;
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('h3'));
    expect(el.nativeElement.textContent.trim()).toBe('Le Meurice');
  });

  it('falls back to literalString when path resolves to nothing', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.surface = makeSurface({
      'root': { type: 'Text', text: { path: '/missing/key', literalString: 'Default Text' }, usageHint: 'body' },
    }, 'root');
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('p'));
    expect(el.nativeElement.textContent.trim()).toBe('Default Text');
  });
});
