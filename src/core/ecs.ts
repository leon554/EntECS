import { EventBus } from "./eventBus";
import { SparseSet } from "./sparseSet";
import { EntityIdManager } from "./entityIdManager";

export type EntityId = number
export type SystemFunc = (deltaTime: number, ecs: ECS) => void
export type ComponentClass<T> = new (...args: any[]) => T
export type System = {
    system: SystemFunc
    priority: number
    name: string
}
export interface SystemBuilder<T extends any[], E extends any[] = [], S extends any[] = []> {
    include: { [K in keyof T]: ComponentClass<T[K]> };
    exclude?: { [K in keyof E]: ComponentClass<E[K]> };
    singleton?: { [K in keyof S]: ComponentClass<S[K]> };

    forEach:(
            deltaTime: number, 
            ecs: ECS,
            include: [number, ...T],
            singleton?: [...S]
        ) => void;
}

export class ECS{
    private idManager = new EntityIdManager()
    private componentStores = new Map<Function, SparseSet<any>>();
    private cache = new Map<string, [EntityId, ...any][]>()
    private singletonComponents = new Map<Function, any>()
    private systems: System[] = []

    private eventBus = new EventBus()
    on = this.eventBus.on.bind(this.eventBus);
    emit = this.eventBus.emit.bind(this.eventBus);

    private engineEventBus = new EventBus()
    onEngineEvent = this.engineEventBus.on.bind(this.engineEventBus)
    private emitEngineEvent = this.engineEventBus.emit.bind(this.engineEventBus)

    private toBeRemoved: {entityId: number, componentClass: new (...args: any[]) => any}[] = []
    private toBeDeleted: EntityId[] = []
    private engineEventsEnabled: boolean = false

    public readonly engineEvents = {
        CreateEntityEvent,
        AddComponentEvent,
        AddSingletonComponentEvent,
        RemoveSingletonComponentEvent,
        RemoveComponentEvent,
        RemoveEntityEvent
    }

    createEntity(): EntityId {
        const id = this.idManager.getNewId()
        this.engineEventsEnabled && this.emitAndDispatchEvent(new CreateEntityEvent([id]))
        return id
    }

    createEntities(amount: number): EntityId[] {
       const ids =  new Array(amount).fill(0).map(() => this.idManager.getNewId())
       this.engineEventsEnabled && this.emitAndDispatchEvent(new CreateEntityEvent(ids))
       return ids
    }

    private getComponentStore<T>(componentClass: new (...args: any[]) => T): SparseSet<T> {
        let store =  this.componentStores.get(componentClass);
        if (!store) {
            const newStore = new SparseSet<T>()
            this.componentStores.set(componentClass, newStore);
            return newStore
        }
        return store
    }

    addComponent<T extends object>(entityId: EntityId,  componentInstance: T) {
        const store = this.getComponentStore(componentInstance.constructor as ComponentClass<T>);
        store.add(entityId, componentInstance);
        this.engineEventsEnabled && this.emitAndDispatchEvent(new AddComponentEvent(entityId, componentInstance))
        this.invalidateCache()
    }
    addSingletonComponent<T extends object>(componentInstance: T){
        this.singletonComponents.set(componentInstance.constructor, componentInstance)
        this.engineEventsEnabled && this.emitAndDispatchEvent(new AddSingletonComponentEvent(componentInstance))
        this.invalidateCache()
    }
    getSingletonComponent<T>(componentClass: new (...args: any[]) => T): T{
       return this.singletonComponents.get(componentClass)
    }
    removeSingletonComponent<T>(componentClass: new (...args: any[]) => T){
        this.engineEventsEnabled && this.emitAndDispatchEvent(new RemoveSingletonComponentEvent(componentClass))
        this.singletonComponents.delete(componentClass)
    }

    getComponent<T>(entityId: EntityId, componentClass: new (...args: any[]) => T): T | null {
        const instance = this.getComponentStore(componentClass).get(entityId)
        if(!instance) return null
        return instance
    }

    hasComponent<T>(entity: EntityId, componentClass: new (...args: any[]) => T): boolean {
        return this.componentStores.get(componentClass)?.has(entity) ?? false;
    }

