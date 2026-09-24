// User helper functions that call native APIs (parentApiIndex, nested helpers,
// reference write-back) and loops that produce many calls. Helper calls are
// traced but never produce meshes or warnings of their own.
//@line 38
//@line 48
FdPoint3d origin(0, 0, 0);

void ring(FdPoint3d c, double d)
{
    makeFlatRing(c, vz, d * 0.5, d, 2);
}

void tubeWithRings(FdPoint3d a, FdPoint3d b, double d)
{
    makeVerySimpleTube(a, b, d, 2);
    ring(a, d * 1.5);
    ring(b, d * 1.5);
}

void advance(FdPoint3d &p, double step)
{
    p = p + vx * step;
}

void makeDuctRun(FdPoint3d start, int count)
{
    FdPoint3d p = start;
    for (int i = 0; i < count; i++) {
        FdPoint3d next = p;
        advance(next, 120);
        tubeWithRings(p, next, 40);
        p = next;
    }
}

makeDuctRun(origin, 2);
tubeWithRings(origin + vy * 300, origin + vy * 300 + vz * 200, 25);
makeDuctRun(origin, missingCount);
for (int k = 0; k < 6; k++) {
    setMeshColor(k);
    FdPoint3d c = origin + vy * (-100.0 * k);
    makeSimpleTube(c, c + vz * (50.0 + 10.0 * k), 30, 20 + k, k);
}
for (int j = 0; j < 4; ++j) {
    preTransformMesh(vx * 25);
    makeFlatDisc(origin, vz, 20 + j, 1);
}
makeFlatDisc(origin, vx, 10, 1);
