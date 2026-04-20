import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EnvironmentService } from './environment.service';

// Features with full OSS backend implementation that work without EE modules
const OSS_AVAILABLE_FEATURES = new Set([
  'comment:viewer',
  'page:permissions',
  'sharing:controls',
  'retention',
  'security:settings',
]);

@Injectable()
export class LicenseCheckService {
  constructor(
    private moduleRef: ModuleRef,
    private environmentService: EnvironmentService,
  ) { }

  isValidEELicense(licenseKey: string): boolean {
    if (this.environmentService.isEEEnabled()) {
      return true;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.isValidEELicense(licenseKey);
    } catch {
      // Self-hosted without EE: treat as valid for OSS features
      return true;
    }
  }

  hasFeature(licenseKey: string, feature: string, plan?: string): boolean {
    if (this.environmentService.isEEEnabled()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ALL_EE_FEATURES } = require('../../ee/licence/feature-registry');
        return ALL_EE_FEATURES.includes(feature);
      } catch {
        return false;
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.hasFeature(licenseKey, feature);
    } catch {
      // Self-hosted without EE: allow OSS-implemented features
      return OSS_AVAILABLE_FEATURES.has(feature);
    }
  }

  getFeatures(licenseKey: string): string[] {
    if (this.environmentService.isEEEnabled()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ALL_EE_FEATURES } = require('../../ee/licence/feature-registry');
        return [...ALL_EE_FEATURES];
      } catch {
        return [];
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.getFeatures(licenseKey);
    } catch {
      // Self-hosted without EE: return OSS-implemented features
      return [...OSS_AVAILABLE_FEATURES];
    }
  }

  resolveFeatures(licenseKey: string, plan: string): string[] {
    if (this.environmentService.isEEEnabled()) {
      return this.getFeatures(licenseKey);
    }

    return this.getFeatures(licenseKey);
  }

  resolveTier(licenseKey: string, plan: string): string {
    if (this.environmentService.isEEEnabled()) {
      return 'enterprise';
    }

    return this.getLicenseType(licenseKey) ?? 'business';
  }

  private getLicenseType(licenseKey: string): string | null {
    if (this.environmentService.isEEEnabled()) {
      return 'enterprise';
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LicenseModule = require('../../ee/licence/license.service');
      const licenseService = this.moduleRef.get(LicenseModule.LicenseService, {
        strict: false,
      });
      return licenseService.getLicenseType(licenseKey);
    } catch {
      // Self-hosted without EE: report as business tier
      return 'business';
    }
  }
}
