---
title:  'Meh: A Standalone 3MF Packager / Mesh Inspector'
date: 2022-07-05
description: "A tool for ensuring quality of 3D files and prints"
thumbnail: /meh/thumbnail.png
---

One interesting challenge I've run to ground was the need to have a way to communicate
build properties of multiple 3D files that would be manufactured as an assembly. The
slicing software that managed our printer did not, at the time, have great support for
mixing filies with multiple properties, e.g. filetypes, vertex color vs. textures, etc.
In order to make sure we were able to supply ready-to print files to the printer, and
not have to provide complicated print instructions, I made a tool that would allow you
to import your files that needed to be printed, as one of many standard files including,
.stl, .obj, and .ply, sort them by build priortiy, and apply the neccessary color
information to the files. That way, we didn't need to send long-winded explinations to
our tech about how the assembly was supposed to be built, all of that information was
neatly packaged in one file format.

Full disclosure, I can't take creadit for coming up with the file format, that credit
goes to the great folks at the [Lib3MF Consortium](), but since most of our tools, e.g.
Houdini, Z-Brush, and 3DS Max, were designed for render pipelines, not 3D printing ones,
 there were not any ways we could create these .3mf files natively in these tools.
Creating this standalone tool let us combine files that were made in different parts of
our pipeline together seamlessly, in a way that made their function was easily
understandible by other team members.

If this is a tool that seems like it would be useful to you, you can find it on my
[github](https://github.com/TresSims/meh).

{{< figure src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXp2YTMzd3hnbmlqM25sanR4MGEwbGp1Nm8yYWc4ZHdidGRiaGpndyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ifVMBx77Y80pLRt61r/giphy.gif" >}}
