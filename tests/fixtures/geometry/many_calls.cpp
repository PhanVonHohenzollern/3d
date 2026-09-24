// Many calls from loops: accumulated pre/post rotations and translations
// (matrix products applied per apiIndex), per-iteration colors and sections.
FdPoint3d origin(0, 0, 0);
FdVector3d axis(0.2, 0.3, 1);
for (int i = 0; i < 24; i++) {
    postTransformMesh(M_PI / 12, axis);
    setMeshColor(10 * i, 255 - 10 * i, 128);
    FdPoint3d a = origin + vx * (400.0 + 5.0 * i);
    FdPoint3d pts[2] = {a, a + vz * (20.0 + i)};
    FdVector3d vecs[2] = {vz, vz};
    makeBox(1, pts, vecs, 30 + i, 10 + 0.5 * i, i % 2 == 0);
    if (i % 3 == 0) preTransformMesh(vz * 7.5);
}
for (int k = 0; k < 16; k++) {
    preTransformMesh(0.1 * k, FdVector3d(1, k, 2));
    makeFacettedCylinder(origin, origin + vy * (100 + k), vz, 12 + k, 0, 180 + 10 * k, 3 + k, k % 2 == 0, true);
}
