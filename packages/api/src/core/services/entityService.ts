import {
  EntityDefinition,
  GetEntitiesResponse,
  DatabaseAdapter,
  NotFoundException,
  InternalServerException,
} from '../types';

export interface EntityServiceDependencies {
  db: DatabaseAdapter;
}

export class EntityService {
  private db: DatabaseAdapter;

  constructor(deps: EntityServiceDependencies) {
    this.db = deps.db;
  }

  /**
   * Get all available entities
   */
  async getEntities(includeSpecCount: boolean = false): Promise<GetEntitiesResponse> {
    try {
      const query = {
        select: ['id', 'name', 'description', 'table_name', 'created_at', 'updated_at'],
        orderBy: [{ field: 'name', direction: 'asc' as const }],
      };

      const results = await this.db.find('dataspec_entities', query);

      let entities: EntityDefinition[] = results.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          name: r.name as string,
          description: r.description as string | undefined,
          table: r.table_name as string,
          createdAt: new Date(r.created_at as string),
          updatedAt: new Date(r.updated_at as string),
        };
      });

      if (includeSpecCount) {
        entities = await this.enrichWithSpecCounts(entities);
      }

      return {
        entities,
        total: entities.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to fetch entities: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a single entity by ID
   */
  async getEntityById(entityId: string): Promise<EntityDefinition> {
    try {
      const result = await this.db.findOne('dataspec_entities', {
        filters: [{ field: 'id', operator: 'eq', value: entityId }],
      });

      if (!result) {
        throw new NotFoundException('Entity', entityId);
      }

      const r = result as Record<string, unknown>;
      return {
        id: r.id as string,
        name: r.name as string,
        description: r.description as string | undefined,
        table: r.table_name as string,
        createdAt: new Date(r.created_at as string),
        updatedAt: new Date(r.updated_at as string),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to fetch entity: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if entity exists
   */
  async entityExists(entityId: string): Promise<boolean> {
    try {
      const result = await this.db.findOne('dataspec_entities', {
        select: ['id'],
        filters: [{ field: 'id', operator: 'eq', value: entityId }],
      });
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Enrich entities with spec counts
   */
  private async enrichWithSpecCounts(entities: EntityDefinition[]): Promise<EntityDefinition[]> {
    const enriched: EntityDefinition[] = [];

    for (const entity of entities) {
      try {
        const specs = await this.db.find('dataspec_definitions', {
          select: ['id'],
          filters: [
            { field: 'entity_id', operator: 'eq', value: entity.id },
            { field: 'is_active', operator: 'eq', value: true },
          ],
        });

        enriched.push({
          ...entity,
          specCount: specs.length,
        });
      } catch {
        enriched.push({
          ...entity,
          specCount: 0,
        });
      }
    }

    return enriched;
  }
}
