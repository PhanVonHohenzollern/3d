// makeTube (with and without upVectors), half tubes, per-section frames,
// numOfSegs+1 sections, zero section normals and invalid arrays.
FdPoint3d p0(0, 0, 0);
FdPoint3d centers[4] = {p0, p0 + vx * 200, p0 + vx * 400 + vy * 100, p0 + vx * 500 + vy * 300};
FdVector3d normals[4] = {vx, vx, FdVector3d(1, 1, 0), vy};
FdVector3d ups[4] = {vz, vz, vz, vx};
double diams[4][2] = {{100, 60}, {100, 60}, {80, 80}, {50, 70}};
makeTube(centers, normals, ups, diams, 2, 3, false, false);
makeTube(centers, normals, diams, 3, 3, false, true);
makeTube(centers, normals, ups, diams, 1, 2, true, false);
makeTube(centers, normals, diams, 2, 1, 1, 0);
// Zero section normals fall back to the neighbouring centers.
FdVector3d zeroNormals[3] = {FdVector3d(0, 0, 0), vx, FdVector3d(0, 0, 0)};
makeTube(centers, zeroNormals, ups, diams, 1, 2, false, false);
// Up vector parallel to the normal uses the stable basis.
FdVector3d parallelUps[2] = {vx, vx};
makeTube(centers, normals, parallelUps, diams, 2, 1, false, false);
// Invalid arrays and counts.
double diams1[4][1] = {{10}, {20}, {30}, {40}};
makeTube(centers, normals, ups, diams1, 2, 3, false, false);
makeTube(centers, normals, ups, diams, 2, 4, false, false);
makeTube(centers, normals, ups, diams, 2, 0, false, false);
makeTube(centers, normals, ups, diams, 0, 2, false, false);
makeTube(centers, normals, parallelUps, diams, 2, 2, false, false);
makeTube(centers, normals, ups, diams, 2, 3, false, missingSegment);
makeTube(p0, normals, ups, diams, 2, 3, false, false);
