// makeSpheroidSection: with bVector (7 args) and without (6 args, perpVector),
// latitude/longitude ranges, complexity int[2], degenerate radii and bVector.
FdPoint3d c(50, 60, 70);
double fullLat[2] = {0, 180};
double fullLon[2] = {0, 360};
double capLat[2] = {90, 180};
double quarterLon[2] = {-45, 45};
double diams[3] = {200, 120, 80};
double flatDiams[3] = {0, 100, 100};
int n[2] = {6, 8};
int nSmall[2] = {0, 1};
double nDouble[2] = {3.5, 4.4};
makeSpheroidSection(c, vz, vx, fullLat, fullLon, diams, n);
makeSpheroidSection(c, FdVector3d(1, 1, 1), capLat, quarterLon, diams, n);
makeSpheroidSection(c, vy, vy, capLat, fullLon, flatDiams, nSmall);
makeSpheroidSection(c, vx, FdVector3d(1, 1, 0), fullLat, quarterLon, diams, nDouble);
// Invalid: short arrays, zero normal/bVector, wrong types.
double one[1] = {10};
makeSpheroidSection(c, vz, vx, one, fullLon, diams, n);
makeSpheroidSection(c, vz, vx, fullLat, fullLon, fullLat, n);
makeSpheroidSection(c, vz * 0, vx, fullLat, fullLon, diams, n);
makeSpheroidSection(c, vz, vx * 0, fullLat, fullLon, diams, n);
makeSpheroidSection(c, vz, fullLat, fullLon, diams, one);
makeSpheroidSection(c, vz, vx, fullLat, fullLon, diams, missingN);
