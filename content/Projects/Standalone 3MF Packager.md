---
title:  '"Meh": A Standalone mesh inspector, and 3MF exporter'
date: 2022-07-05
description: "A tool for ensuring quality and compliance of 3D files and prints"
thumbnail: /meh/thumbnail.png
tags: ["Tech_Art", "Software_Engineer"]
---

As a software engineer at an additive manufacturing company, I've had the opportunity 
to work on some interesting challenges. One that I think was particularly successful was 
running to ground was the need to have a way to communicate build properties of multiple 
3D printer parts that would be manufactured as an assembly in a reusable and simply way. 

The slicing software that managed our polyjet printer did not, at the time, have great 
support for mixing files with multiple properties, or more importantly, support for 
combining files of different types that were made in different parts of our 
production process. 

## The Solution? .3mf, PMP Library, and C#

The great folks at the [3MF Consortium](https://3mf.io/), have put together a spec that 
supports all of the features I was looking to implement, but since it's so new, many 
DCC tools don't yet suport it. So, I decided to write a program that would let me 
combine meshes from different parts of our production workflow, with the added benefit 
of adding additional quality checks to make sure there were no mesh errors. 

Now that we know the target, what is the process? There's lots of tools for working with 
mesh processing, but I really liked the simplicity of [PMP Library](https://www.pmp-library.org/) 
and it comes with the added benefit of having a built in template for creating a desktop 
application with imgui. There was just one problem: Z-Brush.

### The Struggles

During the course of this project, I learned a lot about the .3mf file format. However, 
I also got to learn a lot about the Wavefront Object (.obj) file format, which had been 
our workhorse up to this point. The key piece being that the obj file format does not 
actually have any support for vertex colors baked into it's spec, BUT most programs 
support vertex color. Though, to be fair, the [Wavefront Object specification](https://www.fileformat.info/format/wavefrontobj/egff.htm) 
doesn't suport vertex color either. 

A simple OBJ file w/o vertex colors therefore, looks something like this:

```C++
# File exported by Houdini 20.0.506 (www.sidefx.com)
# 8 points
# 24 vertices
# 6 primitives
# Bounds: [-0.5, -0.5, -0.5] to [0.5, 0.5, 0.5]

g 

# The verteces are here!
v 0.5 -0.5 0.5
v -0.5 -0.5 0.5
v 0.5 0.5 0.5
v -0.5 0.5 0.5
v -0.5 -0.5 -0.5
v 0.5 -0.5 -0.5
v -0.5 0.5 -0.5
v 0.5 0.5 -0.5

g 

f 1 3 4 2
f 5 7 8 6
f 7 4 3 8
f 6 1 2 5
f 6 8 3 1
f 2 4 7 5
```

However, a lot of computer graphics tools, including Blender and Houdini support vertex 
colors as shown below.

```C++
# File exported by Houdini 20.0.506 (www.sidefx.com)
# 8 points
# 24 vertices
# 6 primitives
# Bounds: [-0.5, -0.5, -0.5] to [0.5, 0.5, 0.5]

g 

# Vertex colors are in line with the vertex location!
v 0.5 -0.5 0.5 1 0 1   # Magenta
v -0.5 -0.5 0.5 0 0 1  # Blue
v 0.5 0.5 0.5 1 1 1    # White
v -0.5 0.5 0.5 0 1 1   # Cyan
v -0.5 -0.5 -0.5 0 0 0 # Black
v 0.5 -0.5 -0.5 1 0 0  # Red
v -0.5 0.5 -0.5 0 1 0  # Green
v 0.5 0.5 -0.5 1 1 0   # Yellow

g 

f 1 3 4 2
f 5 7 8 6
f 7 4 3 8
f 6 1 2 5
f 6 8 3 1
f 2 4 7 5
```

Z-Brush takes takes a different approach, opting to (I'm guessing) dump the data from 
the vertex attribute buffer in the GPU directly to the file as another section, after 
the vertex list. Props to their team, this is probably a lot easier to implement when 
you're just writing data into and out of a GPU. 

The Z-Brush Cube

```C++
g 

v 0.5 -0.5 0.5a
v -0.5 -0.5 0.5
v 0.5 0.5 0.5
v -0.5 0.5 0.5
v -0.5 -0.5 -0.5
v 0.5 -0.5 -0.5
v -0.5 0.5 -0.5
v 0.5 0.5 -0.5

# Vertex colors are below! Definitely harder to parse for someone reading the file,
# But maybe easier for a computer shoving the data into a GPU?

# The following MRGB block contains ZBrush Vertex Color (Polypaint) and 
# masking output as 4 hexadecimal values per vertex. The vertex color format 
# is MMRRGGBB with up to 64 entries per MRGB line.
#MRGB ffff00ffff0000ffffffffffff00ffffff000000ffff0000ff00ff00ffffff00

g 

f 1 3 4 2
f 5 7 8 6
f 7 4 3 8
f 6 1 2 5
f 6 8 3 1
f 2 4 7 5
```

So, some pretty interesting differences! At least, interesting if you share my 
fascination with computer graphics. So, I had to extend the `pmp-lib` OBJ import 
function to support vertex colors, in two different ways. I've copied the relavent bits 
of processing below, but if you want the rest of the context, you can browse my fork of 
the repository on my [github](https://github.com/TresSims/pmp-library/tree/obj-vertex-color)

```C++
while (in && !feof(in) && fgets(s.data(), 600, in))
    {
        // comment, but not vertex color comment
        if ((s[0] == '#' && s[1] != 'M') || isspace(s[0]))
            continue;

        // vertex
        else if (strncmp(s.data(), "v ", 2) == 0)
        {
            // Inline vertex color processing
            if (sscanf(s.data(), "v %f %f %f %f %f %f", &x, &y, &z, &r, &g, &b))
            {
                if (!with_vert_colors)
                {
                    colors = mesh.vertex_property<Color>("v:color");
                    with_vert_colors = true;
                }
                v = mesh.add_vertex(Point(x, y, z));
                colors[v] = Color(r, g, b);
            }
            else if (sscanf(s.data(), "v %f %f %f", &x, &y, &z))
            {
                mesh.add_vertex(Point(x, y, z));
            }
        }

        // zbrush vertex color
        else if (strncmp(s.data(), "#MRGB ", 6) == 0)
        {
            if (!with_vert_colors)
            {
                colors = mesh.vertex_property<Color>("v:color");
                with_vert_colors = true;
            }
            int colors_in_line = (std::strlen(s.data()) - 7) / 8;
            for (int i = 0; i < colors_in_line; i++)
            {
                std::cout << vert_count << std::endl;
                // For these purposes, mask is ignored
                std::stringstream red, green, blue;
                int red_of_255, green_of_255, blue_of_255;

                // Read hex codes into string stream
                red << s[i * 8 + 8] << s[i * 8 + 9];
                green << s[i * 8 + 10] << s[i * 8 + 11];
                blue << s[i * 8 + 12] << s[i * 8 + 13];

                // convert string stream into int
                red >> std::hex >> red_of_255;
                green >> std::hex >> green_of_255;
                blue >> std::hex >> blue_of_255;

                // convert 1 - 255 int scale to 0-1 float scale
                r = red_of_255 / 255;
                g = green_of_255 / 255;
                b = blue_of_255 / 255;

                // There was no vertex access by index that I saw in PMP library, so I 
                // have to loop through each vertex to find the right one to apply the 
                // attribute to. If anyone knows a better way, please reach out!
                for (Vertex vi : mesh.vertices())
                {
                    if (vi.idx() == vert_count)
                    {
                        v = vi;
                        break;
                    }
                }
                colors[v] = Color(r, g, b);
                vert_count++;

                red.clear();
                green.clear();
                blue.clear();
            }
        }
    }
```

There were also some inconsistencies with how `pmp-lib` stored vertex informatin and how 
`lib3mf` expected to recieve it, so I wrote a series of conversions to take the display 
and qa tool data and convert it for export.

```C++
sLib3MFPosition convertPMPto3MFVertex(Point p) {
  /*
   * Converts a pmp-library Point object to a lib3MF sLib3MFPosition.
   */

  sLib3MFPosition result;
  result.m_Coordinates[0] = p[0];
  result.m_Coordinates[1] = p[1];
  result.m_Coordinates[2] = p[2];
  return result;
}
```

```C++
sLib3MFTriangle convertPMPto3MFFace(SurfaceMesh::VertexAroundFaceCirculator f) {
  /*
   * Takes a pmp-library VertexAroundFaceCirculator and puts the
   * indicies of the circulated vertex's into a lib3MF
   * sLib3MFTriangle object.
   */

  sLib3MFTriangle result;
  int i = 2;
  for (auto v : f) {
    result.m_Indices[i] = v.idx();
    i--;
  }
  return result;
}
```

```C++
sColor convertPMPTo3MFVertexColor(Color color) {
  /*
   * Takes a pmp-library Color and converts it to a lib3MF sColor
   */

  sColor result;
  result.m_Red = color[0];
  result.m_Green = color[1];
  result.m_Blue = color[2];
  result.m_Alpha = 255;
  return result;
}
```

```C++
sTriangleProperties convertPMPTo3MFTriangleColorProperties(
    SurfaceMesh::VertexAroundFaceCirculator f, PColorGroup resource) {
  /*
   * \brief Creates a lib3MF sTriangleProperty from a list of vertices,
   *        and a color resource.
   * Currenlty this implementation assumes your color resource is indexed
   * the same as your vertices, this could be changed in the future to
   * allow for multiple vertices with the same color point to the same
   * resource index, rather than having two identical resources.
   */

  sTriangleProperties result;
  result.m_ResourceID = resource->GetResourceID();
  int i = 2;
  for (auto v : f) {
    result.m_PropertyIDs[i] = v.idx() + 1;
    i--;
  }
  return result;
}
```

```C++
sTriangleProperties
convertPMPTo3MFUVProperties(SurfaceMesh::HalfedgeAroundFaceCirculator f,
                            HalfedgeProperty<TexCoord> uvList,
                            PTexture2DGroup resource) {
  /*
   * \brief Creates a lib3MF sTriangleProperty from a list of vertices,
   *        and a color resource.
   * Currenlty this implementation assumes your color resource is indexed
   * the same as your vertices, this could be changed in the future to
   * allow for multiple vertices with the same color point to the same
   * resource index, rather than having two identical resources.
   */

  sTriangleProperties result;
  result.m_ResourceID = resource->GetResourceID();
  int i = 2;
  for (auto v : f) {
    const TexCoord &UVs = uvList[v];
    result.m_PropertyIDs[i] =
        resource->AddTex2Coord(sLib3MFTex2Coord({UVs[0], UVs[1]}));
    i--;
  }
  return result;
}
```



## Conclusions

{{< figure src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXp2YTMzd3hnbmlqM25sanR4MGEwbGp1Nm8yYWc4ZHdidGRiaGpndyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ifVMBx77Y80pLRt61r/giphy.gif" >}}

This project was unfortuntaley short lived, as the slicer we used eventually supported 
obj assemblies better, and that became an easier workflow for our team, but I still 
enjoyed getting to work on the tool and come back to it from time to time. Maybe in the 
next iteration I'll write a version in Rust, or some other Memory safe language. 

I hope you found this article interesting! If this is a tool that seems like it would be 
useful to you, you can find it on my [github](https://github.com/TresSims/meh). 


