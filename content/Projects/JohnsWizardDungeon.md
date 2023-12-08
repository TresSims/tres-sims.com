---
title: "John's Wizard Dungeon"
date: 2019-05-19
thumbnail: /WizardDungeon/thumbnail.png
description: "A VR escape room I helped develop, and published on Steam"
---

I am a published game developer! Wow, it feels good to be able to say that. In my final 
semester at UCF, I led a team of four to design, develop, and publish a VR escape game 
on Steam. We wanted to tell the story of a plucky thief who wanted to steal the Elixir 
of Life from the Wizard, John, who had locked in his dungeon. Check out our trailer, 
then I'll go over more detail on my role in the project.

{{< youtube pomFi1FPQ5Q >}}

For this project, I was the team leader and technical artist, though I handled pretty 
much every technical aspect of making the game. For this project I implemented the game 
mechanics using Blueprints inside of unreal engine, created the Visual Effects, and 
designed a tool for scattering stacks of magical tomes in the scene, without having to 
place them by hand. And huge thanks to the team that made this project possible, I 
would never have been able to accomplish this without the help of my amazing support 
team, Stephanie Hernandez, [Kimberly Heidues](https://kheidhues.wixsite.com/distancedimension), 
[Renee Ryckman](https://reneeryckmanart.myportfolio.com/), 
[Alexander Keltz](https://alexkeltz.weebly.com/), and 
[Aria Taylor](https://aricodes.net/).

## Gameplay

The gameplay for the game was relatively straightforward. Since we didn't have a team 
member dedicated to designing unique mechanics for the game, and only had a few months 
to develop the whole expereience, I wanted to focus on making simple puzzles, that 
encouraged people to interact with the wonderful asssets that were designed by the art 
team. To that end, I designed puzzles based on hiding the components to the door combo 
in different props around the room. One was hidden under a stack of physics objects that 
you would get to dig through, one was hidden inside of a chest that the player could 
interact with and open, and the final one was hidden in plain sight inside of a birdcage 
that could only be opened if you were able to find the key hidden at the bottom of a 
bubbling cauldron. And just to keep things fun, I added a furnace full of lava that you 
could feed logs to produce a puff of smoke. It was a red-herring of sorts, enticing the 
players to interact with the element, even though it didn't have any correlation to the 
puzzles at all. 

To keep the game a challenge, we set a time limit of 5 minutes. To get to that number, 
We had many of our classmates and friends playtest the game to get a feel for how long 
it took to solve the puzzles, and found that most players were able to find all of the 
components, and win the game in 4 - 8 minutes. Since we wanted this to be a challenge, 
we set the timer to a speed that would allow the player to solve most of the puzzle in 
one run, or completely solve it if you were very objective oriented, but ultimately 
require two attempts to completely solve for most players. This had the added bonus of 
taking the stress of the player and let them explore the environment a little bit more 
in the second run.

## Visual Effects

I was lucky enough to be able to work on the VFX for this game as well as the gameplay 
design and mechanics. For this game, I made four different systems to breathe life into 
the world, including a burning log effect, a candle, and a magic spell effect, that 
served to inform the player about how long they had left in game. 

{{< youtube J0rJNc99qUk >}}

{{< youtube Dy4KE-D7NdM >}}

{{< youtube q9Si622PdkQ >}}

## Book Distribution Tool

Another part of this project was a tool I created for distributing meshes in linear 
stacks. The main use for this tool was to be able to create messy piles of books, to 
make the scene seem like the study of a disorganized scholar. 

{{< figure src="/WizardDungeon/StackedBooks1.png" >}}

This was important for the game, because we wanted to give the appearance that room was 
inhabited by something of a disorganized scholar. Another requirement was that all of 
the tomes should be interactable since in a VR game a big part of the fun is being able 
to pick things up and move them around, so we couldn't just create full stacks as one 
mesh. 

To solve this problem, I created an actor that could be placed in the editor, and had 
some paramteres that we could edit, to tune the messiness based on where the books were 
being distributed. 

{{< figure src="/WizardDungeon/BookToolControls.png" >}}

This let you choose which actors you wanted to place in the world, and how disorganized 
you want them to be stacked. From there, you line up the actor in the position and 
orientation you want the actors to be distributed in your world, which is guided by a 
handy arrow tool that is displayed in the editor. 

{{< figure src="/WizardDungeon/StackedBookGuide1.png" >}}
{{< figure src="/WizardDungeon/StackedBooks2.png" >}}

{{< figure src="/WizardDungeon/StackedBookGuide2.png" >}}
{{< figure src="/WizardDungeon/StackedBooks3.png" >}}

It's a simple set up, but it helped a ton with design efficiency as I was trying to 
figure out where I wanted to place stacks of books, how high I could stack them, and it 
helped me to design the look of the room with ease. 

If you want to try and implement something like this in your own game, my final 
blueprint graph is below.

{{< figure src="/WizardDungeon/ToolGraph.png" >}}