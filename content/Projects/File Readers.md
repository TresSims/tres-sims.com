---
title: 'Compatibility Plugins for Cutting-Edge Mesh and Volume File Formats with Python'
date: 2022-11-10
description: "Sometimes, being on the cutting edge means interpreting file data in a custom way."
thumbnail: /HoudiniFileReaders/thumbnail.png
---

During my time developing software for DASH, I occasionally found the need to write my 
own file interpreters. We used several file formats that were super cutting edge, that 
our engineering tools and web application packages didn't have support for yet. In these 
cases I would need to write custom software to import the files into the software or 
environment. 

## [3mf and NRRD Readers for Houdini](https://github.com/TresSims/HoudiniFileInterpreters)

One of the engineering tools that we used frequently was Houdini, a procedural DCC tool 
designed for the film and VFX industry. Since it was designed for film and VFX it didn't 
always have the built-in capability to import certain volume and 3D printing formats. 

What it did have, was a fantastic python API that allowed me to create custom nodes that 
would support the data that was needed. Using available python libraries I was able to 
implement full file compatibility into Houdini. 

If you're just looking to use these tools, the title also serves as a link to the 
repository which has Houdini .otls of the source code ready to install, as well as 
instructions. If you're interested in how I worked through processing and interpreting 
the files, read on!

### 3mf File Reader

The .3mf file format is short for '3D Manufacturing Format'. It's designed to hold all 
of the information needed to 3D print a full tray of complex parts, including support 
for part duplication, color, texture, and priority. Supporting this file format makes 3D 
printing much easier, so let's implement it in Houdini. 

Fortunately, the lib3mf consortium has bindings available for Python in a `lib3mf` 
package. Awesome! However, you have to load their binary at runtime, which is less fun. 
Fortunately, I can just have the use point to the location of the binary for their 
operating system and the file they want loaded using Houdini's built in UI tools, so I 
started there. 

{{< figure src="/HoudiniFileReaders/Read3MF.png" >}}

Once I had all of the inputs I knew I wanted to grab from the user, I started building 
out the actual logic to read the files. First, we wanted to make sure the user has 
actually provided all the information we need, and if not, we want to remind them that 
the program can't run without their input.

```Python
file = digital_asset_node.parm("file").eval()
wrapper_location = digital_asset_node.parm("wrapper").eval()

file_exists = wrapper_exists = False

if os.path.isfile(file):
    file_exists = True
elif file != "":
    raise hou.Error("Specified file does not exist")

if os.path.exists(wrapper_location):
    system = platform.system()
    if system == "Linux":
        wrapper_file_name = "lib3mf.so"
    elif system == "Windows":
        wrapper_file_name = "lib3mf.dll"

    wrapper_file = os.path.join(wrapper_location, wrapper_file_name)
    if os.path.isfile(wrapper_file):
        wrapper_exists = True

if file_exists and wrapper_exists:
    import_3mf(file, wrapper_file)
```

This checks for the existance of a file to import, and if the wrapper exists for their 
correct operating system. Finally, once all of those conditions are met, we can actually 
start importing the file.

```Python
def import_3mf(file, wrapper_file):
    # Flags for the types of data contained in the file
    cd = False
    uv = False

    # Boiler plate information to load the 3mf file into their library
    wrapper_object = ".".join(wrapper_file.split(".")[:-1])
    wrapper = Lib3MF.Wrapper(wrapper_object)

    model = wrapper.CreateModel()

    reader = model.QueryReader("3mf")
    reader.SetStrictModeActive(False)
    reader.ReadFromFile(file)

    mesh_iterator = model.GetMeshObjects()

    # Since point indeces reset per/object in the 3mf library, and don't in Houdini
    # We need to keep track of how many points we've already added to the Houdini mesh 
    point_offset = 0
    
    # Iterate through all unique models in the file
    while mesh_iterator.MoveNext():
        
        # Get the data associated with the current mesh
        current_resource = mesh_iterator.GetCurrent()
        resource_id = current_resource.GetUniqueResourceID()
        current_mesh = model.GetMeshObjectByID(resource_id)
        vertices = current_mesh.GetVertices()
        
        # Create a houdini point for each vertex in the 
        for vertex in vertices:
            coords = vertex.Coordinates
            npt = geo.createPoint()
            npt.setPosition(coords)

        # Create Triangles and assgin them to the verteces
        triangles = current_mesh.GetTriangleIndices()
        for i, triangle in enumerate(triangles):
            indices = triangle.Indices
            p1 = geo.point(point_offset + indices[0])
            p2 = geo.point(point_offset + indices[1])
            p3 = geo.point(point_offset + indices[2])

            nprim = geo.createPolygon()

            v1 = nprim.addVertex(p1)
            v2 = nprim.addVertex(p2)
            v3 = nprim.addVertex(p3)

            prop = current_mesh.GetTriangleProperties(i)

            # Check if there are any vertex properties, e.g. vertex color and UVs
            try:
                prop_type = model.GetPropertyTypeByID(prop.ResourceID)
            except Lib3MF.ELib3MFException:
                continue

            if prop_type:
                # Read vertex colors from the object into Houdini
                if prop_type == Lib3MF.PropertyType.Colors:

                    # Create the color attribute if it doesn't already exist
                    if not cd:
                        geo.addAttrib(hou.attribType.Point, "Cd", [1.0, 1.0, 1.0])
                        cd = True

                    color_list = model.GetColorGroupByID(prop.ResourceID)
                    c1 = color_list.GetColor(prop.PropertyIDs[0])
                    c2 = color_list.GetColor(prop.PropertyIDs[1])
                    c3 = color_list.GetColor(prop.PropertyIDs[2])

                    p1.setAttribValue(
                        "Cd",
                        [
                            int(c1.Red) / 255.0,
                            int(c1.Green) / 255.0,
                            int(c1.Blue) / 255.0,
                        ],
                    )
                    p2.setAttribValue(
                        "Cd",
                        [
                            int(c2.Red) / 255.0,
                            int(c2.Green) / 255.0,
                            int(c2.Blue) / 255.0,
                        ],
                    )
                    p3.setAttribValue(
                        "Cd",
                        [
                            int(c3.Red) / 255.0,
                            int(c3.Green) / 255.0,
                            int(c3.Blue) / 255.0,
                        ],
                    )

                # Read UV attributes into Houdini
                if prop_type == Lib3MF.PropertyType.TexCoord:
                    
                    # Create the uv property if it doesn't already exist
                    if not uv:
                        geo.addAttrib(hou.attribType.Vertex, "uv", [0.0, 0.0])
                        uv = True

                    uv_list = model.GetTexture2DGroupByID(prop.ResourceID)
                    print(uv_list)
                    uv1 = uv_list.GetTex2Coord(prop.PropertyIDs[0])
                    print(f"{uv1.U},{uv1.V}")
                    uv2 = uv_list.GetTex2Coord(prop.PropertyIDs[1])
                    uv3 = uv_list.GetTex2Coord(prop.PropertyIDs[2])

                    v1.setAttribValue("uv", [uv1.U, uv1.V])
                    v2.setAttribValue("uv", [uv2.U, uv2.V])
                    v3.setAttribValue("uv", [uv3.U, uv3.V])

        # After processing the mesh, update the point_offset counter by point size
        point_offset += current_mesh.GetVertexCount()
```

