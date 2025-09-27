/**
 * Performance Profiler for Interface Redesign
 * Captures baseline metrics for current sidebar layout
 */

interface PerformanceMetrics {
  // Paint metrics
  fcp: number | null; // First Contentful Paint
  lcp: number | null; // Largest Contentful Paint

  // Layout metrics
  cls: number; // Cumulative Layout Shift
  chromePixels: number; // Pixels used by UI chrome
  contentPixels: number; // Pixels available for content
  viewportUtilization: number; // Percentage of viewport for content

  // Interaction metrics
  sidebarClickDelays: number[]; // Click response times
  averageInteractionDelay: number;
  maxInteractionDelay: number;

  // Navigation metrics
  navigationElements: NavigationElement[];
  totalClickableElements: number;
  averageClickDepth: number;
}

interface NavigationElement {
  selector: string;
  label: string;
  clickDepth: number;
  boundingBox: DOMRect;
  touchTargetSize: number;
}

export class PerformanceProfiler {
  private metrics: PerformanceMetrics = {
    fcp: null,
    lcp: null,
    cls: 0,
    chromePixels: 0,
    contentPixels: 0,
    viewportUtilization: 0,
    sidebarClickDelays: [],
    averageInteractionDelay: 0,
    maxInteractionDelay: 0,
    navigationElements: [],
    totalClickableElements: 0,
    averageClickDepth: 0,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers(): void {
    // Observe paint timing
    this.observePaintTiming();

    // Observe layout shifts
    this.observeLayoutShifts();

    // Measure viewport utilization
    this.measureViewportUsage();

    // Audit navigation elements
    this.auditNavigationElements();
  }

  private observePaintTiming(): void {
    if ('PerformanceObserver' in window) {
      // FCP Observer
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime;
          }
        }
      });

      try {
        fcpObserver.observe({ entryTypes: ['paint'] });
      } catch (e) {
        console.warn('Paint timing not supported');
      }

      // LCP Observer
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP not supported');
      }
    }
  }

  private observeLayoutShifts(): void {
    if ('PerformanceObserver' in window) {
      let clsValue = 0;
      let clsEntries: PerformanceEntry[] = [];

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only count shifts without recent input
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            clsEntries.push(entry);
          }
        }
        this.metrics.cls = clsValue;
      });

      try {
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        console.warn('Layout shift tracking not supported');
      }
    }
  }

  private measureViewportUsage(): void {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Find sidebar element
    const sidebar = document.querySelector('aside');
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');
    const mobileNav = document.querySelector('[class*="mobile"]');

    let chromeWidth = 0;
    let chromeHeight = 0;

    if (sidebar) {
      const rect = sidebar.getBoundingClientRect();
      chromeWidth += rect.width;
    }

    if (header) {
      const rect = header.getBoundingClientRect();
      chromeHeight += rect.height;
    }

    if (footer || mobileNav) {
      const rect = (footer || mobileNav)!.getBoundingClientRect();
      chromeHeight += rect.height;
    }

    const totalPixels = viewport.width * viewport.height;
    const chromePixels = (chromeWidth * viewport.height) + (chromeHeight * viewport.width);
    const contentPixels = totalPixels - chromePixels;

    this.metrics.chromePixels = chromePixels;
    this.metrics.contentPixels = contentPixels;
    this.metrics.viewportUtilization = (contentPixels / totalPixels) * 100;
  }

  private auditNavigationElements(): void {
    const elements: NavigationElement[] = [];

    // Find all clickable elements in navigation areas
    const selectors = [
      'aside a',
      'aside button',
      'header a',
      'header button',
      'footer a',
      'footer button',
      '[role="navigation"] a',
      '[role="navigation"] button',
    ];

    selectors.forEach(selector => {
      const nodeList = document.querySelectorAll(selector);
      nodeList.forEach(element => {
        const htmlElement = element as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();

        // Calculate click depth (how many containers deep)
        let depth = 0;
        let parent = htmlElement.parentElement;
        while (parent && parent !== document.body) {
          if (parent.tagName === 'NAV' || parent.tagName === 'ASIDE' || parent.tagName === 'HEADER') {
            depth++;
          }
          parent = parent.parentElement;
        }

        // Calculate touch target size
        const touchTargetSize = Math.min(rect.width, rect.height);

        elements.push({
          selector: this.getUniqueSelector(htmlElement),
          label: htmlElement.textContent?.trim() || htmlElement.getAttribute('aria-label') || '',
          clickDepth: depth,
          boundingBox: rect,
          touchTargetSize,
        });
      });
    });

    this.metrics.navigationElements = elements;
    this.metrics.totalClickableElements = elements.length;
    this.metrics.averageClickDepth = elements.length > 0
      ? elements.reduce((sum, el) => sum + el.clickDepth, 0) / elements.length
      : 0;
  }

  private getUniqueSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.className) {
        const classes = current.className.split(' ').filter(c => c).join('.');
        if (classes) selector += `.${classes}`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  }

  public measureInteractionDelay(element: HTMLElement): Promise<number> {
    return new Promise(resolve => {
      const startTime = performance.now();

      // Simulate click
      element.click();

      // Use requestAnimationFrame to measure when browser is ready to paint
      requestAnimationFrame(() => {
        const delay = performance.now() - startTime;
        this.metrics.sidebarClickDelays.push(delay);

        // Update averages
        const delays = this.metrics.sidebarClickDelays;
        this.metrics.averageInteractionDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
        this.metrics.maxInteractionDelay = Math.max(...delays);

        resolve(delay);
      });
    });
  }

  public getMetrics(): PerformanceMetrics {
    // Refresh viewport measurements
    this.measureViewportUsage();
    this.auditNavigationElements();

    return { ...this.metrics };
  }

  public generateReport(): string {
    const metrics = this.getMetrics();

    const report = `
# Performance Profile Report
Generated: ${new Date().toISOString()}

## Paint Metrics
- First Contentful Paint (FCP): ${metrics.fcp?.toFixed(2) || 'N/A'} ms
- Largest Contentful Paint (LCP): ${metrics.lcp?.toFixed(2) || 'N/A'} ms

## Layout Metrics
- Cumulative Layout Shift (CLS): ${metrics.cls.toFixed(4)}
- Chrome Pixels: ${metrics.chromePixels.toLocaleString()} px
- Content Pixels: ${metrics.contentPixels.toLocaleString()} px
- Viewport Utilization: ${metrics.viewportUtilization.toFixed(1)}% for content

## Navigation Audit
- Total Clickable Elements: ${metrics.totalClickableElements}
- Average Click Depth: ${metrics.averageClickDepth.toFixed(1)} levels
- Navigation Elements:
${metrics.navigationElements.slice(0, 10).map(el =>
  `  - ${el.label || 'Unnamed'} (${el.touchTargetSize.toFixed(0)}px touch target)`
).join('\n')}

## Interaction Performance
- Measured Interactions: ${metrics.sidebarClickDelays.length}
- Average Delay: ${metrics.averageInteractionDelay.toFixed(2)} ms
- Max Delay: ${metrics.maxInteractionDelay.toFixed(2)} ms

## Viewport Breakdown (${window.innerWidth}x${window.innerHeight})
- Sidebar Width: ${document.querySelector('aside')?.getBoundingClientRect().width || 0}px
- Header Height: ${document.querySelector('header')?.getBoundingClientRect().height || 0}px
- Footer Height: ${document.querySelector('footer')?.getBoundingClientRect().height || 0}px

## Recommendations
${metrics.viewportUtilization < 80 ? '⚠️ Less than 80% of viewport used for content' : '✅ Good viewport utilization'}
${metrics.cls > 0.1 ? '⚠️ High CLS detected - reduce layout shifts' : '✅ Acceptable CLS'}
${metrics.averageInteractionDelay > 300 ? '⚠️ Interaction delays exceed 300ms target' : '✅ Good interaction response time'}
`;

    return report;
  }
}

// Export singleton instance
export const performanceProfiler = typeof window !== 'undefined'
  ? new PerformanceProfiler()
  : null;