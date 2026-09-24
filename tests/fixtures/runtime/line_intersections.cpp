// lineSegToLineSegInt / lineToLineInt update the output point on a hit.
//@line 999
//@line 12
FdPoint3d a0(0, 0, 0), a1(10, 0, 0);
FdPoint3d b0(5, -5, 0), b1(5, 5, 0);
FdPoint3d c0(20, -5, 0), c1(20, 5, 0);
FdPoint3d d0(0, 1, 0), d1(10, 1, 0);
FdPoint3d s0(5, -5, 1), s1(5, 5, 1);
FdPoint3d out(-1, -1, -1);
FdPoint3d out2(-1, -1, -1);
FdPoint3d pts[2];
lineSegToLineSegInt(a0, a1, b0, b1, out);
lineSegToLineSegInt(a0, a1, c0, c1, out2);
lineToLineInt(a0, a1, c0, c1, out2);
lineToLineInt(a0, a1, d0, d1, pts[0]);
lineToLineInt(a0, a1, s0, s1, pts[1]);
lineToLineInt(a0, a0, b0, b1, pts[1]);
lineToLineInt(a0 + vx * 2, a1 - vx, b0, b1 + vz * 0, pts[1]);
lineSegToLineSegInt(a0, a1, b0, b1);
lineSegToLineSegInt(a0, a1, vx, b1, out);
double notPoint = 0;
lineSegToLineSegInt(a0, a1, b0, b1, notPoint);
lineSegToLineSegInt(a0, a1, b0, b1, missingOut);
double hitX = out.x + pts[1].x;
