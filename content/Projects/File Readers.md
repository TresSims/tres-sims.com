---
title:  'File Readers'
date: 2022-11-10
description: "A series of file formatters for Houdini"
thumbnail: /HoudiniFileReaders/thumbnail.png
---

<!--more-->

During my time developing workflows for DASH, I sometimes found that it was beneficial
to be able to custom roll my own file readers. Whether it was implementing cutting edge
file formats, patching features that I needed implemented in a spcific way, or accessing
 data from scientific formats that Houdini couldn't normally interface with I found that
 being able to reverse engineer the data in a specific file format was a handy skillset
to have.

## [3mf Reader](https://github.com/TresSims/HoudiniFileInterpreters)

{{< figure src="/HoudiniFileReaders/Read3MF.png" >}}

At one point, our company began using the .3mf file format, which went a long way
towards [improving our print job workflows](/software/standalone-3mf-packager). This was
 great, but it came with the issue of me not being able to open our packaged files. To
solve this problem, I wrote an interpreter, using Python, and the official Lib3MF libs,
to be able to open the mesh files so I could process them in Houdini.

## [NRRD Reader](https://github.com/TresSims/HoudiniFileInterpreters)

{{< figure src="/HoudiniFileReaders/ReadNRRD.png" >}}

Another example, many medical datasets are volume files, and the open source segmentation
program 3D slicer often saves label maps and volume data as "Nearly Raw Raster Data".
In order to do automatic segmentation, and leverage the procedural tools that Houdini
provides for other purposes, I created this tool to be able to interpret that data.

## [DICOM Reader and Processing](https://github.com/dash-orlando/Houdini-Medical-Toolset)

{{< figure src="/HoudiniFileReaders/DICOMToolset.png" >}}

Finally, I worked with another developer to create a whole toolset for creating fully
segmented 3D models from DICOM data input. For this, I created not only an importer for
DICOM stacks, but a set of shelf tools and nodes for processing the data and simulating
[custom medical devices](https://asmedigitalcollection.asme.org/BIOMED/proceedings/DMD2020/83549/V001T10A015/1085748)
 we were able to segment patinet anatomy, and create custom print ready geometry based
on the input data.

{{< youtube 5cdltnaSQmA >}}