    removeComponent<T>(entityId: EntityId, componentClass: new (...args: any[]) => T, deferredRemoval: boolean = true) {
        this.engineEventsEnabled && this.emitAndDispatchEvent(new RemoveComponentEvent(entityId, componentClass, deferredRemoval))
        if(deferredRemoval){
            this.toBeRemoved.push({entityId: entityId, componentClass: componentClass})
        }else{
            this.componentStores.get(componentClass)?.remove(entityId);
            this.invalidateCache()
        }
    }
    removeEntity(entityId: EntityId, deferredRemoval: boolean = true){
        this.engineEventsEnabled && this.emitAndDispatchEvent(new RemoveEntityEvent(entityId, deferredRemoval))
        if(deferredRemoval) {this.toBeDeleted.push(entityId); return}
        for(const store of Array.from(this.componentStores.values())){
            if(!store.has(entityId)) continue
            store.remove(entityId)
            this.invalidateCache()
        }
        this.idManager.recycleUsedId(entityId)
    }

    queryComponents<T extends any[], E extends any[] = []>(
        includeClasses: { [K in keyof T]: ComponentClass<T[K]> },
        excludeClasses?: { [K in keyof E]: ComponentClass<E[K]> }
    ): [EntityId, ...T][] {

        if (includeClasses.length === 0) return [];
        const requiredComps = includeClasses as ComponentClass<any>[];
        const excludedComps = (excludeClasses as ComponentClass<any>[]) || [];

        const key = requiredComps.map(c => c.name).join("|") + "|" +excludedComps.map(c => c.name).join(":");
        const cached = this.cache.get(key);
        if (cached) return cached as [EntityId, ...T][];

        const requiredStores: SparseSet<any>[] = []
        for(const c of requiredComps){
            const store = this.componentStores.get(c)
            if(!store) return[]
            requiredStores.push(store)
        }
        const smallestStore = requiredStores.reduce((a, b) => (a.keys.length < b.keys.length ? a : b));

        const results: [EntityId, ...T][] = [];

        for (const entityId of smallestStore.keys()) {
            const comps = new Array(requiredComps.length) as T;
            let valid = true;

            for (let i = 0; i < requiredComps.length; i++) {
                const comp = this.getComponent(entityId, requiredComps[i]);
                if (comp == null) {
                    valid = false;
                    break;
                }
                comps[i] = comp;
            }
            if (!valid) continue;

            for (let i = 0; i < excludedComps.length; i++) {
                if (!this.hasComponent(entityId, excludedComps[i])) continue
                valid = false;
                break;
            }

            if (!valid) continue;
            results.push([entityId, ...comps]);
        }

        this.cache.set(key, results)
        return results;
    }

    getComponents<T>(className: new (...args: any) => T): T[]{
        return this.getComponentStore(className).values()
    }
    getComponentsForEntity(entityId: EntityId){
        const components: Function[] = []
        for(const store of Array.from(this.componentStores.values())){
            if(!store.has(entityId)) continue
            components.push(store.get(entityId))
        }
        return components
    }


    addSystem(system: SystemFunc, priority: number, name?: string){
        this.systems.push({system, priority, name: name ?? "Un-Named"})
        this.systems.sort((a, b) =>  b.priority - a.priority)
    }
    createSystem< T extends any[], E extends any[] = [], S extends any[] = []>(builder: SystemBuilder<T, E, S>){
        return (deltaTime: number, ecs: ECS) => {
            const query = this.queryComponents(builder.include, builder.exclude)
            const singletons = builder.singleton?.map(s => this.getSingletonComponent(s))
            for(const record of query){
                if(singletons){
                    builder.forEach(deltaTime, ecs, record, singletons  as [...S])
            
                }else{
                    builder.forEach(deltaTime, ecs, record)
                }
            }
        }
    }

    update(deltaTime: number = 0){
        for(const system of this.systems){
            system.system(deltaTime, this)
        }
        for(const item of this.toBeRemoved){
            this.removeComponent(item.entityId, item.componentClass, false)
        }
        for(const id of this.toBeDeleted){
            this.removeEntity(id, false)
        }
        this.toBeRemoved.length = 0
        this.toBeDeleted.length = 0

        this.eventBus.dispatch()
    }

    
    enableEventPriority(){
        this.eventBus.enableEventPriority = true
    }
    disableEventPriority(){
        this.eventBus.enableEventPriority = false
    }
    enableEngineEvents(){
        this.engineEventsEnabled = true
    }
    disableEngineEvents(){
        this.engineEventsEnabled = false
    }

    private invalidateCache(){
        this.cache.clear()
    }
    private emitAndDispatchEvent<T>(eventInstance: T){
        this.emitEngineEvent(eventInstance, 0)
        this.engineEventBus.dispatch()
    }
    private claimEntityId(id: EntityId){
        const result = this.idManager.getSpecificId(id)
        if(result.clash) console.warn("Id clash, requested Id is already in use")
        return result
    }


