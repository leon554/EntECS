
export class EntityIdManager{
    private nextEntityId = 0;
    private activeIds = new Set<number>()
    private idsToReuse: number[] = []

    getNewId() {
        while (this.idsToReuse.length > 0) {
            const reusedId = this.idsToReuse.pop()!;
            if (this.activeIds.has(reusedId)) continue
            this.activeIds.add(reusedId);
            return reusedId;
        }

        while (this.activeIds.has(this.nextEntityId)) {
            this.nextEntityId++;
        }

        const id = this.nextEntityId++;
        this.activeIds.add(id);
        return id;
    }

    getSpecificId(id: number){
        let clash = false
        if(this.activeIds.has(id)) clash = true
        this.activeIds.add(id)
        return {id, clash}
    }

    recycleUsedId(id: number){
        this.activeIds.delete(id)
        this.idsToReuse.push(id)
    }

    getActiveIds(){
        return Array.from(this.activeIds.keys())
    }
}
