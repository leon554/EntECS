
type EventType<T> = new (...args: any[]) => T
type EventCallBack<T> = ((event: T) => void)

export class EventBus{
    private listeners = new Map<EventType<any>, EventCallBack<any>[]>()
    private events: {eventInstance: any, priority: number}[] = []
    enableEventPriority: boolean = false

    on<T>(eventClass: EventType<T>, callBack: EventCallBack<T>){
        if(!this.listeners.has(eventClass)){
            this.listeners.set(eventClass, [])
        }
        this.listeners.get(eventClass)?.push(callBack)
        console.log(this.listeners.get(eventClass)?.length)
    }

    emit<T>(eventInstance: T, priority: number = 1){
        this.events.push({eventInstance, priority})
    }

    dispatch(){
        if(this.enableEventPriority){
            this.events.sort((a, b) => b.priority - a.priority)
        }
        for(const event of this.events){
            const eventClass = event.eventInstance.constructor
            const callbacks = this.listeners.get(eventClass)
            if(!callbacks) continue
            for(const callback of callbacks){
                callback(event.eventInstance)
            }
        }
        this.events.length = 0
    }

    clear(){
        this.listeners.clear()
        this.events.length = 0
    }

    printDebug(){
        console.groupCollapsed("Events")
        for(const [key, value] of this.listeners.entries()){
            console.log("Event: [" + key.name + "] Listeners [" + value?.length + "]")
        }
        console.groupEnd()
    }
}