    serialize(){
        let outputComponents: {[key: string] : any} = {}
        let outputSingletons:  {[key: string] : any} = {}

        for(const [className, sparseSet] of this.componentStores){
            outputComponents[className.name] = sparseSet.entries()
        }
        for(const [className, instance] of this.singletonComponents.entries()){
            outputSingletons[className.name] = instance
        }
        return JSON.stringify({outputComponents, outputSingletons})
    }

    deserialize(data: string, classes: ComponentClass<any>[]){
        const dataObj = JSON.parse(data)
        const componentObj = dataObj.outputComponents
        const singletonsObj = dataObj.outputSingletons

        const ids = new Set<number>()
        const compMap = new Map(classes.map(c => [c.name, c]))
        const getComponentClass = (className: string) => {
            const componentClass = compMap.get(className);
            if (!componentClass) console.warn(`Component class not found for ${className}, skipping.`);
            return componentClass
        }

        for(const [className, components] of Object.entries(componentObj)){
            for(const [id, compObj] of (components as any[])){
                const componentClass = getComponentClass(className)
                if(!componentClass) continue

                const instance = new componentClass()
                const obj = Object.assign(instance, compObj)
                this.addComponent(id, obj)

                if(ids.has(id)) continue
                this.claimEntityId(id); 
                ids.add(id)
            }
        }
        for(const [className, singletonObj] of Object.entries(singletonsObj)){
            const componentClass = getComponentClass(className) 
            if(!componentClass) continue

            const instance = new componentClass()
            const obj = Object.assign(instance, singletonObj)
            this.addSingletonComponent(obj) 
        }
    }



    logDebugInfo(showAllInfo: boolean = false){
        const loopCounts = {entityCount: 0}
        console.group("%cECS Debug Info", "color: #4CAF50; font-weight: bold;");
        
        console.groupCollapsed("%cEntities", "color: #F3F924;");
        for (const id of this.idManager.getActiveIds()) {
            const components = this.getComponentsForEntity(id)
            console.groupCollapsed("Entity " + id + " Components");
            console.log(components)
            console.groupEnd()
            loopCounts.entityCount++
            if(!showAllInfo && loopCounts.entityCount > 100) {
                console.log("Set show all to true to see remaining entities")
                break
            }
        }
        console.groupEnd();

        console.groupCollapsed("%cSingleton Components", "color: #FFB300;");
        const singletons = Array.from(this.singletonComponents.keys()).map(k => k.name);
        console.log(singletons.length ? singletons.join(", ") : "None");
        console.groupEnd();

        console.groupCollapsed("%cComponents", "color: #03A9F4;");
        for (const [key, store] of this.componentStores) {
            const entities = [...store.keys()].join(", ");
            console.log(`%c${key.name}`, "color: #2196F3; font-weight: bold;", `→ [${entities || "None"}]`);
        }
        console.groupEnd();

        console.groupCollapsed("%cComponents To Be Removed", "color: #E91E13;");
        if (this.toBeRemoved.length === 0) {
            console.log("None");
        } else {
            for(const component of this.toBeRemoved){ 
                console.log("[" + component.componentClass.name + "] to be deleted from entity [" + component.entityId + "]" ) 
            }
        }
        console.groupEnd();
        console.groupCollapsed("%cEntities To Be Removed", "color: #E91E13;");
        if (this.toBeDeleted.length === 0) {
            console.log("None");
        } else {
            console.log("id: " + this.toBeDeleted.join(", id: "))
        }
        console.groupEnd();

        console.groupCollapsed("%cSystems", "color: #8BC34A;");
        if (this.systems.length === 0) {
            console.log("None");
        } else {
            console.log(this.systems.map(s => `[${s.name} p(${s.priority})]`).join(", "))
        }
        console.groupEnd();

        this.eventBus.printDebug()

        console.groupCollapsed("%cCached Archetypes", "color: #8BC34A;");
        if (this.cache.size == 0) {
            console.log("No Cache");
        } else {
            console.log(Array.from(this.cache.entries()).map(v => `[${v[0]}] ${v[1].length} entities cached`))
        }
        console.groupEnd();

        console.groupEnd();
        

    }
}


class CreateEntityEvent{
    constructor(public ids: EntityId[]){}
}
class AddComponentEvent<T>{
    constructor(public id: EntityId, public componentInstance: T){}
}
class AddSingletonComponentEvent<T>{
    constructor(public componentInstance: T){}
}
class RemoveSingletonComponentEvent<T>{
    constructor(public componentClass: ComponentClass<T>){}
}
class RemoveComponentEvent<T>{
    constructor(public entityId: EntityId, public componentClass: ComponentClass<T>, public deferredRemoval: boolean){}
}
class RemoveEntityEvent{
    constructor(public entityId: EntityId, public deferredRemoval: boolean){}
}