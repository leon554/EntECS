import type { EntityId } from "./ecs";

export class SparseSet<T> {
    private sparse: number[] = [];
    private dense: EntityId[] = [];
    private components: T[] = [];

    has(entityId: EntityId): boolean {
        const index = this.sparse[entityId];
        return index !== undefined && this.dense[index] === entityId;
    }

    get(entityId: EntityId): T | undefined {
        const index = this.sparse[entityId];
        return index !== undefined ? this.components[index] : undefined;
    }

    add(entityId: EntityId, component: T) {
        if (this.has(entityId)) return;
        const index = this.dense.length;
        this.sparse[entityId] = index;
        this.dense.push(entityId);
        this.components.push(component);
    }

    remove(entityId: EntityId) {
        if (!this.has(entityId)) return;

        const index = this.sparse[entityId];
        const lastIndex = this.dense.length - 1;
        const lastEntityId = this.dense[lastIndex];
        const lastComponent = this.components[lastIndex];

        this.dense[index] = lastEntityId;
        this.components[index] = lastComponent;
        this.sparse[lastEntityId] = index;

        this.dense.pop();
        this.components.pop();
        delete this.sparse[entityId];
    }

    entries(): [EntityId, T][] {
        const result: [EntityId, T][] = [];
        for (let i = 0; i < this.dense.length; i++) {
            result.push([this.dense[i], this.components[i]]);
        }
        return result;
    }

    keys(): EntityId[]{
        return this.dense;
    }
    values(): T[]{
        return this.components
    }

}