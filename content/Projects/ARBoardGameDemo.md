---
title: 'AR Board Game Demo'
date: 2018-12-06
thumbnail: /ARBoardGameDemo/thumbnail.png
description: "As a part of my senior project at UCF, I created a demo of an AR board game, 
including all of the modeling, texturing, and a system for tiling map parts."
---


As a part of my senior project at UCF, I craeted a demo using AR to augment the board 
game [Betrayal At House On the Hill](https://www.avalonhill.com/en-us/product/avalon-hill-betrayal-at-house-on-the-hill-second-edition-cooperative-board-game-for-ages-12-and-up-for-3-6-players:8450F69A-05BE-4BB2-8146-EBCE86E4C868).
I've always enjoyed gaming of both the digital and phyiscal variety, and was excited 
about the opportunity to bring a digital twist to one of my favorite board games. 

As a part of this project, I created digital recreations of several of the room tiles, 
created an AR tracking on the game parts in Unity 3D, using [Vuforia](https://www.ptc.com/en/products/vuforia)
 to handle the minutia of the AR, and created a tool to allow me to snap the digital 
 tiles together, to help optimize the AR tracking elements of the project. 

{{< youtube hd-nzGTWGQc>}}


## 3D Models (Autodesk Maya, Substance Designer, and Substance Painter)

When I started working on assets for this project, I knew one thing for sure: I would 
want to be able to re-use as much of my work as possible. Betrayal has dozens of uniquie 
room tiles, and even though I was only planning to make a demo, with a handful of these 
rooms, I knew that I wanted to have a few room models templates that I could re-use, and 
I wanted to have some materials that I could use in substance painter that I could use 
to paint each room uniquely, and still let me have a consistent overall style. 

For the rooms, I started off creating two template rooms, one with a wainscoting on the 
lower half, and one without. These would server as the templates that I could then 
texture as many different ways as I could come up with, and would cover 75% of the rooms. 
I also needed to create a few "hero" rooms, where the card art doesn't fit the 
description of "box" or "box with extra extrusion". 

{{< figure src="/ARBoardGameDemo/RoomModels.png" >}}

After that I made a bunch of props that would be used to fill in the rooms, and add life 
and story to the scene. 

{{< figure src="/ARBoardGameDemo/PropModels.png" >}}


Once I had some models, I needed to *design* some *substances* to *paint* onto my models. 
(see what I did there?) I wanted to create something that was stylized, to fit with the 
painted aesthetic of the game, and ended up creating three materials that I would use as 
a base to paint over in Substance Painter. To make them more flexible, I also wanted to 
set up a series of controls that would allow me to tweak the design in Substance Painter 
so that I could re-use the setup, and have lots of different effects, while maintaining 
a consistent style. 

{{< youtube 99GlTcN0WmI >}}

{{< youtube u7V_nSdU7d0 >}}

{{< youtube 6lId0gLU7lM >}}

Once I had completed all of these, it was pretty simple to import them into Substance 
Painter as smart materials, and create an awesome variety of rooms and props for 
bringing the game to life. 

{{< figure src="/ARBoardGameDemo/MainLandingInEngine.png" >}}

{{< figure src="/ARBoardGameDemo/BasementLandingInEngine.png" >}}

{{< figure src="/ARBoardGameDemo/UpperLandingInEngine.png" >}}

{{< figure src="/ARBoardGameDemo/RoofLandingInEngine.png" >}}


## Implementation (Unity 3D)

When it was finally time to put all of this together, I ended up using Vuforia to handle 
the AR implementation. It's a great framework, has great tools for managing AR scenes 
and multiple types of tracking. For my project, I made use of the image target tracking, 
and the tiles from the game made great tracking targets!

{{< figure src="/ARBoardGameDemo/BoardGameTiles.png" >}}

The real challenge of this for me, was coming up with a long term solution for managing 
multiple game tiles in way that wouldn't bog down vuforia. Basically, the more image 
targets the system has to keep track of at once, it starts to slow down as they all take 
up more and more processing cycles. Since this game would often have dozens of targets 
on the board at any point in time, I wanted a way to consolidate what the engine had to 
look for.

To solve this problem, I set up a tool that would allow the tiles to snap to one of the 
root tiles for the game. Once they were attached, the engine could stop tracking those 
targets, and just focus on the four root tiles from the game. When I implemented this, 
I set up a base Tile object that would know if it was a root tile, and if it had 
openings on the North, South, East and West borders of the card, which could be 
specified in the Unity editor. 

{{< figure src="/ARBoardGameDemo/TileOptions.png" >}}

From there, the root tiles would create colliders on any direction that featured a door, 
and when a new room object collided with that tile, it would find out the orientation of 
the new tile, attach it to the socket in that direction, let the new tile know which of 
its sockets was being used for the tile it was connecting to, and instruct it to set up 
new colliders for the doors on the new room that weren't already occupied. 

I thought it was a clever solution that would help streamlime the performance of the 
system. It also had an added gameplay benefit of remembering what piece goes where after  
your cat jumps on the table during game night, because you aren't paying him enough 
attention.