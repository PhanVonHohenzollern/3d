// Argument traces, value sources and history boundaries.
//@line 999
//@line 14
FdPoint3d origin(0, 0, 0);
FdVector3d dir = vx;
double lengths[3] = {10, 20, 30};
FdPoint3d centers[3] = {origin, origin + dir * lengths[1], origin + dir * lengths[2]};
FdVector3d normals[3];
for (int i = 0; i < 3; i++)
    normals[i] = (i == 2) ? vz : dir;
double w = 40;
w = w + 5;
centers[1].y = 7;
makeBox(2, centers, normals, w, lengths[0], false);
w = 100;
makeBox(2, centers, normals, w, lengths[0], false);
for (int k = 0; k < 2; k++) {
    double r = lengths[k] / 2;
    makeSimpleTube(centers[k], centers[k + 1], r, r, cpx);
    makeSimpleTube(centers[k], centers[k] + normals[k] * r, centers[k].x, centers[k][1], FLM3Geo::pmNormal);
}
makeBox(1, {centers[0], centers[2]}, {vx, vy}, w, w, false);
makeSimpleTube(origin, origin + dir * lengths[1 + 1], lengths[w], lengths[unknownIdx], lengths[(1)]);
makeSimpleTube(origin, origin + dir, FLM3Geo::primitiveMode::pmIntInsulation, primitiveMode::pmNormal, dir.x);
