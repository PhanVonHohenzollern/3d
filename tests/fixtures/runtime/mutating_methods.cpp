// Statement-level mutating member calls write back to the l-value.
//@line 999
//@line 12
FdVector3d v(3, 4, 0);
FdPoint3d p(1, 0, 0);
FdVector3d vs[2] = {vx * 2, vy * 3};
double d = 1;
v.normalize();
v.normalize(1e-3);
v.rotateBy(M_PI / 2, vz);
p.rotateBy(M_PI / 2, vz);
p.rotateBy(M_PI, vz, FdPoint3d(1, 1, 0));
p.rotateBy(M_PI, vz, vx);
v.mirror(vy);
p.set(1, 2, 3);
v.set(0, 0, 2);
vs[1].normalize();
vs[0].rotateBy(M_PI, vz);
vs[0].set(5, 5, 5);
v.rotateBy(1);
p.rotateBy(1, vx, p, p);
p.normalize();
v.mirror(p);
d.normalize();
d.rotateBy(1, vx);
d.set(1, 2, 3);
p.set(1, 2);
p.x.normalize();
FdVector3d w = v.rotateBy(0.5, vx);
w = v.rotateBy(0.5, vx);
makeSimpleTube(p, p + v.normalize(), 1, 1, 3);
v.normalize().x;
v.length();
unknownVec.normalize();
v.set(unknownA, 1, 2);
