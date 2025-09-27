/**
 * Mobile Performance Analyzer - Comprehensive mobile UX metrics
 * Measures touch targets, scroll performance, and gesture conflicts
 */

export interface TouchTargetMetrics {
  element: string;
  label: string;
  width: number;
  height: number;
  area: number;
  meetsAppleHIG: boolean; // 44×44px minimum
  meetsMaterialDesign: boolean; // 48×48px minimum
  thumbReachability: 'easy' | 'stretch' | 'hard';
  position: {
    x: number;
    y: number;
    fromBottom: number; // Distance from bottom (thumb zone)
    fromTop: number;
  };
}

export interface ScrollPerformanceMetrics {
  frameRate: {
    current: number;
    average: number;
    min: number;
    max: number;
    droppedFrames: number;
  };
  scrollJank: {
    jankEvents: number;
    totalJankDuration: number;
    longestJank: number;
    jankPercentage: number;
  };
  scrollVelocity: {
    average: number;
    peak: number;
  };
  overscroll: {
    bounceEnabled: boolean;
    rubberBandEvents: number;
  };
  momentum: {
    enabled: boolean;
    decelerationRate: number;
  };
}

export interface GestureConflictMetrics {
  swipeConflicts: {
    horizontal: string[]; // Elements that might conflict with back gesture
    vertical: string[]; // Elements that might conflict with scroll
  };
  tapDeadZones: {
    area: number; // Pixels that don't respond to taps
    percentage: number;
  };
  accidentalTaps: {
    nearEdges: string[]; // Elements too close to edges
    overlapping: string[]; // Elements with overlapping touch areas
  };
  gestureRecognizers: {
    tap: boolean;
    longPress: boolean;
    swipe: boolean;
    pinch: boolean;
    pan: boolean;
  };
}

export interface MobilePerformanceReport {
  timestamp: string;
  device: {
    viewport: { width: number; height: number };
    pixelRatio: number;
    userAgent: string;
    isTouchDevice: boolean;
    orientation: 'portrait' | 'landscape';
  };
  touchTargets: {
    all: TouchTargetMetrics[];
    compliant: TouchTargetMetrics[];
    nonCompliant: TouchTargetMetrics[];
    averageSize: { width: number; height: number };
    complianceRate: {
      appleHIG: number; // % meeting 44×44px
      materialDesign: number; // % meeting 48×48px
    };
  };
  scrollPerformance: ScrollPerformanceMetrics;
  gestureConflicts: GestureConflictMetrics;
  thumbZone: {
    easy: { elements: number; percentage: number };
    stretch: { elements: number; percentage: number };
    hard: { elements: number; percentage: number };
  };
  recommendations: string[];
}

