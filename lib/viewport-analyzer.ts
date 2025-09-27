/**
 * Viewport Analyzer - Precise pixel measurement for UI chrome vs content
 * Used to establish baseline metrics before interface redesign
 */

export interface ViewportMetrics {
  viewport: {
    width: number;
    height: number;
    totalPixels: number;
  };
  chrome: {
    // Desktop
    sidebarWidth: number;
    sidebarPixels: number;

    // Mobile
    headerHeight: number;
    headerPixels: number;
    bottomNavHeight: number;
    bottomNavPixels: number;

    // Totals
    totalChromePixels: number;
    chromePercentage: number;
  };
  content: {
    width: number;
    height: number;
    totalPixels: number;
    contentPercentage: number;
    effectiveAspectRatio: string;
  };
  margins: {
    contentMarginLeft: number;
    contentMarginRight: number;
    contentPaddingX: number;
    contentPaddingY: number;
    totalWastedHorizontal: number;
    totalWastedVertical: number;
  };
  breakpoints: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    currentBreakpoint: 'mobile' | 'tablet' | 'desktop';
  };
}

export class ViewportAnalyzer {
  private metrics: ViewportMetrics;

  constructor() {
    this.metrics = this.calculateMetrics();
  }

  private calculateMetrics(): ViewportMetrics {
    if (typeof window === 'undefined') {
      return this.getDefaultMetrics();
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const totalViewportPixels = vw * vh;

    // Detect breakpoint
    const isMobile = vw < 768;
    const isTablet = vw >= 768 && vw < 1024;
    const isDesktop = vw >= 1024;
    const currentBreakpoint = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';

    // Get actual DOM measurements
    const sidebar = document.querySelector('aside');
    const header = document.querySelector('header');
    const mobileNav = document.querySelector('[class*="pb-20"]')?.querySelector('nav') ||
                     document.querySelector('[class*="MobileNav"]');
    const mainContent = document.querySelector('main');

    let chromePixels = 0;
    let contentWidth = vw;
    let contentHeight = vh;

    // Desktop measurements
    let sidebarWidth = 0;
    let sidebarPixels = 0;

    if (sidebar && !isMobile) {
      const rect = sidebar.getBoundingClientRect();
      sidebarWidth = rect.width || 256; // w-64 = 256px
      sidebarPixels = sidebarWidth * vh;
      chromePixels += sidebarPixels;
      contentWidth -= sidebarWidth;
    }

    // Mobile measurements
    let headerHeight = 0;
    let headerPixels = 0;
    let bottomNavHeight = 0;
    let bottomNavPixels = 0;

    if (isMobile) {
      if (header) {
        const rect = header.getBoundingClientRect();
        headerHeight = rect.height || 52; // Estimated from py-3 + text
        headerPixels = headerHeight * vw;
        chromePixels += headerPixels;
        contentHeight -= headerHeight;
      }

      // Check for mobile nav or pb-20 (80px padding for bottom nav)
      const mainElement = document.querySelector('main');
      if (mainElement?.classList.contains('pb-20')) {
        bottomNavHeight = 80; // pb-20 = 80px
      } else if (mobileNav) {
        const rect = (mobileNav as HTMLElement).getBoundingClientRect();
        bottomNavHeight = rect.height || 72;
      }

      if (bottomNavHeight > 0) {
        bottomNavPixels = bottomNavHeight * vw;
        chromePixels += bottomNavPixels;
        contentHeight -= bottomNavHeight;
      }
    }

    // Content margins and padding
    let contentMarginLeft = 0;
    let contentMarginRight = 0;
    let contentPaddingX = 0;
    let contentPaddingY = 0;

    if (mainContent) {
      const styles = window.getComputedStyle(mainContent);
      contentMarginLeft = parseFloat(styles.marginLeft) || 0;
      contentMarginRight = parseFloat(styles.marginRight) || 0;
      contentPaddingX = (parseFloat(styles.paddingLeft) || 0) +
                        (parseFloat(styles.paddingRight) || 0);
      contentPaddingY = (parseFloat(styles.paddingTop) || 0) +
                        (parseFloat(styles.paddingBottom) || 0);

      // Account for ml-64 class on desktop
      if (!isMobile && mainContent.classList.contains('ml-64')) {
        contentMarginLeft = 256; // ml-64 = 256px
      }
    }

    const totalWastedHorizontal = contentMarginLeft + contentMarginRight + contentPaddingX;
    const totalWastedVertical = contentPaddingY;

    // Effective content area
    const effectiveContentWidth = contentWidth - contentPaddingX;
    const effectiveContentHeight = contentHeight - contentPaddingY;
    const contentPixels = effectiveContentWidth * effectiveContentHeight;

    // Calculate percentages
    const chromePercentage = (chromePixels / totalViewportPixels) * 100;
    const contentPercentage = (contentPixels / totalViewportPixels) * 100;

    // Calculate effective aspect ratio for content
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const aspectGCD = gcd(Math.round(effectiveContentWidth), Math.round(effectiveContentHeight));
    const aspectRatio = `${Math.round(effectiveContentWidth / aspectGCD)}:${Math.round(effectiveContentHeight / aspectGCD)}`;

    return {
      viewport: {
        width: vw,
        height: vh,
        totalPixels: totalViewportPixels,
      },
      chrome: {
        sidebarWidth,
        sidebarPixels,
        headerHeight,
        headerPixels,
        bottomNavHeight,
        bottomNavPixels,
        totalChromePixels: chromePixels,
        chromePercentage,
      },
      content: {
        width: effectiveContentWidth,
        height: effectiveContentHeight,
        totalPixels: contentPixels,
        contentPercentage,
        effectiveAspectRatio: aspectRatio,
      },
      margins: {
        contentMarginLeft,
        contentMarginRight,
        contentPaddingX,
        contentPaddingY,
        totalWastedHorizontal,
        totalWastedVertical,
      },
      breakpoints: {
        isMobile,
        isTablet,
        isDesktop,
        currentBreakpoint,
      },
    };
  }

  private getDefaultMetrics(): ViewportMetrics {
    return {
      viewport: { width: 1920, height: 1080, totalPixels: 2073600 },
      chrome: {
        sidebarWidth: 256,
        sidebarPixels: 276480,
        headerHeight: 0,
        headerPixels: 0,
        bottomNavHeight: 0,
        bottomNavPixels: 0,
        totalChromePixels: 276480,
        chromePercentage: 13.33,
      },
      content: {
        width: 1664,
        height: 1080,
        totalPixels: 1797120,
        contentPercentage: 86.67,
        effectiveAspectRatio: '52:33',
      },
      margins: {
        contentMarginLeft: 256,
        contentMarginRight: 0,
        contentPaddingX: 0,
        contentPaddingY: 0,
        totalWastedHorizontal: 256,
        totalWastedVertical: 0,
      },
      breakpoints: {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        currentBreakpoint: 'desktop',
      },
    };
  }

  public refresh(): ViewportMetrics {
    this.metrics = this.calculateMetrics();
    return this.metrics;
  }

  public getMetrics(): ViewportMetrics {
    return { ...this.metrics };
  }

  public generateDetailedReport(): string {
    const m = this.metrics;

    return `
# Viewport Utilization Analysis
Generated: ${new Date().toISOString()}
Device: ${m.breakpoints.currentBreakpoint.toUpperCase()}

## Viewport Dimensions
- Resolution: ${m.viewport.width}×${m.viewport.height}
- Total Pixels: ${m.viewport.totalPixels.toLocaleString()}
- Aspect Ratio: ${(m.viewport.width / m.viewport.height).toFixed(2)}:1

## Chrome Usage (UI Elements)
${m.breakpoints.isDesktop ? `### Desktop Chrome
- Sidebar Width: ${m.chrome.sidebarWidth}px
- Sidebar Pixels: ${m.chrome.sidebarPixels.toLocaleString()} (${(m.chrome.sidebarPixels / m.viewport.totalPixels * 100).toFixed(1)}%)
` : ''}
${m.breakpoints.isMobile ? `### Mobile Chrome
- Header Height: ${m.chrome.headerHeight}px (${m.chrome.headerPixels.toLocaleString()} pixels)
- Bottom Nav Height: ${m.chrome.bottomNavHeight}px (${m.chrome.bottomNavPixels.toLocaleString()} pixels)
` : ''}
### Total Chrome
- Chrome Pixels: ${m.chrome.totalChromePixels.toLocaleString()}
- Chrome Percentage: ${m.chrome.chromePercentage.toFixed(1)}%

## Content Area
- Dimensions: ${m.content.width.toFixed(0)}×${m.content.height.toFixed(0)}
- Content Pixels: ${m.content.totalPixels.toLocaleString()}
- Content Percentage: ${m.content.contentPercentage.toFixed(1)}%
- Effective Aspect: ${m.content.effectiveAspectRatio}

## Margins & Spacing
- Content Margin Left: ${m.margins.contentMarginLeft}px
- Content Margin Right: ${m.margins.contentMarginRight}px
- Content Padding X: ${m.margins.contentPaddingX}px
- Content Padding Y: ${m.margins.contentPaddingY}px
- Total Wasted Horizontal: ${m.margins.totalWastedHorizontal}px
- Total Wasted Vertical: ${m.margins.totalWastedVertical}px

## Efficiency Analysis
${m.chrome.chromePercentage > 15 ? '⚠️ WARNING: Chrome uses >15% of viewport' : '✅ Chrome usage is acceptable'}
${m.margins.totalWastedHorizontal > 280 ? '⚠️ WARNING: >280px horizontal space wasted' : '✅ Horizontal space usage is efficient'}
${m.content.contentPercentage < 85 ? '⚠️ WARNING: <85% viewport used for content' : '✅ Good content area utilization'}

## Pixel Budget
- Available: ${m.viewport.totalPixels.toLocaleString()} px
- Chrome: ${m.chrome.totalChromePixels.toLocaleString()} px (${m.chrome.chromePercentage.toFixed(1)}%)
- Content: ${m.content.totalPixels.toLocaleString()} px (${m.content.contentPercentage.toFixed(1)}%)
- Lost to Margins: ${((m.margins.totalWastedHorizontal * m.viewport.height) + (m.margins.totalWastedVertical * m.viewport.width)).toLocaleString()} px

## Redesign Target
Current Chrome: ${m.chrome.chromePercentage.toFixed(1)}%
Target Chrome: 5.2% (100px combined navbar/footer)
Potential Gain: ${(m.content.contentPercentage + (m.chrome.chromePercentage - 5.2)).toFixed(1)}% for content
`;
  }

  public compareToTarget(): {
    current: number;
    target: number;
    improvement: number;
    pixelsReclaimed: number;
  } {
    const targetChromeHeight = 100; // 56px navbar + 44px footer
    const targetChromePixels = targetChromeHeight * this.metrics.viewport.width;
    const targetChromePercentage = (targetChromePixels / this.metrics.viewport.totalPixels) * 100;

    return {
      current: this.metrics.chrome.chromePercentage,
      target: targetChromePercentage,
      improvement: this.metrics.chrome.chromePercentage - targetChromePercentage,
      pixelsReclaimed: this.metrics.chrome.totalChromePixels - targetChromePixels,
    };
  }
}

// Export singleton for browser use
export const viewportAnalyzer = typeof window !== 'undefined'
  ? new ViewportAnalyzer()
  : null;