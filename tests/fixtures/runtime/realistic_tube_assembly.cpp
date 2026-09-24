// Realistic circular assembly: frames, rotations, 2D arrays and helpers.
//@param Diameter=160
//@param Angle=45
//@line 999
//@line 26
//@line 38
//@line 47
#define N_SEC 3
double Diameter = 125;
double Angle = 90;

void bendFrame(const FdPoint3d &origin, const FdVector3d &dir, double radius, double angle,
               FdPoint3d &end, FdVector3d &endDir)
{
    FdVector3d side = dir.perpVector();
    FdPoint3d pivot = origin + side * radius;
    end = origin;
    end.rotateBy(angle, dir.crossProduct(side), pivot);
    endDir = dir;
    endDir.rotateBy(angle, dir.crossProduct(side));
}

void main()
{
    get_val("Diameter", Diameter);
    get_val("Angle", Angle);
    double rad = Angle * M_PI / 180;
    FdPoint3d centers[N_SEC];
    FdVector3d normals[N_SEC];
    double diams[N_SEC][2];
    centers[0] = FdPoint3d(0, 0, 0);
    normals[0] = vx;
    for (int i = 0; i < N_SEC; i++)
    {
        diams[i][0] = Diameter * (1 + 0.1 * i);
        diams[i][1] = diams[i][0];
        if (i > 0)
        {
            centers[i] = centers[i - 1] + normals[i - 1] * 200;
            normals[i] = normals[i - 1];
        }
    }
    makeTube(centers, normals, diams, cpx, N_SEC - 1, false, false);
    FdPoint3d bendEnd;
    FdVector3d bendDir;
    bendFrame(centers[N_SEC - 1], normals[N_SEC - 1], Diameter, rad, bendEnd, bendDir);
    makeSimpleTube(bendEnd, bendEnd + bendDir * 300, Diameter, Diameter, cpx);
    makeFlatDisc(bendEnd + bendDir * 300, bendDir, Diameter, cpx);
    double lat[2] = {0, M_PI / 2};
    double lon[2] = {0, 2 * M_PI};
    double sph[3] = {Diameter, Diameter, Diameter * 0.5};
    int n[2] = {cpx, 2 * cpx};
    makeSpheroidSection(centers[0], -normals[0], lat, lon, sph, n);
    double lenCheck = (bendEnd - centers[0]).length();
}