export class MobilePerformanceAnalyzer {
  private frameRates: number[] = [];
  private lastFrameTime: number = 0;
  private rafId: number | null = null;
  private scrollObserver: { startTime: number; startPosition: number } | null = null;
  private jankEvents: Array<{ timestamp: number; duration: number }> = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.startPerformanceMonitoring();
    }
  }

  private startPerformanceMonitoring(): void {
    // Monitor frame rate
    this.monitorFrameRate();

    // Monitor scroll performance
    this.monitorScrollPerformance();
  }

  private monitorFrameRate(): void {
    const measureFrame = (timestamp: number) => {
      if (this.lastFrameTime) {
        const frameDuration = timestamp - this.lastFrameTime;
        const fps = 1000 / frameDuration;
        this.frameRates.push(fps);

        // Keep only last 300 frames (5 seconds at 60fps)
        if (this.frameRates.length > 300) {
          this.frameRates.shift();
        }

        // Detect jank (frame took > 16.67ms for 60fps)
        if (frameDuration > 16.67 * 1.5) { // 1.5x threshold
          this.jankEvents.push({
            timestamp,
            duration: frameDuration,
          });
        }
      }
      this.lastFrameTime = timestamp;
      this.rafId = requestAnimationFrame(measureFrame);
    };

    this.rafId = requestAnimationFrame(measureFrame);
  }

  private monitorScrollPerformance(): void {
    let scrolling = false;
    let scrollStartTime = 0;
    let scrollStartPosition = 0;
    let lastScrollTime = 0;

    const handleScroll = () => {
      const now = performance.now();
      const scrollY = window.scrollY;

      if (!scrolling) {
        scrolling = true;
        scrollStartTime = now;
        scrollStartPosition = scrollY;
      }

      lastScrollTime = now;

      // Reset scrolling flag after scroll ends
      setTimeout(() => {
        if (performance.now() - lastScrollTime > 100) {
          scrolling = false;
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  private analyzeTouchTargets(): TouchTargetMetrics[] {
    const touchTargets: TouchTargetMetrics[] = [];

    // Find all interactive elements
    const interactiveSelectors = [
      'a', 'button', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[onclick]',
      '[class*="clickable"]', '[class*="tappable"]'
    ];

    interactiveSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const htmlElement = element as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();
        const styles = window.getComputedStyle(htmlElement);

        // Skip hidden elements
        if (rect.width === 0 || rect.height === 0 || styles.display === 'none') {
          return;
        }

        // Calculate actual touch target (including padding)
        const width = rect.width;
        const height = rect.height;

        // Determine thumb reachability based on position
        const fromBottom = window.innerHeight - rect.bottom;
        const thumbReachability = this.calculateThumbReachability(
          rect.left + rect.width / 2,
          fromBottom
        );

        touchTargets.push({
          element: this.getElementIdentifier(htmlElement),
          label: htmlElement.textContent?.trim().slice(0, 30) ||
                 htmlElement.getAttribute('aria-label') ||
                 'Unnamed',
          width,
          height,
          area: width * height,
          meetsAppleHIG: width >= 44 && height >= 44,
          meetsMaterialDesign: width >= 48 && height >= 48,
          thumbReachability,
          position: {
            x: rect.left,
            y: rect.top,
            fromBottom,
            fromTop: rect.top,
          },
        });
      });
    });

    return touchTargets;
  }

  private calculateThumbReachability(x: number, fromBottom: number): 'easy' | 'stretch' | 'hard' {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Define thumb zones (based on typical phone holding)
    // Easy: Bottom 1/3 of screen, center 2/3 horizontally
    // Stretch: Middle 1/3 of screen or edges of bottom
    // Hard: Top 1/3 of screen or far edges

    const isBottomThird = fromBottom < screenHeight / 3;
    const isMiddleThird = fromBottom >= screenHeight / 3 && fromBottom < (2 * screenHeight / 3);
    const isCenterHorizontally = x > screenWidth * 0.2 && x < screenWidth * 0.8;

    if (isBottomThird && isCenterHorizontally) {
      return 'easy';
    } else if (isMiddleThird || (isBottomThird && !isCenterHorizontally)) {
      return 'stretch';
    } else {
      return 'hard';
    }
  }

  private detectGestureConflicts(): GestureConflictMetrics {
    const conflicts: GestureConflictMetrics = {
      swipeConflicts: {
        horizontal: [],
        vertical: [],
      },
      tapDeadZones: {
        area: 0,
        percentage: 0,
      },
      accidentalTaps: {
        nearEdges: [],
        overlapping: [],
      },
      gestureRecognizers: {
        tap: true,
        longPress: 'ontouchstart' in window,
        swipe: 'ontouchstart' in window,
        pinch: 'ontouchstart' in window && navigator.maxTouchPoints > 1,
        pan: 'ontouchstart' in window,
      },
    };

    // Check for horizontal swipe conflicts (e.g., carousels vs back gesture)
    const horizontalScrollables = document.querySelectorAll(
      '[style*="overflow-x"], [style*="overflowX"], .carousel, .swiper, [class*="scroll-x"]'
    );
    horizontalScrollables.forEach(element => {
      const rect = element.getBoundingClientRect();
      // Check if near edges (iOS back gesture zone)
      if (rect.left < 20 || rect.right > window.innerWidth - 20) {
        conflicts.swipeConflicts.horizontal.push(this.getElementIdentifier(element as HTMLElement));
      }
    });

    // Check for elements too close to screen edges (accidental taps)
    const allInteractive = document.querySelectorAll('a, button, [role="button"]');
    const edgeThreshold = 10; // pixels from edge

    allInteractive.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (
        rect.left < edgeThreshold ||
        rect.right > window.innerWidth - edgeThreshold ||
        rect.top < edgeThreshold ||
        rect.bottom > window.innerHeight - edgeThreshold
      ) {
        conflicts.accidentalTaps.nearEdges.push(
          this.getElementIdentifier(element as HTMLElement)
        );
      }
    });

    // Calculate tap dead zones (areas with no interactive elements)
    const viewportArea = window.innerWidth * window.innerHeight;
    let coveredArea = 0;

    allInteractive.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        coveredArea += rect.width * rect.height;
      }
    });

    conflicts.tapDeadZones.area = viewportArea - coveredArea;
    conflicts.tapDeadZones.percentage = ((viewportArea - coveredArea) / viewportArea) * 100;

    return conflicts;
  }

  private getScrollPerformanceMetrics(): ScrollPerformanceMetrics {
    const frameRateMetrics = this.calculateFrameRateMetrics();
    const jankMetrics = this.calculateJankMetrics();

    return {
      frameRate: frameRateMetrics,
      scrollJank: jankMetrics,
      scrollVelocity: {
        average: 0, // Would need scroll event tracking
        peak: 0,
      },
      overscroll: {
        bounceEnabled: CSS.supports('overscroll-behavior', 'contain'),
        rubberBandEvents: 0, // Would need event tracking
      },
      momentum: {
        enabled: CSS.supports('-webkit-overflow-scrolling', 'touch'),
        decelerationRate: 0.998, // iOS default
      },
    };
  }

  private calculateFrameRateMetrics() {
    if (this.frameRates.length === 0) {
      return {
        current: 60,
        average: 60,
        min: 60,
        max: 60,
        droppedFrames: 0,
      };
    }

    const current = this.frameRates[this.frameRates.length - 1] || 60;
    const average = this.frameRates.reduce((a, b) => a + b, 0) / this.frameRates.length;
    const min = Math.min(...this.frameRates);
    const max = Math.max(...this.frameRates);
    const droppedFrames = this.frameRates.filter(fps => fps < 50).length;

    return { current, average, min, max, droppedFrames };
  }

  private calculateJankMetrics() {
    const totalJankDuration = this.jankEvents.reduce((sum, event) => sum + event.duration, 0);
    const longestJank = Math.max(...this.jankEvents.map(e => e.duration), 0);
    const jankPercentage = this.frameRates.length > 0
      ? (this.jankEvents.length / this.frameRates.length) * 100
      : 0;

    return {
      jankEvents: this.jankEvents.length,
      totalJankDuration,
      longestJank,
      jankPercentage,
    };
  }

  private getElementIdentifier(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;

    const classList = element.className
      .split(' ')
      .filter(c => c && !c.includes(':'))
      .slice(0, 2)
      .join('.');

    return element.tagName.toLowerCase() + (classList ? `.${classList}` : '');
  }

  public generateReport(): MobilePerformanceReport {
    const touchTargets = this.analyzeTouchTargets();
    const compliant = touchTargets.filter(t => t.meetsAppleHIG);
    const nonCompliant = touchTargets.filter(t => !t.meetsAppleHIG);

    // Calculate average sizes
    const avgWidth = touchTargets.length > 0
      ? touchTargets.reduce((sum, t) => sum + t.width, 0) / touchTargets.length
      : 0;
    const avgHeight = touchTargets.length > 0
      ? touchTargets.reduce((sum, t) => sum + t.height, 0) / touchTargets.length
      : 0;

    // Calculate thumb zone distribution
    const thumbZoneStats = {
      easy: touchTargets.filter(t => t.thumbReachability === 'easy'),
      stretch: touchTargets.filter(t => t.thumbReachability === 'stretch'),
      hard: touchTargets.filter(t => t.thumbReachability === 'hard'),
    };

    const recommendations = this.generateRecommendations(touchTargets, nonCompliant);

    return {
      timestamp: new Date().toISOString(),
      device: {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        pixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent,
        isTouchDevice: 'ontouchstart' in window,
        orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
      },
      touchTargets: {
        all: touchTargets,
        compliant,
        nonCompliant,
        averageSize: { width: avgWidth, height: avgHeight },
        complianceRate: {
          appleHIG: touchTargets.length > 0
            ? (compliant.length / touchTargets.length) * 100
            : 0,
          materialDesign: touchTargets.length > 0
            ? (touchTargets.filter(t => t.meetsMaterialDesign).length / touchTargets.length) * 100
            : 0,
        },
      },
      scrollPerformance: this.getScrollPerformanceMetrics(),
      gestureConflicts: this.detectGestureConflicts(),
      thumbZone: {
        easy: {
          elements: thumbZoneStats.easy.length,
          percentage: touchTargets.length > 0
            ? (thumbZoneStats.easy.length / touchTargets.length) * 100
            : 0,
        },
        stretch: {
          elements: thumbZoneStats.stretch.length,
          percentage: touchTargets.length > 0
            ? (thumbZoneStats.stretch.length / touchTargets.length) * 100
            : 0,
        },
        hard: {
          elements: thumbZoneStats.hard.length,
          percentage: touchTargets.length > 0
            ? (thumbZoneStats.hard.length / touchTargets.length) * 100
            : 0,
        },
      },
      recommendations,
    };
  }

  private generateRecommendations(
    touchTargets: TouchTargetMetrics[],
    nonCompliant: TouchTargetMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Touch target recommendations
    if (nonCompliant.length > 0) {
      recommendations.push(
        `Increase ${nonCompliant.length} touch targets to meet 44×44px minimum`
      );
    }

    // Thumb zone recommendations
    const hardToReach = touchTargets.filter(t => t.thumbReachability === 'hard');
    if (hardToReach.length > touchTargets.length * 0.3) {
      recommendations.push(
        'Move frequently used actions to bottom 2/3 of screen for better thumb reach'
      );
    }

    // Frame rate recommendations
    if (this.frameRates.length > 0) {
      const avgFPS = this.frameRates.reduce((a, b) => a + b, 0) / this.frameRates.length;
      if (avgFPS < 50) {
        recommendations.push('Optimize animations and reduce layout thrashing for better frame rate');
      }
    }

    // Jank recommendations
    if (this.jankEvents.length > 10) {
      recommendations.push('Reduce scroll jank by optimizing heavy operations during scroll');
    }

    // Gesture conflict recommendations
    const conflicts = this.detectGestureConflicts();
    if (conflicts.swipeConflicts.horizontal.length > 0) {
      recommendations.push('Review horizontal scrollable elements near edges (may conflict with back gesture)');
    }

    if (conflicts.accidentalTaps.nearEdges.length > 0) {
      recommendations.push(`Move ${conflicts.accidentalTaps.nearEdges.length} interactive elements away from screen edges`);
    }

    return recommendations;
  }

  public generateDetailedReport(): string {
    const report = this.generateReport();

    return `
# Mobile Performance Report
Generated: ${report.timestamp}
Device: ${report.device.viewport.width}×${report.device.viewport.height} @ ${report.device.pixelRatio}x
Orientation: ${report.device.orientation}

## Touch Target Analysis

### Compliance Rates
- Apple HIG (44×44px): ${report.touchTargets.complianceRate.appleHIG.toFixed(1)}%
- Material Design (48×48px): ${report.touchTargets.complianceRate.materialDesign.toFixed(1)}%
- Average Size: ${report.touchTargets.averageSize.width.toFixed(0)}×${report.touchTargets.averageSize.height.toFixed(0)}px

### Non-Compliant Elements (${report.touchTargets.nonCompliant.length})
${report.touchTargets.nonCompliant.slice(0, 10).map(t =>
  `- ${t.label}: ${t.width.toFixed(0)}×${t.height.toFixed(0)}px`
).join('\n')}

## Thumb Zone Distribution
- Easy Reach: ${report.thumbZone.easy.elements} elements (${report.thumbZone.easy.percentage.toFixed(1)}%)
- Stretch Zone: ${report.thumbZone.stretch.elements} elements (${report.thumbZone.stretch.percentage.toFixed(1)}%)
- Hard to Reach: ${report.thumbZone.hard.elements} elements (${report.thumbZone.hard.percentage.toFixed(1)}%)

## Scroll Performance

### Frame Rate
- Average FPS: ${report.scrollPerformance.frameRate.average.toFixed(1)}
- Min FPS: ${report.scrollPerformance.frameRate.min.toFixed(1)}
- Max FPS: ${report.scrollPerformance.frameRate.max.toFixed(1)}
- Dropped Frames: ${report.scrollPerformance.frameRate.droppedFrames}

### Scroll Jank
- Jank Events: ${report.scrollPerformance.scrollJank.jankEvents}
- Total Jank Duration: ${report.scrollPerformance.scrollJank.totalJankDuration.toFixed(0)}ms
- Longest Jank: ${report.scrollPerformance.scrollJank.longestJank.toFixed(0)}ms
- Jank Percentage: ${report.scrollPerformance.scrollJank.jankPercentage.toFixed(1)}%

## Gesture Conflicts

### Swipe Conflicts
- Horizontal: ${report.gestureConflicts.swipeConflicts.horizontal.length} elements
- Vertical: ${report.gestureConflicts.swipeConflicts.vertical.length} elements

### Accidental Tap Zones
- Elements near edges: ${report.gestureConflicts.accidentalTaps.nearEdges.length}
- Overlapping elements: ${report.gestureConflicts.accidentalTaps.overlapping.length}
- Dead zone coverage: ${report.gestureConflicts.tapDeadZones.percentage.toFixed(1)}%

### Gesture Support
- Touch Device: ${report.device.isTouchDevice ? 'Yes' : 'No'}
- Multi-touch: ${report.gestureConflicts.gestureRecognizers.pinch ? 'Yes' : 'No'}
- Momentum Scrolling: ${report.scrollPerformance.momentum.enabled ? 'Yes' : 'No'}

## Recommendations
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

## Performance Score
${this.calculatePerformanceScore(report)}/100

### Scoring Breakdown
- Touch Compliance: ${report.touchTargets.complianceRate.appleHIG.toFixed(0)}/100
- Thumb Reachability: ${(100 - report.thumbZone.hard.percentage).toFixed(0)}/100
- Frame Rate: ${Math.min(100, (report.scrollPerformance.frameRate.average / 60) * 100).toFixed(0)}/100
- Jank-free: ${(100 - report.scrollPerformance.scrollJank.jankPercentage).toFixed(0)}/100
`;
  }

  private calculatePerformanceScore(report: MobilePerformanceReport): number {
    const touchScore = report.touchTargets.complianceRate.appleHIG;
    const thumbScore = 100 - report.thumbZone.hard.percentage;
    const frameScore = Math.min(100, (report.scrollPerformance.frameRate.average / 60) * 100);
    const jankScore = 100 - report.scrollPerformance.scrollJank.jankPercentage;

    return Math.round((touchScore + thumbScore + frameScore + jankScore) / 4);
  }

  public cleanup(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
  }
}

// Export singleton for browser use
export const mobilePerformanceAnalyzer = typeof window !== 'undefined'
  ? new MobilePerformanceAnalyzer()
  : null;