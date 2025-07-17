import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageHistoryService } from './services/page-history.service';
import { StorageModule } from '../../integrations/storage/storage.module';
import { SynchronizedPageService } from './services/synchronized-page.service';
import { SynchronizedPageRepo } from '@docmost/db/repos/page/synchronized_page.repo';

@Module({
  controllers: [PageController],
  providers: [
    PageService,
    PageHistoryService,
    SynchronizedPageService,
  ],
  exports: [
    PageService,
    PageHistoryService,
    SynchronizedPageService,
  ],
  imports: [StorageModule]
})
export class PageModule {}
