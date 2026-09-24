// makeStraightTube and makeUniVectorTube (segment default true),
// makeTubularBend (segment/half defaults; half is not rendered) and
// makeDonutSection (open, closed and negative sweeps).
FdPoint3d p0(0, 0, 0);
FdPoint3d line3[3] = {p0, p0 + vz * 100, p0 + vz * 250};
FdPoint3d bent3[3] = {p0, p0 + vx * 100, p0 + vx * 150 + vy * 80};
FdPoint3d same2[2] = {p0, p0};
double d3[3] = {60, 60, 40};
double d2[2] = {30, 50};
makeStraightTube(line3, d3, 2, 2);
makeStraightTube(bent3, d3, 3, 2, false);
makeStraightTube(same2, d2, 1, 1);
makeUniVectorTube(bent3, vy, d3, 2, 2);
makeUniVectorTube(line3, FdVector3d(0, 1, 1), d2, 1, 1, false);
makeTubularBend(p0, vz, vx, 200, 40, 90, 3, 6);
makeTubularBend(p0, vy, FdVector3d(1, 1, 0), 150, 25.5, -45, 2, 3, false);
makeTubularBend(p0, vz, vz, 100, 20, 360, 1, 8, true, false);
makeTubularBend(p0, vz, vx, 0, 20, 30, 2, 1);
makeDonutSection(p0, vz, vx, 300, 60, 180, 2, 5);
makeDonutSection(p0, FdVector3d(1, 0, 1), vy, 120, 30, 360, 3, 12);
makeDonutSection(p0, vx, vx, 80, 16, -270, 1, 2000);
// Rejected inputs. The derived tube/bend adapters report missing adapters;
// makeDonutSection reports its own argument problems.
makeStraightTube(line3, d3, 2, 3);
makeStraightTube(line3, d3, 0, 2);
makeStraightTube(line3, d3, 2, 0);
makeStraightTube(line3, d3, 2, 2, missingSegment);
makeUniVectorTube(line3, vy * 0, d3, 2, 2);
makeUniVectorTube(line3, vy, d2, 2, 2);
makeUniVectorTube(line3, p0, d3, 2, 2);
makeTubularBend(p0, vz, vx, 200, 40, 90, 3, 6, true, true);
makeTubularBend(p0, vz, vx, -1, 40, 90, 3, 6);
makeTubularBend(p0, vz, vx, 200, 40, 0, 3, 6);
makeTubularBend(p0, vz, vx * 0, 200, 40, 90, 3, 6);
makeTubularBend(p0, vz, vx, 200, missingDiameter, 90, 3, 6);
makeDonutSection(p0, vz, vx, 300, 0, 180, 2, 5);
makeDonutSection(p0, vz, vx, -1, 60, 180, 2, 5);
makeDonutSection(p0, vz, vx, 300, 60, 0, 2, 5);
makeDonutSection(p0, vz, vx, 300, 60, 180, 0, 5);
makeDonutSection(p0, vz, vx, 300, 60, 180, 2, 0);
makeDonutSection(p0, vz * 0, vx, 300, 60, 180, 2, 5);
makeDonutSection(p0, vz, missingRadVec, 300, 60, 180, 2, 5);
