# **entECS**
**entECS** is a lightweight, TypeScript-first **Entity Component System** designed for simplicity, speed, and flexibility. It lets you easily create games, simulations, or interactive applications by organizing logic into reusable components and systems. With entECS, adding, updating, and managing entities becomes intuitive, letting you focus on building features instead of boilerplate.

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
- Typed component management  
- Singleton component support  
- Priority-based systems  
- Event-driven engine notifications  
- Efficient query caching  
- Deferred removal  
- Serialization for persistence  

## Entities
In entECS, entities are represented by an ID of type `number`. You can either create one entity at a time or multiple, as seen below:
```typescript
ecs.createEntity() // returns a single ID
ecs.createEntities(20) // returns 20 IDs
```
You can also delete entities and specify if you want deferred removal or instant removal. Deferred removal will wait until `ecs.update()` is called before deleting an entity.
```typescript
ecs.removeEntity(entity1, true)
```

## Components
Components are represented as classes with only attributes and can be added to entities and queried in a variety of ways.
```typescript
const ecs = new ECS()
const entity1 = ecs.createEntity()

class Position { x = 250; y = 250 }
class Velocity { dx = 0; dy = 0 }
class Acceleration { x = 0; y = 0 }

ecs.addComponent(entity1, new Position())
ecs.addComponent(entity1, new Velocity())

// Gets a specific component on a specific entity
ecs.getComponent(entity1, Position)

// Gets all components of a certain type
ecs.getComponents(Position)

/* Returns all entities and the selected components for which an entity
has a Position and Velocity component but NOT an Acceleration component.
Returned as [EntityID, Position, Velocity][]

The first array specifies components that must be present.
The second array specifies components that must not be present.
*/
ecs.queryComponents([Position, Velocity], [Acceleration])

// Removes a specific component from an entity
ecs.removeComponent(entity1, Position)
```

EntECS also has support for singleton components, which are components that can only ever have one instance active and are not attached to an entity. These components can be used for global state, such as keeping track of “total collisions between two entities” or “game difficulty.”
```typescript
class GameDifficulty { difficulty = 1.34 }

ecs.addSingletonComponent(new GameDifficulty())
ecs.getSingletonComponent(GameDifficulty)
ecs.removeSingletonComponent(GameDifficulty)
```

## Systems
In entECS, systems take the form of functions with two input parameters — `deltaTime` and the calling ECS instance. To create systems in a more declarative way, we can also use the `createSystem` function.
```typescript
function moveSystem(deltaTime: number, ecs: ECS) {
    const components = ecs.queryComponents([Position, Velocity])
    for (const [entityId, pos, vel] of components) {
        pos.x += vel.dx * deltaTime
        pos.y += vel.dy * deltaTime
    }
}
ecs.addSystem(moveSystem, 1)

//==========Or==========

ecs.addSystem(ecs.createSystem({
    include: [Position, Velocity],
    forEach: (deltaTime, ecs, include) => {
        const [entityId, pos, vel] = include
        pos.x += vel.dx * deltaTime
        pos.y += vel.dy * deltaTime
    }
}), 1)
```
Note the second parameter of the `addSystem` function is the priority of the system, which determines the order systems are called in. To call our systems, we can use the `update` function, passing in `deltaTime`.
```typescript
ecs.update(1)
```

## Serialization
EntECS supports serialization of component states into JSON strings. Note that EntECS assumes components have no methods and have constructors with no required arguments.
```typescript
const jsonString = ecs.serialize()
// Note: we need to pass in all components that were serialized so EntECS 
// can create new instances
ecs.deserialize(jsonString, [Position, Velocity, Acceleration])
```