Now, what about exporting you may ask? Well, that's a good question. But since before I 
made this tool I had already build a [standalone 3mf packaging tool](/standalone-3mf-packager) 
I decided to use Houdini's built in .obj exporters, whichc supported all of the 
properties I intended to use, and run the files through the separate tool which has a 
bunch of additional quality checks built in.

### NRRD File Reader

Working with meshes are all well good, but what if you need to read data about a volume? 
Well, that's the problem that the NRRD, or `Nearly Raw Raster Data`, file format aims to 
implement. Much like the `lib3mf` files, we will still need a file to process, and I'll 
let the user select it themselves from the UI. 

{{< figure src="/HoudiniFileReaders/ReadNRRD.png" >}}

Fortunately, unlike `lib3mf`, I don't need an extra wrapper file to use the 
`pynrrd` library. I do however, still need to make sure it's installed. Fortunately, 
it's on PyPI, which means I can just tell Houdini to install it with pip, if the user 
hasn't done so already!

```Python
try:
    import nrrd
except:
    import sys
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "pynrrd"])
    import nrrd
```

Now, there are *definitely* better ways to handle dependecy managemnt in Python. I for 
one really like [poetry](https://python-poetry.org/), but the way Houdini handles it's 
dependencies and projects, doesn't really support a lot of these convenient tools, and I 
found this a suitable work-around for working with dependency management inside the 
Houdini engine and its Python interpreter.

Now that we know we have our libraries, we can check that users input is actualy valid 
as well. If you read the section about the 3mf importer, this should look familiar.

```Python
file = digital_asset_node.parm("file").eval()

file_exists = True

if os.path.isfile(file):
    file_exists = True
elif file != "":
    raise hou.Error("Specified file does not exist")

if file_exists:
    read_nrrd(file)
```

Finally, we can read the data! 

```Python
def read_nrrd(file):
    read_data, header = nrrd.read(file)

    # Set the resolution of the volume ndarray
    res = header["sizes"]

    # Set the distance between each voxel point per axis
    x_spacing = abs(max(header["space directions"][0], key=abs))
    y_spacing = abs(max(header["space directions"][1], key=abs))
    z_spacing = abs(max(header["space directions"][2], key=abs))

    # Set the volumes location in space
    center = header["space origin"]

    # Calculate the total dimensions of the volume
    x_size = x_spacing * res[0]
    y_size = y_spacing * res[1]
    z_size = z_spacing * res[2]

    # Calculate the minimum and maximum bounding box location
    x_min = center[0] - (x_size / 2)
    y_min = center[1] - (y_size / 2)
    z_min = center[2] - (z_size / 2)

    x_max = center[0] + (x_size / 2)
    y_max = center[1] + (y_size / 2)
    z_max = center[2] + (z_size / 2)

    # Create a bounding box object to size the volume
    bounding_box = hou.BoundingBox(x_min, y_min, z_min, x_max, y_max, z_max)

    # Create appropriately sized volume object
    volume = geo.createVolume(int(res[0]), int(res[1]), int(res[2]), bounding_box)

    # Stuff the voxel data into the volume
    flattened_data = read_data.flatten("F")
    all_voxels = tuple(float(val) for val in flattened_data)
    volume.setAllVoxels(all_voxels)
```

Fortuntaely, both Houdini and the `pynrrd` library have great support for `numpy`, which 
makes sizing the volumes and reformatting the data to Houdini's specifications a breeze. 

## Conclusions

I've tried to break up the components of these scripts into, at least somewhat, 
digestable pieces but there's definietly some code-stink any time I try to write 
software for Houdini, so if you have any questions about the logic or implementation 
feel free to reach out! Ultimately, I hope this write up will de-mystify some of the 
pecularities of writing code for Houdini, and give some insight into the `lib3mf` and 
`pynrrd` libraries as well! 