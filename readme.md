# **EntECS**

**EntECS** is a lightweight, TypeScript first **Entity Component System** designed for simplicity, speed, and flexibility. It lets you easily create games, simulations, or interactive applications by organizing logic into reusable components and systems. With EntECS, adding, updating, and managing entities becomes intuitive, letting you focus on building features instead of boilerplate.

## Installation

To use in your project, run:

```
npm i entecs
```

## Simple Example

```typescript
import { ECS } from "entecs"

const ecs = new ECS()

class Position { x = 250; y = 250 }
class Velocity { dx = 0; dy = 0 }

const entity1 = ecs.createEntity()
ecs.addComponent(entity1, new Position())
ecs.addComponent(entity1, new Velocity())

function moveSystem(deltaTime: number, ecs: ECS) {
    const components = ecs.queryComponents([Position, Velocity])
    for (const [entityId, pos, vel] of components) {
        pos.x += vel.dx * deltaTime
        pos.y += vel.dy * deltaTime
    }
}
ecs.addSystem(moveSystem, 1)

ecs.update(1)
ecs.logDebugInfo()
```

## Features

* Typed component management
* Singleton component support
* Priority-based systems
* Event-driven engine notifications
* Efficient query caching
* Deferred removal
* Serialization for persistence

## Entities

In EntECS, entities are represented by an ID of type `number`. You can either create one entity at a time or multiple, as seen below:

```typescript
ecs.createEntity() // returns a single ID
ecs.createEntities(20) // returns 20 IDs
```

You can also delete entities with `removeEntity` optionally specifying whether you want deferred removal or instant removal. 
```typescript
ecs.removeEntity(entity1, false)
```
Note, entities and components are removed using a deferred removal system by default, meaning deletions are queued and processed safely after the current update cycle to prevent iteration conflicts.


## Components

Components are represented as classes with only attributes and can be added with the `addComponent` function.

```typescript
const ecs = new ECS()
const entity1 = ecs.createEntity()

class Position { x = 250; y = 250 }
class Velocity { dx = 0; dy = 0 }
class Acceleration { x = 0; y = 0 }

ecs.addComponent(entity1, new Position())
ecs.addComponent(entity1, new Velocity())
```

To get a specific component on a specific entity use `getComponent`

```typescript
ecs.getComponent(entity1, Position)
```

To get all components of a specific type use `getComponents`

```typescript
ecs.getComponents(Position)
```

For more advanced queries, you can use `queryComponents`, which lets you specify both the components that must and must not be present on entities. This method returns an array of tuples in the form [entityId, ...requiredComponents][]. The first parameter defines the components that must be present, while the second parameter lists those that must be absent.

```typescript
ecs.queryComponents([Position, Velocity], [Acceleration])
```

In this example, the query returns all entities that have both Position and Velocity components but do not have an Acceleration component.

#### Singleton Components

EntECS also has support for singleton components, which are components that can only ever have one instance active and are not attached to an entity. These components can be used for global state, such as keeping track of “total collisions between two entities” or “game difficulty.”

```typescript
class GameDifficulty { difficulty = 1.34 }

ecs.addSingletonComponent(new GameDifficulty())
ecs.getSingletonComponent(GameDifficulty)
ecs.removeSingletonComponent(GameDifficulty)
```

## Systems

In EntECS, systems take the form of functions with two input parameters, `deltaTime` and the calling ECS instance.

```typescript
function moveSystem(deltaTime: number, ecs: ECS) {
    const components = ecs.queryComponents([Position, Velocity])
    for (const [entityId, pos, vel] of components) {
        pos.x += vel.dx * deltaTime
        pos.y += vel.dy * deltaTime
    }
}
```

To create systems in a more declarative way, we can use the `createSystem` function.

```typescript
const moveSystem = ecs.createSystem({
    include: [Position, Velocity],
    exclude: [Acceleration],
    forEach: (deltaTime, ecs, include) => {
        const [entityId, pos, vel] = include
        pos.x += vel.dx * deltaTime
        pos.y += vel.dy * deltaTime
    }
})
```

The complete list of parameters accepted by `createSystem` is shown below:

```typescript
include: ComponentClass<any>[],
exclude?: ComponentClass<any>[],
singleton?: ComponentClass<any>[],
forEach: (deltaTime, ecs, includeTuple, singletonTuple?) => void
```

After creating a system we need to register it with the function `addSystem` which takes in two parameters, the system function and a priority number. The priority number determines the order systems are called in.

```typescript
ecs.addSystem(moveSystem, 1)
```

To call our systems, we can use the `update` function, passing in `deltaTime`.

```typescript
ecs.update(1)
```

## Serialization

EntECS supports serialization of component states into a JSON string.

```typescript
const jsonString = ecs.serialize()
```

To deserialize our JSON string we can call `deserialize` which takes in our JSON string and an array of all the components we wish to reconstruct. Note that EntECS assumes components have no methods and have constructors with no required arguments.

```typescript
ecs.deserialize(jsonString, [Position, Velocity, Acceleration])
```

## Events

#### User Events

To create custom events you first need to create a new class specifying the content of your event. You can then emit this event with `emit` and listen to it with `on`.

```typescript
class CollisionEvent{
    constructor(public id1: number, public id2: number){}
}

ecs.emit(new CollisionEvent(1, 2))

ecs.on(CollisionEvent, (event) => {
    console.log(`${event.id1} collided with ${event.id2}`)
})
```

Events can also be assigned a priority. However, this is off by default so it needs to be enabled first.

```typescript
ecs.enableEventPriority()
ecs.emit(new CollisionEvent(1, 2), 5)
```

#### Engine Events

You can listen to a variety of engine events using the `onEngineEvent` function and choose a specific event to listen to from the `engineEvents` object. Note that engine events are disabled by default and must be enabled first.

```typescript
ecs.enableEngineEvents()
ecs.onEngineEvent(ecs.engineEvents.CreateEntityEvent, (event) => {
    console.log(event.ids)
})
```
