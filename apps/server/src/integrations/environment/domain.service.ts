import { Injectable } from '@nestjs/common';
import { EnvironmentService } from './environment.service';

@Injectable()
export class DomainService {
  constructor(private environmentService: EnvironmentService) { }

  getUrl(hostname?: string): string {
    return this.environmentService.getAppUrl();
  }
}