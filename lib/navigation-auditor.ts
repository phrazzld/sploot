/**
 * Navigation Auditor - Comprehensive analysis of all navigation touchpoints
 * Measures click depth, touch targets, and estimates usage frequency
 */

export interface NavigationElement {
  id: string;
  label: string;
  selector: string;
  type: 'link' | 'button' | 'dropdown' | 'toggle' | 'input';
  location: 'sidebar' | 'header' | 'footer' | 'mobile-nav' | 'dropdown-menu';
  clickDepth: number;
  touchTarget: {
    width: number;
    height: number;
    area: number;
    meetsMinimum: boolean; // 44x44px minimum
  };
  visibility: {
    desktop: boolean;
    tablet: boolean;
    mobile: boolean;
  };
  estimatedUsage: 'critical' | 'high' | 'medium' | 'low' | 'rare';
  usageScore: number; // 0-100
  path?: string; // URL or action path
  parentId?: string; // For nested elements
  children?: string[]; // Child element IDs
  accessibility: {
    hasLabel: boolean;
    hasAriaLabel: boolean;
    isKeyboardAccessible: boolean;
    tabIndex?: number;
  };
}

export interface NavigationAuditReport {
  timestamp: string;
  elements: NavigationElement[];
  summary: {
    totalElements: number;
    byLocation: Record<string, number>;
    byType: Record<string, number>;
    byClickDepth: Record<number, number>;
    averageClickDepth: number;
    touchTargetCompliance: number; // percentage
    keyboardAccessibility: number; // percentage
  };
  usageAnalysis: {
    criticalPaths: NavigationElement[];
    mostUsed: NavigationElement[];
    leastUsed: NavigationElement[];
    deepestElements: NavigationElement[];
  };
  issues: {
    smallTouchTargets: NavigationElement[];
    deepNavigation: NavigationElement[]; // depth > 2
    noLabels: NavigationElement[];
    notKeyboardAccessible: NavigationElement[];
  };
}

