import { Injectable } from '@nestjs/common';
import { PageHistoryRepo } from '@docmost-server/database/repos/page/page-history.repo';
import { PageHistory } from '@docmost-server/database/types/entity.types';
import { PaginationOptions } from '@docmost-server/database/pagination/pagination-options';
import { PaginationResult } from '@docmost-server/database/pagination/pagination';

@Injectable()
export class PageHistoryService {
  constructor(private pageHistoryRepo: PageHistoryRepo) {}

  async findById(historyId: string): Promise<PageHistory> {
    return await this.pageHistoryRepo.findById(historyId);
  }

  async findHistoryByPageId(
    pageId: string,
    paginationOptions: PaginationOptions,
  ): Promise<PaginationResult<any>> {
    const pageHistory = await this.pageHistoryRepo.findPageHistoryByPageId(
      pageId,
      paginationOptions,
    );

    return pageHistory;
  }
}
