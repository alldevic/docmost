import { Injectable } from '@nestjs/common';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { ExpressionBuilder, sql } from 'kysely';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { ShareRepo } from '@docmost/db/repos/share/share.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { DB } from '@docmost/db/types/db';

// ts_rank reads the whole tsvector of every match, so a word that matches a large share of
// the pages is slow to rank. Only the RANK_CANDIDATES most recently updated matches are ranked;
// below that the results are exact.
const RANK_CANDIDATES = 2000;

// The user's query for websearch_to_tsquery (words, "phrases", -excluded, or) and the last word
// as a prefix for to_tsquery, so results follow typing. A trailing space or quote ends the word.
export function splitSearchQuery(query: string): { web: string; prefix: string } {
  const text = query.trim();
  const quotes = (query.match(/"/g) || []).length;
  const m = text.match(/^(.*?)([\p{L}\p{N}]+)$/su);
  if (!m || quotes % 2 === 1 || !/[\p{L}\p{N}]$/u.test(query)) {
    return { web: text, prefix: '' };
  }
  const [, head, last] = m;
  if (/[-\p{L}\p{N}"]$/u.test(head) || last.length < 2) {
    return { web: text, prefix: '' };
  }
  return { web: head, prefix: `${last}:*` };
}

@Injectable()
export class SearchService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private pageRepo: PageRepo,
    private shareRepo: ShareRepo,
    private spaceMemberRepo: SpaceMemberRepo,
    private pagePermissionRepo: PagePermissionRepo,
  ) {}

  async searchPage(
    searchParams: SearchDTO,
    opts: {
      userId?: string;
      workspaceId: string;
    },
  ): Promise<{ items: SearchResponseDto[] }> {
    const { query } = searchParams;

    if (query.length < 1) {
      return { items: [] };
    }
    const { web, prefix } = splitSearchQuery(query);
    const webQuery = sql`nullif(websearch_to_tsquery('english', f_unaccent(${web})), ''::tsquery)`;
    const prefixQuery = sql`nullif(to_tsquery('english', f_unaccent(${prefix})), ''::tsquery)`;
    const tsQuery = sql<string>`coalesce(${webQuery} && ${prefixQuery}, ${webQuery}, ${prefixQuery})`;

    // the matching pages the user may search in; the space and share conditions are added below
    let candidates = this.db
      .selectFrom('pages')
      .select('id')
      .where('tsv', '@@', tsQuery)
      .$if(Boolean(searchParams.creatorId), (qb) =>
        qb.where('creatorId', '=', searchParams.creatorId),
      )
      .where('deletedAt', 'is', null);

    const limit = searchParams.limit || 25;
    const offset = searchParams.offset || 0;

    if (searchParams.spaceId) {
      // search by spaceId
      candidates = candidates.where('spaceId', '=', searchParams.spaceId);
    } else if (opts.userId && !searchParams.spaceId) {
      // only search spaces the user is a member of
      candidates = candidates
        .where(
          'spaceId',
          'in',
          this.spaceMemberRepo.getUserSpaceIdsQuery(opts.userId),
        )
        .where('workspaceId', '=', opts.workspaceId);
    } else if (searchParams.shareId && !searchParams.spaceId && !opts.userId) {
      // search in shares
      const shareId = searchParams.shareId;
      const share = await this.shareRepo.findById(shareId);
      if (!share || share.workspaceId !== opts.workspaceId) {
        return { items: [] };
      }

      const isRestricted =
        await this.pagePermissionRepo.hasRestrictedAncestor(share.pageId);
      if (isRestricted) {
        return { items: [] };
      }

      const pageIdsToSearch = [];
      if (share.includeSubPages) {
        const pageList = await this.pageRepo.getPageAndDescendantsExcludingRestricted(
          share.pageId,
          {
            includeContent: false,
          },
        );

        pageIdsToSearch.push(...pageList.map((page) => page.id));
      } else {
        pageIdsToSearch.push(share.pageId);
      }

      if (pageIdsToSearch.length > 0) {
        candidates = candidates
          .where('id', 'in', pageIdsToSearch)
          .where('workspaceId', '=', opts.workspaceId);
      } else {
        return { items: [] };
      }
    } else {
      return { items: [] };
    }

    let queryResults = this.db
      .selectFrom('pages')
      .select([
        'id',
        'slugId',
        'title',
        'icon',
        'parentPageId',
        'creatorId',
        'createdAt',
        'updatedAt',
        sql<number>`ts_rank(tsv, ${tsQuery})`.as('rank'),
      ])
      .where(
        'id',
        'in',
        candidates.orderBy('updatedAt', 'desc').orderBy('id').limit(RANK_CANDIDATES),
      )
      // id breaks ties, otherwise pages of equal rank move between result pages
      .orderBy('rank', 'desc')
      .orderBy('id');
    if (!searchParams.shareId) {
      queryResults = queryResults.select((eb) => this.pageRepo.withSpace(eb));
    }

    // Page restrictions are checked on candidates in rank order until the page of results is
    // full, so a user with restrictions does not get short pages (before, the check ran after
    // LIMIT and the hidden pages were just dropped).
    let results: any[];
    if (opts.userId) {
      const visible: any[] = [];
      let batch = Math.max(2 * (offset + limit), 50);
      for (let start = 0; visible.length < offset + limit; start += batch, batch *= 2) {
        //@ts-ignore
        const rows: any[] = await queryResults.limit(batch).offset(start).execute();
        if (rows.length > 0) {
          const accessible = new Set(
            await this.pagePermissionRepo.filterAccessiblePageIds({
              pageIds: rows.map((r) => r.id),
              userId: opts.userId,
              spaceId: searchParams.spaceId,
            }),
          );
          visible.push(...rows.filter((r) => accessible.has(r.id)));
        }
        if (rows.length < batch) break;
      }
      results = visible.slice(offset, offset + limit);
    } else {
      //@ts-ignore
      results = await queryResults.limit(limit).offset(offset).execute();
    }

    // Highlights only for the returned pages. The cost of ts_headline grows with the text
    // (a 500 KB page takes ~60 ms), so it reads the first 20 000 characters.
    if (results.length > 0) {
      const highlights = await this.db
        .selectFrom('pages')
        .select([
          'id',
          sql<string>`ts_headline('english', left(text_content, 20000), ${tsQuery}, 'MinWords=9, MaxWords=10, MaxFragments=3')`.as(
            'highlight',
          ),
        ])
        .where('id', 'in', results.map((r) => r.id))
        .execute();
      const byId = new Map(highlights.map((h) => [h.id, h.highlight]));
      results.forEach((r) => (r.highlight = byId.get(r.id)));
    }

    //@ts-ignore
    const searchResults = results.map((result: SearchResponseDto) => {
      if (result.highlight) {
        result.highlight = result.highlight
          .replace(/\r\n|\r|\n/g, ' ')
          .replace(/\s+/g, ' ');
      }
      return result;
    });

    return { items: searchResults };
  }

  async searchSuggestions(
    suggestion: SearchSuggestionDTO,
    userId: string,
    workspaceId: string,
  ) {
    let users = [];
    let groups = [];
    let pages = [];

    const limit = suggestion?.limit || 10;
    const query = suggestion.query.toLowerCase().trim();

    if (suggestion.includeUsers) {
      const userQuery = this.db
        .selectFrom('users')
        .select(['id', 'name', 'email', 'avatarUrl'])
        .where('workspaceId', '=', workspaceId)
        .where('deletedAt', 'is', null)
        .where((eb) =>
          eb.or([
            eb(
              sql`LOWER(f_unaccent(users.name))`,
              'like',
              sql`LOWER(f_unaccent(${`%${query}%`}))`,
            ),
            eb(sql`users.email`, 'ilike', sql`f_unaccent(${`%${query}%`})`),
          ]),
        )
        .limit(limit);

      users = await userQuery.execute();
    }

    if (suggestion.includeGroups) {
      groups = await this.db
        .selectFrom('groups')
        .select(['id', 'name', 'description'])
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(groups.name))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('workspaceId', '=', workspaceId)
        .limit(limit)
        .execute();
    }

    if (suggestion.includePages) {
      let pageSearch = this.db
        .selectFrom('pages')
        .select(['id', 'slugId', 'title', 'icon', 'spaceId'])
        .select((eb) => this.pageRepo.withSpace(eb))
        .where((eb) =>
          eb(
            sql`LOWER(f_unaccent(pages.title))`,
            'like',
            sql`LOWER(f_unaccent(${`%${query}%`}))`,
          ),
        )
        .where('deletedAt', 'is', null)
        .where('workspaceId', '=', workspaceId)
        .limit(limit);

      // search all spaces the user has access to, prioritizing the current space
      const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);

      if (userSpaceIds?.length > 0) {
        pageSearch = pageSearch.where('spaceId', 'in', userSpaceIds);

        if (suggestion?.spaceId) {
          pageSearch = pageSearch.orderBy(
            sql`CASE WHEN pages."space_id" = ${suggestion.spaceId} THEN 0 ELSE 1 END`,
            'asc',
          );
        }

        pages = await pageSearch.execute();
      }

      // Filter by page-level permissions
      if (pages.length > 0) {
        const pageIds = pages.map((p) => p.id);
        const accessibleIds =
          await this.pagePermissionRepo.filterAccessiblePageIds({
            pageIds,
            userId,
          });
        const accessibleSet = new Set(accessibleIds);
        pages = pages.filter((p) => accessibleSet.has(p.id));
      }

      for (const page of pages) {
        const childPageId = page.id;
        const ancestors = await this.db
          .withRecursive('page_ancestors', (db) =>
            db
              .selectFrom('pages')
              .select([
                'id',
                'slugId',
                'title',
                'icon',
                'position',
                'parentPageId',
                'spaceId',
              ])
              .select((eb) => this.withHasChildren(eb))
              .where('id', '=', childPageId)
              .unionAll((exp) =>
                exp
                  .selectFrom('pages as p')
                  .select([
                    'p.id',
                    'p.slugId',
                    'p.title',
                    'p.icon',
                    'p.position',
                    'p.parentPageId',
                    'p.spaceId',
                  ])
                  .select(
                    exp
                      .selectFrom('pages as child')
                      .select((eb) =>
                        eb
                          .case()
                          .when(eb.fn.countAll(), '>', 0)
                          .then(true)
                          .else(false)
                          .end()
                          .as('count'),
                      )
                      .whereRef('child.parentPageId', '=', 'id')
                      .limit(1)
                      .as('hasChildren'),
                  )
                  //.select((eb) => this.withHasChildren(eb))
                  .innerJoin('page_ancestors as pa', 'pa.parentPageId', 'p.id'),
              ),
          )
          .selectFrom('page_ancestors')
          .selectAll()
          .execute();

          const breadcrumbs = ancestors.slice(1).reverse().map(p => p.title);
          page.breadcrumbs = breadcrumbs;
      }
    }

    return { users, groups, pages };
  }

  withHasChildren(eb: ExpressionBuilder<DB, 'pages'>) {
    return eb
      .selectFrom('pages as child')
      .select((eb) =>
        eb
          .case()
          .when(eb.fn.countAll(), '>', 0)
          .then(true)
          .else(false)
          .end()
          .as('count'),
      )
      .whereRef('child.parentPageId', '=', 'pages.id')
      .limit(1)
      .as('hasChildren');
  }
}