export class NavigationAuditor {
  private elements: Map<string, NavigationElement> = new Map();
  private idCounter = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audit();
    }
  }

  private generateId(): string {
    return `nav-element-${++this.idCounter}`;
  }

  private audit(): void {
    // Clear previous audit
    this.elements.clear();
    this.idCounter = 0;

    // Audit different navigation areas
    this.auditSidebar();
    this.auditHeader();
    this.auditMobileNav();
    this.auditDropdowns();
  }

  private auditSidebar(): void {
    const sidebar = document.querySelector('aside');
    if (!sidebar) return;

    // Logo/Brand
    const logo = sidebar.querySelector('h1');
    if (logo) {
      this.addElement({
        label: 'Sploot Logo',
        element: logo as HTMLElement,
        type: 'link',
        location: 'sidebar',
        clickDepth: 0,
        estimatedUsage: 'high',
        path: '/app',
      });
    }

    // Navigation links
    const navLinks = sidebar.querySelectorAll('nav a');
    navLinks.forEach((link) => {
      const htmlLink = link as HTMLAnchorElement;
      const label = htmlLink.textContent?.trim() || '';
      const href = htmlLink.getAttribute('href') || '';

      // Determine usage based on common patterns
      let usage: NavigationElement['estimatedUsage'] = 'medium';
      if (label.toLowerCase().includes('dashboard')) usage = 'critical';
      else if (label.toLowerCase().includes('settings')) usage = 'low';

      this.addElement({
        label,
        element: htmlLink,
        type: 'link',
        location: 'sidebar',
        clickDepth: 1,
        estimatedUsage: usage,
        path: href,
      });
    });

    // User menu
    const userMenu = sidebar.querySelector('[class*="user"]');
    if (userMenu) {
      const parentId = this.addElement({
        label: 'User Menu',
        element: userMenu as HTMLElement,
        type: 'dropdown',
        location: 'sidebar',
        clickDepth: 1,
        estimatedUsage: 'medium',
      });

      // User menu items (assumed to be in dropdown)
      this.addElement({
        label: 'Profile',
        element: userMenu as HTMLElement,
        type: 'link',
        location: 'dropdown-menu',
        clickDepth: 2,
        estimatedUsage: 'low',
        parentId,
        path: '/app/profile',
      });

      this.addElement({
        label: 'Sign Out',
        element: userMenu as HTMLElement,
        type: 'button',
        location: 'dropdown-menu',
        clickDepth: 2,
        estimatedUsage: 'low',
        parentId,
        path: '/sign-out',
      });
    }

    // Tag filter
    const tagFilter = sidebar.querySelector('[class*="tag"]');
    if (tagFilter) {
      this.addElement({
        label: 'Tag Filter',
        element: tagFilter as HTMLElement,
        type: 'dropdown',
        location: 'sidebar',
        clickDepth: 1,
        estimatedUsage: 'medium',
      });
    }
  }

  private auditHeader(): void {
    const header = document.querySelector('header');
    if (!header) return;

    // Mobile header elements
    const headerLogo = header.querySelector('h1');
    if (headerLogo) {
      this.addElement({
        label: 'Mobile Logo',
        element: headerLogo as HTMLElement,
        type: 'link',
        location: 'header',
        clickDepth: 0,
        estimatedUsage: 'high',
        path: '/app',
        visibility: { desktop: false, tablet: false, mobile: true },
      });
    }

    // Mobile user menu
    const mobileUserMenu = header.querySelector('[variant="mobile"]');
    if (mobileUserMenu) {
      this.addElement({
        label: 'Mobile User Menu',
        element: mobileUserMenu as HTMLElement,
        type: 'dropdown',
        location: 'header',
        clickDepth: 1,
        estimatedUsage: 'medium',
        visibility: { desktop: false, tablet: false, mobile: true },
      });
    }
  }

  private auditMobileNav(): void {
    // Look for mobile navigation
    const mobileNav = document.querySelector('[class*="MobileNav"]') ||
                     document.querySelector('[class*="mobile"][class*="nav"]');

    if (!mobileNav) return;

    // Typical mobile nav items
    const navItems = mobileNav.querySelectorAll('a, button');
    navItems.forEach((item) => {
      const element = item as HTMLElement;
      const label = element.textContent?.trim() ||
                   element.getAttribute('aria-label') || '';

      this.addElement({
        label: `Mobile Nav: ${label}`,
        element,
        type: element.tagName === 'A' ? 'link' : 'button',
        location: 'mobile-nav',
        clickDepth: 1,
        estimatedUsage: 'high',
        visibility: { desktop: false, tablet: false, mobile: true },
      });
    });
  }

  private auditDropdowns(): void {
    // Find all dropdown menus
    const dropdowns = document.querySelectorAll('[role="menu"], [class*="dropdown"]');

    dropdowns.forEach((dropdown) => {
      const items = dropdown.querySelectorAll('a, button');
      items.forEach((item) => {
        const element = item as HTMLElement;
        const label = element.textContent?.trim() || '';

        // Skip if already added
        if (this.findExistingElement(element)) return;

        this.addElement({
          label: `Dropdown: ${label}`,
          element,
          type: element.tagName === 'A' ? 'link' : 'button',
          location: 'dropdown-menu',
          clickDepth: 2,
          estimatedUsage: 'low',
        });
      });
    });
  }

  private findExistingElement(element: HTMLElement): NavigationElement | undefined {
    for (const [_, navElement] of this.elements) {
      if (navElement.selector === this.getSelector(element)) {
        return navElement;
      }
    }
    return undefined;
  }

  private addElement(config: {
    label: string;
    element: HTMLElement;
    type: NavigationElement['type'];
    location: NavigationElement['location'];
    clickDepth: number;
    estimatedUsage: NavigationElement['estimatedUsage'];
    path?: string;
    parentId?: string;
    visibility?: NavigationElement['visibility'];
  }): string {
    const id = this.generateId();
    const rect = config.element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(config.element);

    // Calculate actual touch target (including padding)
    const width = rect.width || parseFloat(computedStyle.width) || 0;
    const height = rect.height || parseFloat(computedStyle.height) || 0;

    // Check accessibility
    const hasLabel = !!config.label;
    const hasAriaLabel = !!config.element.getAttribute('aria-label');
    const isKeyboardAccessible =
      config.element.tagName === 'A' ||
      config.element.tagName === 'BUTTON' ||
      config.element.hasAttribute('tabindex');
    const tabIndex = config.element.tabIndex;

    // Calculate usage score (0-100)
    const usageScore = this.calculateUsageScore(config.estimatedUsage, config.clickDepth);

    // Determine visibility
    const visibility = config.visibility || {
      desktop: !config.element.closest('.md\\:hidden'),
      tablet: true,
      mobile: !config.element.closest('.hidden.md\\:flex'),
    };

    const navElement: NavigationElement = {
      id,
      label: config.label,
      selector: this.getSelector(config.element),
      type: config.type,
      location: config.location,
      clickDepth: config.clickDepth,
      touchTarget: {
        width,
        height,
        area: width * height,
        meetsMinimum: width >= 44 && height >= 44,
      },
      visibility,
      estimatedUsage: config.estimatedUsage,
      usageScore,
      path: config.path,
      parentId: config.parentId,
      accessibility: {
        hasLabel,
        hasAriaLabel,
        isKeyboardAccessible,
        tabIndex: tabIndex >= 0 ? tabIndex : undefined,
      },
    };

    this.elements.set(id, navElement);

    // Update parent's children
    if (config.parentId) {
      const parent = this.elements.get(config.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(id);
      }
    }

    return id;
  }

  private getSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;

    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className
        .split(' ')
        .filter(c => c && !c.includes(':'))
        .slice(0, 2)
        .join('.');
      if (classes) selector += `.${classes}`;
    }

    return selector;
  }

  private calculateUsageScore(
    usage: NavigationElement['estimatedUsage'],
    clickDepth: number
  ): number {
    const usageBase = {
      critical: 100,
      high: 80,
      medium: 50,
      low: 20,
      rare: 5,
    };

    const depthPenalty = clickDepth * 10;
    return Math.max(0, usageBase[usage] - depthPenalty);
  }

  public getReport(): NavigationAuditReport {
    const elements = Array.from(this.elements.values());

    // Calculate summary statistics
    const byLocation: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byClickDepth: Record<number, number> = {};

    elements.forEach(el => {
      byLocation[el.location] = (byLocation[el.location] || 0) + 1;
      byType[el.type] = (byType[el.type] || 0) + 1;
      byClickDepth[el.clickDepth] = (byClickDepth[el.clickDepth] || 0) + 1;
    });

    const averageClickDepth = elements.length > 0
      ? elements.reduce((sum, el) => sum + el.clickDepth, 0) / elements.length
      : 0;

    const touchTargetCompliance = elements.length > 0
      ? (elements.filter(el => el.touchTarget.meetsMinimum).length / elements.length) * 100
      : 0;

    const keyboardAccessibility = elements.length > 0
      ? (elements.filter(el => el.accessibility.isKeyboardAccessible).length / elements.length) * 100
      : 0;

    // Identify critical paths and usage patterns
    const criticalPaths = elements.filter(el => el.estimatedUsage === 'critical');
    const mostUsed = elements
      .sort((a, b) => b.usageScore - a.usageScore)
      .slice(0, 5);
    const leastUsed = elements
      .sort((a, b) => a.usageScore - b.usageScore)
      .slice(0, 5);
    const deepestElements = elements.filter(el => el.clickDepth > 2);

    // Identify issues
    const smallTouchTargets = elements.filter(el => !el.touchTarget.meetsMinimum);
    const deepNavigation = elements.filter(el => el.clickDepth > 2);
    const noLabels = elements.filter(el => !el.accessibility.hasLabel && !el.accessibility.hasAriaLabel);
    const notKeyboardAccessible = elements.filter(el => !el.accessibility.isKeyboardAccessible);

    return {
      timestamp: new Date().toISOString(),
      elements,
      summary: {
        totalElements: elements.length,
        byLocation,
        byType,
        byClickDepth,
        averageClickDepth,
        touchTargetCompliance,
        keyboardAccessibility,
      },
      usageAnalysis: {
        criticalPaths,
        mostUsed,
        leastUsed,
        deepestElements,
      },
      issues: {
        smallTouchTargets,
        deepNavigation,
        noLabels,
        notKeyboardAccessible,
      },
    };
  }

  public generateDetailedReport(): string {
    const report = this.getReport();

    return `
# Navigation Audit Report
Generated: ${report.timestamp}

## Summary
- Total Elements: ${report.summary.totalElements}
- Average Click Depth: ${report.summary.averageClickDepth.toFixed(2)}
- Touch Target Compliance: ${report.summary.touchTargetCompliance.toFixed(1)}%
- Keyboard Accessibility: ${report.summary.keyboardAccessibility.toFixed(1)}%

## Elements by Location
${Object.entries(report.summary.byLocation)
  .map(([loc, count]) => `- ${loc}: ${count}`)
  .join('\n')}

## Elements by Type
${Object.entries(report.summary.byType)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

## Click Depth Distribution
${Object.entries(report.summary.byClickDepth)
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([depth, count]) => `- Depth ${depth}: ${count} elements`)
  .join('\n')}

## Most Used Elements (Estimated)
${report.usageAnalysis.mostUsed
  .map(el => `1. ${el.label} (Score: ${el.usageScore}, Depth: ${el.clickDepth})`)
  .join('\n')}

## Issues Found

### Small Touch Targets (< 44x44px)
${report.issues.smallTouchTargets.length} elements:
${report.issues.smallTouchTargets
  .slice(0, 5)
  .map(el => `- ${el.label}: ${el.touchTarget.width}×${el.touchTarget.height}px`)
  .join('\n')}

### Deep Navigation (> 2 clicks)
${report.issues.deepNavigation.length} elements:
${report.issues.deepNavigation
  .slice(0, 5)
  .map(el => `- ${el.label}: Depth ${el.clickDepth}`)
  .join('\n')}

### Missing Labels
${report.issues.noLabels.length} elements without proper labeling

### Keyboard Accessibility Issues
${report.issues.notKeyboardAccessible.length} elements not keyboard accessible

## Recommendations
${report.summary.touchTargetCompliance < 80 ? '⚠️ Improve touch targets to meet 44×44px minimum' : '✅ Touch targets are mostly compliant'}
${report.summary.averageClickDepth > 1.5 ? '⚠️ Reduce navigation depth for better UX' : '✅ Navigation depth is acceptable'}
${report.summary.keyboardAccessibility < 95 ? '⚠️ Improve keyboard accessibility' : '✅ Good keyboard accessibility'}
${report.issues.deepNavigation.length > 0 ? '⚠️ Flatten navigation hierarchy to reduce clicks' : '✅ No deep navigation issues'}
`;
  }

  public exportToJSON(): string {
    return JSON.stringify(this.getReport(), null, 2);
  }
}

// Export singleton for browser use
export const navigationAuditor = typeof window !== 'undefined'
  ? new NavigationAuditor()
  : null;