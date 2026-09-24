// Realistic rectangular duct run: parameters, macros, helpers, loops.
//@param Width=400
//@param Height=250
//@param Segments=3
//@param Length=1200
//@param getExtInsSize=30
//@eval Width + 2 * ext
//@eval SEGNUM
//@eval Length / Segments
//@line 999
//@line 40
//@line 58
//@line 72
//@line 80
#include "stdafx.h"
#include "PnGeometry3d.h"

#define SEGNUM 4
#define HALF(x) ((x) * 0.5)
#define CONN_W (CONNECTOR_WIDTH + 10)

double Width = 300;
double Height = 200;
int Segments = 2;
double Length = 1000;
double ext = 0;

void sectionFrame(int index, double step, FdPoint3d &center, FdVector3d &normal, FdVector3d &up)
{
    center = FdPoint3d(0, 0, 0) + vx * (index * step);
    normal = vx;
    up = vz;
    if (index % 2 == 1)
    {
        normal.rotateBy(M_PI / 12, vz);
        up = normal.crossProduct(vy).normal();
    }
}

void drawRun(double w, double h, int count, double len)
{
    FdPoint3d centers[SEGNUM + 1];
    FdVector3d normals[SEGNUM + 1];
    FdVector3d ups[SEGNUM + 1];
    double widths[SEGNUM + 1];
    double heights[SEGNUM + 1];
    double step = len / count;
    for (int i = 0; i <= count; i++)
    {
        FdPoint3d c;
        FdVector3d n, u;
        sectionFrame(i, step, c, n, u);
        centers[i] = c;
        normals[i] = n;
        ups[i] = u;
        widths[i] = w + 2 * ext;
        heights[i] = h + 2 * ext;
    }
    setMeshColor(2);
    makeBox(count, centers, normals, ups, widths, heights, true, true);
    makeConnector(centers[0], -normals[0], ups[0], HALF(w), HALF(h));
    makeConnector(centers[count], normals[count], ups[count], w, h);
}

void main()
{
    get_val("Width", Width);
    get_val("Height", Height);
    get_val("Segments", Segments);
    get_val("Length", Length);
    if (getExtInsSize(ext))
    {
        setPrimitiveMode(FLM3Geo::pmExtInsulation);
    }
    drawRun(Width, Height, Segments, Length);
    setPrimitiveMode(FLM3Geo::pmNormal);
    FdPoint3d tail = FdPoint3d(0, 0, 0) + vx * (Length + CONN_W);
    makeSimpleTube(tail, tail + vx * 100, HALF(Width), HALF(Height), cpx);
    double total = Length + CONN_W;
}
